import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { art, aspect, type Character } from './art';
import { walkable, route, spots, WORLD_WIDTH, WORLD_HEIGHT } from './world';
import type { Progress, Settings } from '../shared/game';
import { Icon } from './ui';

const svgTexture = (body: string, width = 100, height = 100) => `data:image/svg+xml;base64,${btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
)}`;

class RiwaqScene extends Phaser.Scene {
  progress!: Progress;
  settings!: Settings;
  arrived!: () => void;
  ready!: () => void;
  failed!: () => void;
  player!: Phaser.GameObjects.Container;
  body!: Phaser.GameObjects.Image;
  background!: Phaser.GameObjects.Image;
  props!: Phaser.GameObjects.Group;
  lastLocation = '';
  busy = false;

  preload() {
    this.load.image('square', `${import.meta.env.BASE_URL}art/seed-square-background.jpg`);
    this.load.image('bridge', `${import.meta.env.BASE_URL}art/bridge-path.jpg`);
    for (const name of ['nawwar', 'lamha', 'rukn', 'wariq'] as Character[]) this.load.image(name, art[name]);
    this.load.svg('clip', svgTexture('<path d="m30 12 20 4-16 70-20-4Z" fill="#d5aa6c" stroke="#69452d" stroke-width="4"/>'
      + '<path d="m51 16 17 4-16 70-17-4Z" fill="#f0cc8c" stroke="#69452d" stroke-width="4"/><path d="m29 48 30 7" stroke="#69452d" stroke-width="6"/>'));
    this.load.svg('sign', svgTexture('<path d="M24 42v56M76 42v56" stroke="#794c32" stroke-width="8"/><rect x="3" y="8" width="94" height="55" rx="8" fill="#d6ac70" stroke="#794c32" stroke-width="4"/><path d="M16 25h68M16 47h68" stroke="#bf915a" stroke-width="2"/>'));
    this.load.svg('basket', svgTexture('<ellipse cx="50" cy="39" rx="42" ry="14" fill="#65442f"/><path d="m8 38 10 50q32 15 64 0l10-50q-42 25-84 0Z" fill="#ba8d55" stroke="#755437" stroke-width="4"/><path d="M22 51h56M25 66h50M29 80h42M34 48v42M50 51v44M66 48v42" stroke="#e1b77b" stroke-width="3"/><path d="M12 35q38-52 76 0" fill="none" stroke="#997143" stroke-width="8"/>'));
    this.load.svg('leaves', svgTexture('<path d="M8 70q7-44 43-35Q45 72 8 70ZM38 82q5-42 48-25Q70 91 38 82ZM34 39Q33 1 64 12q3 29-30 27Z" fill="#a4a356" stroke="#677142" stroke-width="3"/>'));
    this.load.svg('cart', svgTexture('<path d="M13 20h73v47H13Z" fill="#caa068" stroke="#725436" stroke-width="4"/><path d="M17 32h65M17 47h65M85 37l12-14" fill="none" stroke="#725436" stroke-width="5"/><circle cx="25" cy="79" r="12" fill="#715039"/><circle cx="73" cy="79" r="12" fill="#715039"/>'));
    this.load.svg('box', svgTexture('<rect x="12" y="25" width="76" height="58" rx="9" fill="#e6d3a5" stroke="#8d7653" stroke-width="4"/><path d="M12 43h76M42 26v18" stroke="#8d7653" stroke-width="4"/><path d="M23 13h43v20H23Z" fill="#f7e8c8" stroke="#8d7653" stroke-width="3"/>'));
    this.load.on('loaderror', (file: Phaser.Loader.File) => { console.error('Riwaq asset failed:', file.key); this.failed(); });
  }

