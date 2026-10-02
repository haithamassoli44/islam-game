import { expect, test, vi } from 'vitest';
import { advance } from '../shared/game';
import { guestChild, loadStore, newChild, saveStore } from './storage';

test('guest play saves and resumes locally without credentials and respects profile limits', () => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  });
  try {
    const guest = guestChild([]);
    expect(guest.name).toBe('ضيف');
    expect(guest.owner).toBeUndefined();
    expect(guest.cloudId).toBeUndefined();
    expect(guest.sync).toBe('local');
    guest.progress = advance(guest.progress, { type: 'bag', color: 'blue' });
    guest.name = 'نبتة';
    const sibling = newChild('غيمة');
    expect(saveStore({ schema: 1, children: [guest, sibling] })).toBe(true);
    const loaded = loadStore();
    expect(loaded.error).toBe('');
    expect(loaded.data.pin).toBeUndefined();
    expect(guestChild(loaded.data.children)).toEqual(guest);
    expect(loaded.data.children[1]).toEqual(sibling);

    const claimed = { ...guest, owner: 'family', cloudId: 'cloud-child' };
    expect(guestChild([claimed]).id).not.toBe(guest.id);
    const full = Array.from({ length: 12 }, () => newChild('طفل'));
    expect(() => guestChild(full)).toThrow('١٢');
    expect(guestChild([guest, ...full.slice(1)])).toBe(guest);
    expect(guestChild(full.map(c => ({ ...c, owner: 'another-family' }))).guest).toBe(true);
  } finally { vi.unstubAllGlobals(); }
});
