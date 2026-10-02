export const CONTENT_VERSION = 1;
export const stages = ['bag', 'arrival', 'greeting', 'clips', 'placement', 'invitation', 'explore'] as const;
export type Stage = typeof stages[number];
export type Bag = 'aqua' | 'blue';
export type Flag = 'apricot' | 'aqua';
export type Topic = 'greeting' | 'clips' | 'path' | 'transfer';
export type GreetingChoice = 'salam' | 'bag' | 'start';
export type TransferChoice = 'salam' | 'path' | 'bag' | 'skip';
export type Settings = {
  presentation: 'listen' | 'both' | 'read';
  assistance: 'guided' | 'on-demand' | 'independent';
  reducedMotion: boolean;
  muted: boolean;
};
export type Progress = {
  version: 1;
  stage: Stage;
  location: 'square' | 'bridge';
  bag: Bag;
  flag: Flag | null;
  clips: number[];
  leavesCleared: boolean;
  sign: 'blocked' | 'side' | null;
  firstPlacement: 'blocked' | 'side' | null;
  greetingFirst: GreetingChoice | null;
  hints: Record<Topic, boolean>;
  transfer: { first: TransferChoice | null; greeted: boolean; done: boolean };
  memorization: { step: number; practiced: boolean; ready: boolean };
};
export type Review = {
  recitedAt?: number;
  needsHelp?: boolean;
  practiceAt?: number;
  reviewOn?: string;
};
export type GameAction =
  | { type: 'bag'; color: Bag }
  | { type: 'enter' }
  | { type: 'greet'; choice: GreetingChoice }
  | { type: 'hint'; topic: Topic }
  | { type: 'collect'; clip: number }
  | { type: 'leaves' }
  | { type: 'place'; position: 'blocked' | 'side' }
  | { type: 'flag'; color: Flag }
  | { type: 'travel' }
  | { type: 'return' }
  | { type: 'transfer'; choice: TransferChoice }
  | { type: 'practice'; step: number }
  | { type: 'ready' }
  | { type: 'preferences'; settings: Settings };

export function initialProgress(): Progress {
  return {
    version: 1, stage: 'bag', location: 'square', bag: 'aqua', flag: null,
    clips: [], leavesCleared: false, sign: null, firstPlacement: null,
    greetingFirst: null, hints: { greeting: false, clips: false, path: false, transfer: false },
    transfer: { first: null, greeted: false, done: false },
    memorization: { step: 0, practiced: false, ready: false },
  };
}

export function initialSettings(): Settings {
  return { presentation: 'read', assistance: 'on-demand', reducedMotion: false, muted: false };
}

// The same transitions run locally and on the server. Replays never award a second flag.
export function advance(current: Progress, action: GameAction): Progress {
  const p = structuredClone(current);
  switch (action.type) {
    case 'bag':
      p.bag = action.color;
      if (p.stage === 'bag') p.stage = 'arrival';
      break;
    case 'enter':
      if (p.stage === 'arrival') p.stage = 'greeting';
      break;
    case 'greet':
      if (p.stage !== 'greeting') break;
      p.greetingFirst ??= action.choice;
      if (action.choice === 'salam') p.stage = 'clips';
      else p.hints.greeting = true;
      break;
    case 'hint': {
      const available = { greeting: p.stage === 'greeting', clips: p.stage === 'clips',
        path: p.stage === 'placement', transfer: p.location === 'bridge' && !p.transfer.done };
      if (available[action.topic]) p.hints[action.topic] = true;
      break;
    }
    case 'collect':
      if (p.stage === 'clips' && [0, 1, 2].includes(action.clip) && !p.clips.includes(action.clip)) {
        p.clips.push(action.clip);
        p.clips.sort();
        if (p.clips.length === 3) p.stage = 'placement';
      }
      break;
    case 'leaves': p.leavesCleared = true; break;
    case 'place':
      if (p.stage !== 'placement') break;
      p.firstPlacement ??= action.position;
      p.sign = action.position;
      if (action.position === 'side') p.stage = 'invitation';
      break;
    case 'flag':
      if (p.stage === 'invitation' || p.stage === 'explore') {
        p.flag = action.color;
        p.stage = 'explore';
      }
      break;
    case 'travel':
      if (p.stage === 'explore') p.location = 'bridge';
      break;
    case 'return': p.location = 'square'; break;
    case 'transfer':
      if (p.location !== 'bridge' || p.transfer.done) break;
      p.transfer.first ??= action.choice;
      if (action.choice === 'salam') { p.transfer.greeted = true; p.transfer.done = true; }
      else if (action.choice === 'skip') p.transfer.done = true;
      else p.hints.transfer = true;
      break;
    case 'practice':
      if (Number.isInteger(action.step) && action.step >= 1 && action.step <= 5) {
        p.memorization.step = action.step;
        p.memorization.practiced = true;
      }
      break;
    case 'ready':
      if (p.memorization.practiced) p.memorization.ready = true;
      break;
  }
  return p;
}