  create() {
    this.background = this.add.image(600, 400, 'square').setDisplaySize(1200, 800);
    for (const name of ['nawwar', 'lamha', 'rukn', 'wariq'] as Character[]) {
      const texture = this.textures.get(name);
      const source = texture.getSourceImage();
      texture.add('standing', 0, 0, 0, source.width, source.height);
    }
    this.props = this.add.group();
    const shadow = this.add.ellipse(0, -2, 90, 20, 0x423b2b, 0.2);
    this.body = this.add.image(0, 0, 'nawwar', 'standing').setOrigin(.5, 1).setDisplaySize(138, 192);
    this.player = this.add.container(245, 680, [shadow, this.body]).setDepth(800);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (walkable(pointer.x, pointer.y, this.progress.location)) this.go(pointer.x, pointer.y,
        () => { if (this.progress.stage === 'arrival') this.arrived(); });
    });
    this.refresh(); this.ready();
  }

  refresh() {
    if (!this.player) return;
    const p = this.progress;
    if (this.lastLocation !== p.location) {
      this.tweens.killAll(); this.busy = false;
      this.background.setTexture(p.location).setDisplaySize(1200, 800);
      this.player.setPosition(p.location === 'bridge' ? 330 : 245, 680);
      this.lastLocation = p.location;
    }
    this.props.clear(true, true);
    const image = (x: number, y: number, key: string, w: number, h: number) => {
      const item = this.add.image(x, y, key).setOrigin(.5, 1).setDisplaySize(w, h).setDepth(y);
      this.props.add(item); return item;
    };
    const friend = (name: Character, x: number, y: number, size: number) => {
      const shadow = this.add.ellipse(x, y - 3, size * .62, 16, 0x423b2b, .18).setDepth(y - 1);
      this.props.add(shadow);
      const item = this.add.image(x, y, name, 'standing').setOrigin(.5, 1)
        .setDisplaySize(size * aspect[name], size).setDepth(y);
      this.props.add(item);
    };
    if (p.location === 'square') {
      friend('rukn', 810, 580, 175); friend('lamha', 980, 662, 145); friend('wariq', 1080, 540, 150);
      image(152, 655, 'basket', 95, 95);
      image(1080, 746, 'box', 75, 65);
      if (!p.leavesCleared) image(145, 773, 'leaves', 95, 65);
      if (p.stage === 'clips') [0, 1, 2].forEach(id => {
        if (!p.clips.includes(id)) { const s = spots[`clip${id}`]; image(s.x, s.y + 15, 'clip', 55, 55).setAngle(id * 25 - 18); }
      });
      if (p.sign) {
        const s = spots[p.sign]; image(s.x, s.y + 15, 'sign', 125, 120);
        if (p.sign === 'blocked') image(760, 753, 'cart', 100, 100);
      }
    } else friend('lamha', 820, 685, 180);
    this.player.list.filter(c => c instanceof Phaser.GameObjects.Graphics).forEach(c => c.destroy());
    if (p.bag === 'blue') {
      const bag = this.add.graphics();
      bag.fillStyle(0x527faa).fillRoundedRect(20, -75, 44, 46, 13);
      bag.lineStyle(2, 0x355c81).strokeRoundedRect(20, -75, 44, 46, 13);
      bag.fillStyle(0x759bc0).fillRoundedRect(22, -73, 40, 22, 10);
      bag.fillStyle(0xe7c274).fillCircle(43, -51, 4);
      this.player.add(bag);
    }
    if (p.flag) {
      const graphics = this.add.graphics({ x: 30, y: -85 });
      graphics.lineStyle(3, 0x594731).lineBetween(0, 20, 0, -25);
      graphics.fillStyle(p.flag === 'aqua' ? 0x3f938e : 0xf2ad64).fillTriangle(0, -25, 29, -16, 0, -4);
      this.player.add(graphics);
    }
    this.body.clearTint();
  }

  go(x: number, y: number, complete: () => void = () => {}) {
    if (!this.player || this.busy) return;
    const path = route(this.player, { x, y }, this.progress.location);
    if (!path.length) { complete(); return; }
    if (this.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.player.setPosition(path.at(-1)!.x, path.at(-1)!.y); complete(); return;
    }
    this.busy = true;
    const next = () => {
      const point = path.shift();
      if (!point) { this.busy = false; this.body.setAngle(0); complete(); return; }
      this.tweens.add({ targets: this.player, ...point, duration: 115, onUpdate: () => {
        this.body.setAngle(Math.sin(this.time.now / 65) * 3); this.player.setDepth(this.player.y);
      }, onComplete: next });
    };
    next();
  }
}

