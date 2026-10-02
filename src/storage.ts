import { initialProgress, initialSettings, validProgress, validSettings, validAction, type Progress, type Settings,
  type Review, type GameAction } from '../shared/game';

export type LocalChild = {
  id: string; name: string; settings: Settings; progress: Progress; review: Review;
  owner?: string; cloudId?: string; revision: number;
  guest?: boolean;
  pending: GameAction[]; operationId: string;
  sync: 'local' | 'pending' | 'saved' | 'error' | 'conflict';
};
export type LocalPin = { salt: string; hash: string; failures: number; lockedUntil: number };
export type Store = { schema: 1; children: LocalChild[]; pin?: LocalPin };
export const STORAGE_KEY = 'riwaq-v1';

export function newChild(name: string): LocalChild {
  return { id: crypto.randomUUID(), name: name.trim(), settings: initialSettings(), progress: initialProgress(),
    review: {}, revision: 0, pending: [], operationId: crypto.randomUUID(), sync: 'local' };
}

export function guestChild(children: LocalChild[]): LocalChild {
  const guest = children.find(c => c.guest && !c.owner && !c.cloudId);
  if (guest) return guest;
  if (children.filter(c => !c.owner).length >= 12) throw new Error('يمكن إنشاء ١٢ ملفًا محليًا. اختر ملفًا موجودًا للعب.');
  return { ...newChild('ضيف'), guest: true };
}

export function loadStore(): { data: Store; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: { schema: 1, children: [] }, error: '' };
    const data = JSON.parse(raw) as Store;
    if (data.schema !== 1 || !Array.isArray(data.children) || data.children.length > 100
      || new Set(data.children.map(c => c.id)).size !== data.children.length
      || data.children.some(c => !c || typeof c.id !== 'string' || typeof c.name !== 'string'
        || (c.guest !== undefined && typeof c.guest !== 'boolean')
        || !validProgress(c.progress) || !validSettings(c.settings) || !Array.isArray(c.pending) || c.pending.some(a => !validAction(a))
        || typeof c.operationId !== 'string' || !Number.isInteger(c.revision) || !c.review)) {
      throw new Error('INVALID_SAVE');
    }
    return { data, error: '' };
  } catch {
    return { data: { schema: 1, children: [] }, error: 'تعذّر قراءة التقدم المحفوظ. احتفظنا بالبيانات الأصلية؛ نزّلها قبل بدء ملف جديد.' };
  }
}

export function saveStore(data: Store): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export async function hashLocalPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 310_000 }, key, 256);
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export function exportSave(data?: Store) {
  const blob = new Blob([data ? JSON.stringify(data) : localStorage.getItem(STORAGE_KEY) ?? '{}'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'riwaq-backup.json'; link.click();
  URL.revokeObjectURL(url);
}
