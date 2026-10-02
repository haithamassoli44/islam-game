import React, { useEffect, useRef, type ReactNode } from 'react';
import { art, characterNames, type Character } from './art';

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    leaf: <><path d="M19 3C8 2 2 8 5 16c8 3 14-3 14-13Z"/><path d="M4 21 16 8m-6 6v-4m4 0h4"/></>,
    book: <><path d="M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Z"/><path d="M12 5v16"/></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15m6-12v15"/></>,
    home: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/></>,
    flag: <><path d="M5 21V3m0 1h13l-3 4 3 4H5"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/></>,
    sound: <><path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
    mute: <><path d="m11 4-6 5H2v6h3l6 5Zm5 5 5 6m0-6-5 6"/></>,
    arrow: <><path d="M19 12H5m6-6-6 6 6 6"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    clip: <><path d="m10 3 5 2-4 15-5-2Zm4 1 4 1-4 15-4-1"/><path d="m7 12 8 2"/></>,
    close: <><path d="m6 6 12 12M6 18 18 6"/></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.leaf}</svg>;
}

export function Portrait({ character, className = '' }: { character: Character; className?: string }) {
  return <span className={`portrait ${className}`} role="img" aria-label={characterNames[character]} style={{ backgroundImage: `url(${art[character]})` }} />;
}

export function Modal({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} aria-label={title} className={`modal ${wide ? 'wide' : ''}`} onCancel={e => { e.preventDefault(); close(); }}>
    <header className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="إغلاق" onClick={close}><Icon name="close" /></button></header>
    {children}
  </dialog>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{children}</p>;
}
