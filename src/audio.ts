import { audio } from '../shared/content';

let current: HTMLAudioElement | undefined;
export function stopAudio() { current?.pause(); current = undefined; }
export async function playAudio(key: string, muted: boolean) {
  stopAudio();
  if (muted || !audio[key]) return false;
  current = new Audio(`${import.meta.env.BASE_URL}${audio[key]}`);
  try { await current.play(); return true; } catch { stopAudio(); return false; }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio(); });
