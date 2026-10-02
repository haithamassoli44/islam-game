import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { progress, settings, review } from './validators';

export default defineSchema({
  ...authTables,
  children: defineTable({
    owner: v.id('users'), localId: v.string(), name: v.string(), settings, progress, review,
    confirmedBy: v.optional(v.id('users')), revision: v.number(), lastOperation: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_owner', ['owner']).index('by_owner_and_localId', ['owner', 'localId']),
  parentSessions: defineTable({ owner: v.id('users'), tokenHash: v.string(), subject: v.string(), expiresAt: v.number() })
    .index('by_tokenHash', ['tokenHash']).index('by_owner', ['owner']),
});
