/// <reference types="vite/client" />
import { expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import { sha256 } from './parents';
import { initialProgress, initialSettings, advance, validProgress, transferEvidence, type GameAction } from '../shared/game';
import { route, walkable } from '../src/world';
import { errorCode } from '../shared/errors';

const modules = import.meta.glob('./**/*.ts');
const start: GameAction[] = [
  { type: 'bag', color: 'blue' }, { type: 'enter' }, { type: 'greet', choice: 'salam' },
  { type: 'collect', clip: 0 }, { type: 'collect', clip: 1 }, { type: 'collect', clip: 2 },
  { type: 'place', position: 'side' }, { type: 'flag', color: 'aqua' },
];

test('resume preserves first attempts, distinct hints, deferred encounter and a single flag', () => {
  let p = start.reduce(advance, initialProgress());
  expect(validProgress(p)).toBe(true);
  expect(transferEvidence(p)).toBe('لم نجرب اللقاء الجديد بعد');
  expect(advance(p, { type: 'collect', clip: 0 }).clips).toHaveLength(3);
  p = advance(p, { type: 'travel' });
  p = advance(p, { type: 'transfer', choice: 'path' });
  p = JSON.parse(JSON.stringify(p));
  p = advance(p, { type: 'transfer', choice: 'salam' });
  expect(p.transfer.first).toBe('path');
  expect(transferEvidence(p)).toContain('بعد تلميح');
  expect(p.hints.clips).toBe(false);
  expect(p.memorization.ready).toBe(false);
  const retried = advance(p, { type: 'flag', color: 'aqua' });
  expect(retried.flag).toBe('aqua');
  expect(retried.clips).toHaveLength(3);
  expect(validProgress({ ...p, clips: [] })).toBe(false);
  expect(validProgress({ ...p, version: 2 })).toBe(false);
  expect(advance(initialProgress(), { type: 'ready' }).memorization.ready).toBe(false);
});

test('a hint before the first choice never becomes independent evidence', () => {
  expect(errorCode({ message: 'Server Error', data: 'SAVE_CONFLICT' })).toBe('SAVE_CONFLICT');
  let p = start.reduce(advance, initialProgress());
  p = advance(p, { type: 'travel' });
  const independent = advance(p, { type: 'transfer', choice: 'salam' });
  expect(transferEvidence(independent)).toContain('دون تلميح');
  p = advance(p, { type: 'hint', topic: 'transfer' });
  p = advance(p, { type: 'transfer', choice: 'salam' });
  expect(transferEvidence(p)).toContain('بعد تلميح');
  expect(advance(p, { type: 'return' }).transfer).toEqual(p.transfer);
});

test('walking stays out of the bench and library and can reach every collection point', () => {
  const points = [{ x: 480, y: 640 }, { x: 680, y: 640 }, { x: 335, y: 715 }, { x: 1070, y: 640 }];
  for (const to of points) {
    const path = route({ x: 240, y: 680 }, to, 'square');
    expect(path.length).toBeGreaterThan(0);
    expect(path.every(p => walkable(p.x, p.y, 'square'))).toBe(true);
  }
  expect(route({ x: 240, y: 680 }, { x: 500, y: 500 }, 'square')).toEqual([]);
});

test('server enforces household ownership, parent sessions, idempotency and revision conflicts', async () => {
  const t = convexTest(schema, modules);
  const owner = await t.run(ctx => ctx.db.insert('users', { email: 'one@example.test' }));
  const other = await t.run(ctx => ctx.db.insert('users', { email: 'two@example.test' }));
  const subject = `${owner}|session-one`, otherSubject = `${other}|session-two`;
  const token = 'a'.repeat(64), otherToken = 'b'.repeat(64);
  await t.run(async ctx => {
    await ctx.db.insert('parentSessions', { owner, subject, tokenHash: await sha256(token), expiresAt: Date.now() + 60_000 });
    await ctx.db.insert('parentSessions', { owner: other, subject: otherSubject, tokenHash: await sha256(otherToken), expiresAt: Date.now() + 60_000 });
  });
  const one = t.withIdentity({ subject }), two = t.withIdentity({ subject: otherSubject });
  const args = { parentToken: token, localId: 'child-one', name: 'نبتة', settings: initialSettings(), progress: initialProgress(), review: {} };
  await expect(t.mutation(api.game.create, args)).rejects.toThrow('PARENT_AUTH_REQUIRED');
  const child = (await one.mutation(api.game.create, args))!;
  expect((await one.mutation(api.game.create, args))!._id).toBe(child._id);
  const second = (await one.mutation(api.game.create, { ...args, localId: 'child-two', name: 'غيمة' }))!;
  await expect(two.query(api.game.get, { childId: child._id })).rejects.toThrow('NOT_FOUND');
  await expect(two.mutation(api.game.confirm, { childId: child._id, parentToken: otherToken, kind: 'recitation' })).rejects.toThrow('NOT_FOUND');
  await expect(two.mutation(api.game.remove, { childId: child._id, parentToken: otherToken })).rejects.toThrow('NOT_FOUND');
  await expect(two.mutation(api.game.updateSettings, { childId: child._id, parentToken: otherToken, settings: initialSettings(), name: 'x' })).rejects.toThrow('NOT_FOUND');
  const save = { childId: child._id, revision: 0, operationId: 'save-1', actions: start };
  await expect(two.mutation(api.game.apply, save)).rejects.toThrow('NOT_FOUND');
  const result = (await one.mutation(api.game.apply, save))!;
  expect(result.revision).toBe(1);
  expect(result.progress.flag).toBe('aqua');
  expect(result.review.recitedAt).toBeUndefined();
  expect((await one.mutation(api.game.apply, save))!.revision).toBe(1);
  await expect(one.mutation(api.game.apply, { ...save, operationId: 'save-stale' })).rejects.toThrow('SAVE_CONFLICT');
  await expect(one.mutation(api.game.apply, { ...save, revision: 1, operationId: 'forged', actions: [{ type: 'confirm', recitedAt: 1 } as never] })).rejects.toThrow();
  await expect(one.mutation(api.game.confirm, { childId: child._id, parentToken: '', kind: 'recitation' })).rejects.toThrow('PARENT_AUTH_REQUIRED');
  await expect(t.withIdentity({ subject: `${owner}|another-session` }).mutation(api.game.confirm,
    { childId: child._id, parentToken: token, kind: 'recitation' })).rejects.toThrow('PARENT_AUTH_REQUIRED');
  const confirmed = (await one.mutation(api.game.confirm, { childId: child._id, parentToken: token, kind: 'recitation', needsHelp: true, reviewOn: '2026-10-10' }))!;
  expect(confirmed.review.recitedAt).toBeGreaterThan(0);
  expect(confirmed.confirmedBy).toBe(owner);
  expect((await one.query(api.game.get, { childId: second._id })).review.recitedAt).toBeUndefined();
  const later = (await one.mutation(api.game.apply, { ...save, revision: 1, operationId: 'save-2', actions: [{ type: 'ready' }] }))!;
  expect(later.review).toEqual(confirmed.review);
  await one.mutation(api.parents.lock, {});
  await expect(one.mutation(api.game.confirm, { childId: child._id, parentToken: token, kind: 'practice' })).rejects.toThrow('PARENT_AUTH_REQUIRED');
  const expired = 'c'.repeat(64);
  await t.run(async ctx => { await ctx.db.insert('parentSessions', { owner, subject, tokenHash: await sha256(expired), expiresAt: Date.now() - 1 }); });
  await expect(one.mutation(api.game.remove, { childId: child._id, parentToken: expired })).rejects.toThrow('PARENT_AUTH_REQUIRED');
});
