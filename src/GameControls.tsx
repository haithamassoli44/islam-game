import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';

export type GameControlsProps = {
  disabled: boolean;
  resetKey: string;
  onMove: (x: number, y: number) => void;
  onRun: (running: boolean) => void;
  onJump: () => void;
  onReset: () => void;
};

const movementKeys = new Set(['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'ArrowUp', 'KeyW', 'ArrowDown', 'KeyS']);
const editable = (target: EventTarget | null) => target instanceof Element
  && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"]'));
const nativeSpace = (target: EventTarget | null) => target instanceof Element
  && Boolean(target.closest('button, [role="button"], summary, a[href]'));

export function GameControls(props: GameControlsProps) {
  const live = useRef(props); live.current = props;
  const joystick = useRef<HTMLButtonElement>(null);
  const input = useRef({ keys: new Set<string>(), pointer: null as number | null, x: 0, y: 0, run: false });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [running, setRunning] = useState(false);
  const instructions = useId();

  function publish() {
    const state = input.current;
    let x = state.x, y = state.y;
    if (!x && !y) {
      x = Number(state.keys.has('ArrowRight') || state.keys.has('KeyD')) - Number(state.keys.has('ArrowLeft') || state.keys.has('KeyA'));
      y = Number(state.keys.has('ArrowDown') || state.keys.has('KeyS')) - Number(state.keys.has('ArrowUp') || state.keys.has('KeyW'));
      const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
    }
    const run = !live.current.disabled && (state.run || state.keys.has('ShiftLeft') || state.keys.has('ShiftRight'));
    setRunning(run);
    live.current.onMove(live.current.disabled ? 0 : x, live.current.disabled ? 0 : y);
    live.current.onRun(run);
  }

  function reset(settle: boolean) {
    const state = input.current, pointer = state.pointer;
    state.pointer = null; state.keys.clear(); state.x = 0; state.y = 0; state.run = false;
    if (pointer !== null && joystick.current?.hasPointerCapture(pointer)) joystick.current.releasePointerCapture(pointer);
    setKnob({ x: 0, y: 0 }); setRunning(false);
    live.current.onMove(0, 0); live.current.onRun(false);
    if (settle) live.current.onReset();
  }

  useEffect(() => { reset(props.disabled); }, [props.disabled, props.resetKey]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (live.current.disabled || event.ctrlKey || event.altKey || event.metaKey || editable(event.target)) return;
      const code = event.code;
      if (code === 'Space') {
        if (nativeSpace(event.target) && event.target !== joystick.current) return;
        event.preventDefault();
        if (!event.repeat && !input.current.keys.has(code)) live.current.onJump();
        input.current.keys.add(code);
      } else if (movementKeys.has(code) || code === 'ShiftLeft' || code === 'ShiftRight') {
        if (movementKeys.has(code)) event.preventDefault();
        input.current.keys.add(code); publish();
      }
    };
    const keyup = (event: KeyboardEvent) => {
      if (input.current.keys.delete(event.code)) {
        if (movementKeys.has(event.code) && !editable(event.target)) event.preventDefault();
        publish();
      }
    };
    const blur = () => reset(true);
    const visibility = () => { if (document.hidden) reset(true); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility);
      reset(true);
    };
  }, []);

  function moveJoystick(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerId !== input.current.pointer) return;
    const rect = event.currentTarget.getBoundingClientRect(), radius = rect.width * .34;
    const x = (event.clientX - rect.left - rect.width / 2) / radius;
    const y = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y), scale = 1 / Math.max(1, length);
    setKnob({ x: x * scale * radius, y: y * scale * radius });
    const strength = length > .12 ? (Math.min(1, length) - .12) / .88 / length : 0;
    input.current.x = x * strength; input.current.y = y * strength; publish();
  }

  function releaseJoystick(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerId !== input.current.pointer) return;
    input.current.pointer = null; input.current.x = 0; input.current.y = 0;
    setKnob({ x: 0, y: 0 }); publish();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <div className="game-controls" role="group" aria-label="أزرار التحكم" aria-describedby={instructions}>
    <div className="movement-control">
      <button ref={joystick} type="button" className="movement-joystick" aria-label="عجلة الحركة" aria-describedby={instructions}
        disabled={props.disabled} onPointerDown={event => {
          if (live.current.disabled || input.current.pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
          event.preventDefault(); input.current.pointer = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true }); moveJoystick(event);
        }} onPointerMove={moveJoystick} onPointerUp={releaseJoystick} onPointerCancel={releaseJoystick} onLostPointerCapture={releaseJoystick}>
        <svg className="joystick-directions" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m53 15 7-7 7 7m-14 90 7 7 7-7M15 53l-7 7 7 7m90-14 7 7-7 7" />
        </svg>
        <span className="joystick-knob" aria-hidden="true" style={{ transform: `translate(-50%, -50%) translate(${knob.x}px, ${knob.y}px)` }} />
      </button>
      <span className="control-label">تحرّك</span>
    </div>
    <p id={instructions} className="control-instructions">اسحب العجلة أو استخدم <bdi>WASD</bdi> والأسهم.<br /><bdi>Space</bdi> للقفز، و<bdi>Shift</bdi> للركض.</p>
    <div className="action-controls">
      <button type="button" className="run-control" disabled={props.disabled} aria-pressed={running}
        onClick={() => { input.current.run = !input.current.run; publish(); }}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="15" cy="4" r="2" /><path d="m12 8 4 4 4-1m-8-3-4 4-4 1m8-5-2 7 5 3 2 4m-7-7-3 5H3" />
        </svg>ركض
      </button>
      <button type="button" className="jump-control" disabled={props.disabled} onPointerDown={event => {
        if (live.current.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault(); live.current.onJump();
      }} onClick={event => { if (!live.current.disabled && event.detail === 0) live.current.onJump(); }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 17V3m-5 5 5-5 5 5M4 18v3h16v-3" />
        </svg>اقفز
      </button>
    </div>
  </div>;
}
