import nawwar from '../assets/runtime/nawwar.webp';
import lamha from '../assets/runtime/lamha.webp';
import rukn from '../assets/runtime/rukn.webp';
import wariq from '../assets/runtime/wariq.webp';
import world from '../assets/runtime/world.jpg';
import opening from '../assets/runtime/opening.jpg';

export const art = { nawwar, lamha, rukn, wariq, world, opening };
export type Character = 'nawwar' | 'lamha' | 'rukn' | 'wariq';
export const characterNames = { nawwar: 'نَوّار', lamha: 'لَمْحة', rukn: 'رُكْن', wariq: 'وَريق' };
// One standing pose per character. View sheets are never played as animation frames.
export const aspect = { nawwar: 395 / 552, lamha: 355 / 550, rukn: 450 / 540, wariq: 396 / 530 };
