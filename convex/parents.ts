import { getAuthUserId, retrieveAccount } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { action, internalMutation, internalQuery, mutation, type QueryCtx, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

export async function sha256(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    b => b.toString(16).padStart(2, '0')).join('');
}

export async function requireParent(ctx: QueryCtx | MutationCtx, token: string) {
  const owner = await getAuthUserId(ctx);
  const identity = await ctx.auth.getUserIdentity();
  if (!owner || !identity || !/^[a-f0-9]{64}$/.test(token)) throw new ConvexError('PARENT_AUTH_REQUIRED');
  const hash = await sha256(token);
  const session = await ctx.db.query('parentSessions').withIndex('by_tokenHash', q => q.eq('tokenHash', hash)).unique();
  if (!session || session.owner !== owner || session.subject !== identity.subject || session.expiresAt <= Date.now()) {
    throw new ConvexError('PARENT_AUTH_REQUIRED');
  }
  return owner;
}

export const account = internalQuery({ args: { owner: v.id('users') }, handler: (ctx, { owner }) => ctx.db.get(owner) });

export const unlock = action({
  args: { password: v.string() },
  handler: async (ctx, { password }): Promise<string> => {
    const owner = await getAuthUserId(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!owner || !identity) throw new ConvexError('UNAUTHENTICATED');
    const user = await ctx.runQuery(internal.parents.account, { owner });
    if (!user?.email || password.length > 256) throw new ConvexError('INVALID_CREDENTIALS');
    const verified = await retrieveAccount(ctx, { provider: 'password', account: { id: user.email, secret: password } })
      .catch(error => { throw new ConvexError(String(error).includes('TooManyFailedAttempts') ? 'TooManyFailedAttempts' : 'INVALID_CREDENTIALS'); });
    if (verified.user._id !== owner) throw new ConvexError('INVALID_CREDENTIALS');
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    await ctx.runMutation(internal.parents.grant, { owner, subject: identity.subject, tokenHash: await sha256(token) });
    return token;
  },
});

export const grant = internalMutation({
  args: { owner: v.id('users'), subject: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    for (const old of await ctx.db.query('parentSessions').withIndex('by_owner', q => q.eq('owner', args.owner)).take(100)) {
      if (old.subject === args.subject || old.expiresAt <= Date.now()) await ctx.db.delete(old._id);
    }
    await ctx.db.insert('parentSessions', { ...args, expiresAt: Date.now() + 10 * 60 * 1000 });
  },
});

export const lock = mutation({ args: {}, handler: async ctx => {
  const owner = await getAuthUserId(ctx);
  const identity = await ctx.auth.getUserIdentity();
  if (!owner || !identity) throw new ConvexError('UNAUTHENTICATED');
  for (const session of await ctx.db.query('parentSessions').withIndex('by_owner', q => q.eq('owner', owner)).take(100)) {
    if (session.subject === identity.subject) await ctx.db.delete(session._id);
  }
} });

export async function ownedChild(ctx: QueryCtx | MutationCtx, id: Id<'children'>) {
  const owner = await getAuthUserId(ctx);
  if (!owner) throw new ConvexError('UNAUTHENTICATED');
  const child = await ctx.db.get(id);
  if (!child || child.owner !== owner) throw new ConvexError('NOT_FOUND');
  return child;
}