export function GameView({ progress, settings, childId, interact, arrived, paused }: {
  progress: Progress; settings: Settings; childId: string; interact: (id: string) => void; arrived: () => void; paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RiwaqScene | null>(null);
  const live = useRef({ progress, settings, arrived }); live.current = { progress, settings, arrived };
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setLoad('loading'); const s = new RiwaqScene('riwaq');
    s.progress = live.current.progress; s.settings = live.current.settings;
    s.arrived = () => live.current.arrived(); s.ready = () => setLoad('ready'); s.failed = () => setLoad('error');
    scene.current = s;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current!, width: WORLD_WIDTH, height: WORLD_HEIGHT,
      backgroundColor: '#c1d4ac', scene: s, audio: { noAudio: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true },
      fps: { target: 60, forceSetTimeOut: false } });
    return () => { scene.current = null; game.destroy(true); };
  }, [childId, retry]);
  useEffect(() => { const s = scene.current; if (s) { s.progress = progress; s.settings = settings; s.refresh(); } }, [progress, settings]);
  useEffect(() => { const s = scene.current; if (s?.sys.isActive()) { if (paused) s.scene.pause(); }
    else if (s?.sys.isPaused() && !paused) s.scene.resume(); }, [paused, load]);
  const p = progress;
  const targets = p.location === 'bridge' ? [{ id: 'lamha', x: 820, y: 505, label: 'لَمْحة' }]
    : [spots.rukn, spots.lamha, spots.wariq, spots.basket, spots.leaves, spots.box].map((s, i) => ({ ...s, id: ['rukn', 'lamha', 'wariq', 'basket', 'leaves', 'box'][i] }))
      .filter(s => s.id !== 'leaves' || !p.leavesCleared);
  if (p.location === 'square') targets.forEach(t => { if (['rukn', 'lamha', 'wariq'].includes(t.id)) t.y -= 145; });
  if (p.stage === 'clips' && p.location === 'square') [0, 1, 2].forEach(id => {
    if (!p.clips.includes(id)) targets.push({ ...spots[`clip${id}`], id: `clip${id}` });
  });
  if (p.stage === 'placement') ['blocked', 'side'].forEach(id => targets.push({ ...spots[id], id }));
  const hit = (id: string) => {
    if (paused || load !== 'ready') return;
    const s = p.location === 'bridge' ? { x: 700, y: 680 } : spots[id];
    let to = s ? { x: s.x, y: Math.max(640, s.y) } : { x: 800, y: 650 };
    if (!walkable(to.x, to.y, p.location)) to = { ...to, y: 680 };
    scene.current?.go(to.x, to.y, () => interact(id));
  };
  return <div className="world-frame" role="group" aria-label={p.location === 'square' ? 'ساحة البذور' : 'طريق جسر القصب'}>
    <div ref={host} className="canvas-host" aria-hidden="true" />
    {load === 'ready' && targets.map(s => <button key={s.id} className={`hotspot ${s.id.startsWith('clip') ? 'collect' : ''}`}
      style={{ left: `${s.x / 12}%`, top: `${s.y / 8}%` }} aria-label={s.label} onClick={() => hit(s.id)} disabled={paused}>
      <Icon name={s.id.startsWith('clip') ? 'clip' : s.id === 'wariq' ? 'book' : s.id === 'side' || s.id === 'blocked' ? 'flag' : 'leaf'} size={18} />
      <span>{s.id.startsWith('clip') ? 'اجمع' : s.label}</span>
    </button>)}
    {load !== 'ready' && <div className="world-loading" role="status"><Icon name="leaf" size={40} />
      <p>{load === 'loading' ? 'نجهّز ساحة البذور…' : 'تعذّر تحميل الساحة. تحقق من الاتصال ثم أعد المحاولة.'}</p>
      {load === 'error' && <button onClick={() => setRetry(r => r + 1)}>أعد تحميل الساحة</button>}</div>}
    <div className="place-label"><Icon name={p.location === 'square' ? 'home' : 'map'} size={17} />{p.location === 'square' ? 'ساحة البذور' : 'طريق جسر القصب'}</div>
  </div>;
}
