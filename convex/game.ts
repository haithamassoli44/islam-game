import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { advance, validProgress, validAction, type GameAction, type Progress } from '../shared/game';
import { mutation, query } from './_generated/server';
import { gameAction, progress, settings, review } from './validators';
import { ownedChild, requireParent } from './parents';

export const list = query({ args: {}, handler: async ctx => {
  const owner = await getAuthUserId(ctx);
  if (!owner) return { owner: null, children: [] };
  return { owner, children: await ctx.db.query('children').withIndex('by_owner', q => q.eq('owner', owner)).take(12) };
} });

export const get = query({ args: { childId: v.id('children') }, handler: (ctx, { childId }) => ownedChild(ctx, childId) });

export const create = mutation({
  args: { parentToken: v.string(), localId: v.string(), name: v.string(), settings, progress, review },
  handler: async (ctx, args) => {
    const owner = await requireParent(ctx, args.parentToken);
    const name = args.name.trim();
    if (!name || name.length > 24 || !/^[a-zA-Z0-9-]{1,64}$/.test(args.localId) || !validProgress(args.progress)) {
      throw new ConvexError('INVALID_PROFILE');
    }
    validateReview(args.review);
    const existing = await ctx.db.query('children').withIndex('by_owner_and_localId',
      q => q.eq('owner', owner).eq('localId', args.localId)).unique();
    if (existing) return existing;
    if ((await ctx.db.query('children').withIndex('by_owner', q => q.eq('owner', owner)).take(12)).length >= 12) {
      throw new ConvexError('PROFILE_LIMIT');
    }
    const id = await ctx.db.insert('children', { owner, localId: args.localId, name, settings: args.settings,
      progress: args.progress, review: args.review, revision: 0, updatedAt: Date.now(),
      ...(args.review.recitedAt || args.review.practiceAt ? { confirmedBy: owner } : {}) });
    return ctx.db.get(id);
  },
});

export const apply = mutation({
  args: { childId: v.id('children'), revision: v.number(), operationId: v.string(), actions: v.array(gameAction) },
  handler: async (ctx, args) => {
    const child = await ownedChild(ctx, args.childId);
    if (!Number.isInteger(args.revision) || args.revision < 0 || args.actions.length < 1
      || args.actions.length > 100 || args.actions.some(a => !validAction(a))
      || !/^[a-zA-Z0-9-]{1,64}$/.test(args.operationId)) throw new ConvexError('INVALID_SAVE');
    if (child.lastOperation === args.operationId) return child;
    if (child.revision !== args.revision) throw new ConvexError('SAVE_CONFLICT');
    let state = child.progress as Progress;
    let preferences = child.settings;
    for (const action of args.actions) {
      state = advance(state, action as GameAction);
      if (action.type === 'preferences') preferences = action.settings;
    }
    if (!validProgress(state)) throw new ConvexError('INVALID_PROGRESS');
    await ctx.db.patch(child._id, { progress: state, settings: preferences, revision: child.revision + 1,
      lastOperation: args.operationId, updatedAt: Date.now() });
    return ctx.db.get(child._id);
  },
});

export const updateSettings = mutation({
  args: { childId: v.id('children'), parentToken: v.string(), settings, name: v.string() },
  handler: async (ctx, args) => {
    await requireParent(ctx, args.parentToken);
    const child = await ownedChild(ctx, args.childId);
    const name = args.name.trim();
    if (!name || name.length > 24) throw new ConvexError('INVALID_PROFILE');
    await ctx.db.patch(child._id, { settings: args.settings, name, updatedAt: Date.now() });
    return ctx.db.get(child._id);
  },
});

export const confirm = mutation({
  args: { childId: v.id('children'), parentToken: v.string(), kind: v.union(v.literal('recitation'), v.literal('practice')),
    needsHelp: v.optional(v.boolean()), reviewOn: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const owner = await requireParent(ctx, args.parentToken);
    const child = await ownedChild(ctx, args.childId);
    const nextReview = { ...child.review };
    if (args.kind === 'recitation') {
      nextReview.recitedAt = Date.now(); nextReview.needsHelp = args.needsHelp ?? false;
      if (args.reviewOn) nextReview.reviewOn = args.reviewOn;
      else delete nextReview.reviewOn;
    } else nextReview.practiceAt = Date.now();
    validateReview(nextReview);
    await ctx.db.patch(child._id, { review: nextReview, confirmedBy: owner, updatedAt: Date.now() });
    return ctx.db.get(child._id);
  },
});

export const remove = mutation({
  args: { childId: v.id('children'), parentToken: v.string() },
  handler: async (ctx, args) => {
    await requireParent(ctx, args.parentToken);
    const child = await ownedChild(ctx, args.childId);
    await ctx.db.delete(child._id);
  },
});

function validateReview(r: { recitedAt?: number; practiceAt?: number; reviewOn?: string }) {
  for (const time of [r.recitedAt, r.practiceAt]) {
    if (time !== undefined && (!Number.isFinite(time) || time < 0 || time > Date.now() + 60_000)) throw new ConvexError('INVALID_REVIEW');
  }
  if (r.reviewOn !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(r.reviewOn)
    || !Number.isFinite(Date.parse(r.reviewOn)) || new Date(r.reviewOn).toISOString().slice(0, 10) !== r.reviewOn)) throw new ConvexError('INVALID_REVIEW_DATE');
}
