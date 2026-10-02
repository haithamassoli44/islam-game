import { v } from 'convex/values';

const bag = v.union(v.literal('aqua'), v.literal('blue'));
const flag = v.union(v.literal('apricot'), v.literal('aqua'));
const position = v.union(v.literal('blocked'), v.literal('side'));
const greeting = v.union(v.literal('salam'), v.literal('bag'), v.literal('start'));
const transfer = v.union(v.literal('salam'), v.literal('path'), v.literal('bag'), v.literal('skip'));
const topic = v.union(v.literal('greeting'), v.literal('clips'), v.literal('path'), v.literal('transfer'));
export const settings = v.object({
  presentation: v.union(v.literal('listen'), v.literal('both'), v.literal('read')),
  assistance: v.union(v.literal('guided'), v.literal('on-demand'), v.literal('independent')),
  reducedMotion: v.boolean(), muted: v.boolean(),
});
export const progress = v.object({
  version: v.literal(1),
  stage: v.union(v.literal('bag'), v.literal('arrival'), v.literal('greeting'), v.literal('clips'),
    v.literal('placement'), v.literal('invitation'), v.literal('explore')),
  location: v.union(v.literal('square'), v.literal('bridge')),
  bag, flag: v.union(v.null(), flag), clips: v.array(v.number()), leavesCleared: v.boolean(),
  sign: v.union(v.null(), position), firstPlacement: v.union(v.null(), position),
  greetingFirst: v.union(v.null(), greeting),
  hints: v.object({ greeting: v.boolean(), clips: v.boolean(), path: v.boolean(), transfer: v.boolean() }),
  transfer: v.object({ first: v.union(v.null(), transfer), greeted: v.boolean(), done: v.boolean() }),
  memorization: v.object({ step: v.number(), practiced: v.boolean(), ready: v.boolean() }),
});
export const review = v.object({ recitedAt: v.optional(v.number()), needsHelp: v.optional(v.boolean()),
  practiceAt: v.optional(v.number()), reviewOn: v.optional(v.string()) });
export const gameAction = v.union(
  v.object({ type: v.literal('bag'), color: bag }),
  v.object({ type: v.literal('enter') }),
  v.object({ type: v.literal('greet'), choice: greeting }),
  v.object({ type: v.literal('hint'), topic }),
  v.object({ type: v.literal('collect'), clip: v.number() }),
  v.object({ type: v.literal('leaves') }),
  v.object({ type: v.literal('place'), position }),
  v.object({ type: v.literal('flag'), color: flag }),
  v.object({ type: v.literal('travel') }),
  v.object({ type: v.literal('return') }),
  v.object({ type: v.literal('transfer'), choice: transfer }),
  v.object({ type: v.literal('practice'), step: v.number() }),
  v.object({ type: v.literal('ready') }),
  v.object({ type: v.literal('preferences'), settings }),
);