export function transferEvidence(p: Progress): string {
  if (!p.transfer.first && !p.hints.transfer && !p.transfer.done) return 'لم نجرب اللقاء الجديد بعد';
  if (p.transfer.greeted) return p.transfer.first === 'salam' && !p.hints.transfer
    ? 'بدأ اللقاء الجديد بالسلام دون تلميح' : 'جرّب السلام بعد تلميح في اللقاء الجديد';
  return 'لم يظهر استخدام السلام في هذا اللقاء بعد';
}

export function pathEvidence(p: Progress): string {
  if (!p.firstPlacement) return 'لا توجد ملاحظة عن الممر بعد';
  if (p.sign === 'blocked') return 'جرّب موضعًا يسد الممر؛ الإصلاح متاح';
  return p.firstPlacement === 'side' ? 'وضع اللوحة مع إبقاء الممر مفتوحًا من أول محاولة'
    : `نقل اللوحة وأبقى الممر مفتوحًا${p.hints.path ? ' بعد تلميح' : ' بعد مشاهدة العربة'}`;
}

export function validSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') return false;
  const s = value as Settings;
  return ['listen', 'both', 'read'].includes(s.presentation)
    && ['guided', 'on-demand', 'independent'].includes(s.assistance)
    && typeof s.reducedMotion === 'boolean' && typeof s.muted === 'boolean';
}

export function validAction(value: unknown): value is GameAction {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  switch (a.type) {
    case 'bag': return ['aqua', 'blue'].includes(String(a.color));
    case 'greet': return ['salam', 'bag', 'start'].includes(String(a.choice));
    case 'hint': return ['greeting', 'clips', 'path', 'transfer'].includes(String(a.topic));
    case 'collect': return [0, 1, 2].includes(a.clip as number);
    case 'place': return ['blocked', 'side'].includes(String(a.position));
    case 'flag': return ['apricot', 'aqua'].includes(String(a.color));
    case 'transfer': return ['salam', 'path', 'bag', 'skip'].includes(String(a.choice));
    case 'practice': return Number.isInteger(a.step) && (a.step as number) >= 1 && (a.step as number) <= 5;
    case 'preferences': return validSettings(a.settings);
    case 'enter': case 'leaves': case 'travel': case 'return': case 'ready': return true;
    default: return false;
  }
}

export function validProgress(value: unknown): value is Progress {
  if (!value || typeof value !== 'object') return false;
  const p = value as Progress;
  if (p.version !== 1 || !stages.includes(p.stage) || !['square', 'bridge'].includes(p.location)
    || !['aqua', 'blue'].includes(p.bag) || ![null, 'apricot', 'aqua'].includes(p.flag)
    || !Array.isArray(p.clips) || p.clips.length > 3 || new Set(p.clips).size !== p.clips.length
    || p.clips.some(id => ![0, 1, 2].includes(id)) || typeof p.leavesCleared !== 'boolean'
    || ![null, 'blocked', 'side'].includes(p.sign) || ![null, 'blocked', 'side'].includes(p.firstPlacement)
    || ![null, 'salam', 'bag', 'start'].includes(p.greetingFirst)
    || !p.hints || ['greeting', 'clips', 'path', 'transfer'].some(k => typeof p.hints[k as Topic] !== 'boolean')
    || !p.transfer || ![null, 'salam', 'path', 'bag', 'skip'].includes(p.transfer.first)
    || typeof p.transfer.greeted !== 'boolean' || typeof p.transfer.done !== 'boolean'
    || !p.memorization || !Number.isInteger(p.memorization.step) || p.memorization.step < 0 || p.memorization.step > 5
    || typeof p.memorization.practiced !== 'boolean' || typeof p.memorization.ready !== 'boolean') return false;
  const index = stages.indexOf(p.stage);
  return (index < 4 || p.clips.length === 3)
    && (index < 5 || p.sign === 'side') && (index < 6 || p.flag !== null)
    && (p.location !== 'bridge' || p.stage === 'explore')
    && (!p.transfer.greeted || (p.transfer.done && p.transfer.first !== null))
    && (!p.memorization.ready || p.memorization.practiced);
}
