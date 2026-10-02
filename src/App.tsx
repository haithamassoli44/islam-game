import React, { useEffect, useRef, useState } from 'react';
import type { Doc, Id } from '../convex/_generated/dataModel';
import { advance, type GameAction, type Progress, type Settings, type Topic } from '../shared/game';
import { salam, reply } from '../shared/content';
import { errorCode } from '../shared/errors';
import { art } from './art';
import { GameView } from './GameView';
import { Hifz } from './Hifz';
import { Parents, syncText } from './Parents';
import { Icon, Modal, Portrait, Field, Notice } from './ui';
import { loadStore, saveStore, newChild, hashLocalPin, exportSave, type LocalChild, type LocalPin, type Store } from './storage';
import { stopAudio } from './audio';
import type { Cloud } from './cloud';

type ModalName = 'parents' | 'gate' | 'login' | 'hifz' | 'map' | null;
const empty = loadStore();

function humanError(error: unknown) {
  const message = errorCode(error);
  if (message.includes('PARENT_AUTH_REQUIRED')) return 'انتهت جلسة الأهل. أغلق الدفتر وافتحه بكلمة المرور مرة أخرى.';
  if (message.includes('INVALID_CREDENTIALS') || message.includes('InvalidSecret') || message.includes('InvalidAccountId')) return 'تحقق من البريد وكلمة المرور، ثم أعد المحاولة.';
  if (message.includes('TooManyFailedAttempts')) return 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.';
  if (message.includes('PROFILE_LIMIT')) return 'يمكن للأسرة إنشاء ١٢ ملفًا في هذه النسخة.';
  return 'تعذّر تنفيذ الطلب. تحقق من الاتصال ثم أعد المحاولة؛ تبقى نسخة الجهاز محفوظة.';
}

function fromServer(record: Doc<'children'>): LocalChild {
  return { id: record.localId, cloudId: record._id, owner: record.owner, name: record.name, settings: record.settings,
    progress: record.progress as Progress, review: record.review, revision: record.revision,
    pending: [], operationId: crypto.randomUUID(), sync: 'saved' };
}

export default function App({ cloud }: { cloud?: Cloud }) {
  const [data, setData] = useState<Store>(empty.data);
  const dataRef = useRef(data); dataRef.current = data;
  const [loadError, setLoadError] = useState(empty.error);
  const corrupt = useRef(Boolean(empty.error));
  const [saveError, setSaveError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [parentToken, setParentToken] = useState<string | null>(null);
  const [parentUntil, setParentUntil] = useState(0);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [syncTick, setSyncTick] = useState(0);
  const syncing = useRef(false);
  const owner = cloud?.home?.owner;
  const children = data.children.filter(c => !c.owner || c.owner === owner);
  const child = children.find(c => c.id === selected);

  const commit = (next: Store) => {
    if (corrupt.current) { setSaveError('نزّل بيانات الجهاز الأصلية قبل استبدالها.'); return false; }
    dataRef.current = next;
    const saved = saveStore(next);
    setSaveError(saved ? '' : 'لم نتمكن من حفظ هذه الخطوة. حاول مرة أخرى قبل الخروج.');
    setData(next);
    return saved;
  };
  const edit = (id: string, fn: (child: LocalChild) => LocalChild) => commit({ ...dataRef.current,
    children: dataRef.current.children.map(c => c.id === id ? fn(c) : c) });
  const dispatch = (action: GameAction) => {
    if (!child) return;
    setMessage('');
    edit(child.id, c => ({ ...c, progress: advance(c.progress, action),
      ...(action.type === 'preferences' ? { settings: action.settings } : {}),
      pending: c.cloudId ? [...c.pending, action] : [], sync: c.cloudId ? (c.sync === 'conflict' ? 'conflict' : 'pending') : 'local' }));
  };

  useEffect(() => {
    if (!cloud?.home || !cloud.isAuthenticated || corrupt.current) return;
    const next = { ...dataRef.current, children: [...dataRef.current.children] };
    for (const record of cloud.home.children) {
      const index = next.children.findIndex(c => c.cloudId === record._id || (c.id === record.localId && !c.owner));
      const current = next.children[index];
      if (!current) next.children.push(fromServer(record));
      else next.children[index] = current.pending.length
        ? { ...current, cloudId: record._id, owner: record.owner, review: record.review, name: record.name }
        : fromServer(record);
    }
    // Never discard unsent changes when another device has deleted a profile.
    next.children = next.children.filter(c => c.owner !== cloud.home!.owner || !c.cloudId
      || cloud.home!.children.some(r => r._id === c.cloudId) || c.pending.length > 0);
    commit(next);
  }, [cloud?.home, cloud?.isAuthenticated]);

  useEffect(() => {
    if (!cloud?.isAuthenticated || !owner || syncing.current) return;
    const pending = data.children.find(c => c.owner === owner && c.cloudId && c.pending.length && c.sync === 'pending');
    if (!pending) return;
    const timer = window.setTimeout(async () => {
      syncing.current = true;
      const batch = pending.pending.slice(0, 100);
      try {
        const saved = await cloud.apply({ childId: pending.cloudId as Id<'children'>, revision: pending.revision,
          operationId: pending.operationId, actions: batch });
        if (!saved) throw new Error('SAVE_FAILED');
        edit(pending.id, c => {
          const remaining = c.pending.slice(batch.length);
          return { ...c, revision: saved.revision, progress: remaining.reduce(advance, saved.progress as Progress),
            settings: remaining.reduce((settings, a) => a.type === 'preferences' ? a.settings : settings, saved.settings),
            pending: remaining, operationId: crypto.randomUUID(), sync: remaining.length ? 'pending' : 'saved' };
        });
      } catch (e) { edit(pending.id, c => ({ ...c, sync: errorCode(e).includes('SAVE_CONFLICT') ? 'conflict' : 'error' })); }
      finally { syncing.current = false; setSyncTick(t => t + 1); }
    }, 450);
    return () => clearTimeout(timer);
  }, [data, owner, cloud?.isAuthenticated, syncTick]);

  const retrySync = () => {
    commit({ ...dataRef.current, children: dataRef.current.children.map(c => c.sync === 'error' ? { ...c, sync: 'pending' } : c) });
    setSyncTick(t => t + 1);
  };
  useEffect(() => { window.addEventListener('online', retrySync); return () => window.removeEventListener('online', retrySync); }, []);
  useEffect(() => {
    if (!parentUntil) return;
    const timer = window.setTimeout(() => { setParentToken(null); setParentUntil(0); setModal(m => m === 'parents' ? 'gate' : m); }, Math.max(0, parentUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [parentUntil]);
  useEffect(() => {
    const onHidden = () => { if (document.hidden) { setParentToken(null); setParentUntil(0); setModal(m => m === 'parents' ? 'gate' : m); } };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, []);
  useEffect(() => { setParentToken(null); setParentUntil(0); setPlaying(false); setSelected(null); }, [owner]);

  const parentClose = () => {
    setModal(null); setParentToken(null); setParentUntil(0);
    if (cloud?.isAuthenticated) void cloud.lock().catch(() => {});
  };
  const needParent = () => { stopAudio(); if (corrupt.current) { setNotice('نزّل بيانات الجهاز الأصلية، ثم اختر بدء سجل جديد من رسالة الاستعادة.'); return; }
    setModal(parentToken && parentUntil > Date.now() ? 'parents' : 'gate'); };
  const requireSession = () => { if (!parentToken || Date.now() >= parentUntil) throw new Error('انتهت جلسة الأهل. افتح الدفتر مرة أخرى.'); };
  const createChild = async (name: string) => {
    requireSession();
    if (!name.trim() || name.trim().length > 24) throw new Error('اختر اسمًا مستعارًا من ١ إلى ٢٤ حرفًا.');
    if (!cloud?.isAuthenticated && dataRef.current.children.filter(c => !c.owner).length >= 12) throw new Error('يمكن إنشاء ١٢ ملفًا محليًا في هذه النسخة.');
    let local = newChild(name);
    if (cloud?.isAuthenticated) {
      try {
        const server = await cloud.create({ parentToken: parentToken!, localId: local.id, name: local.name,
          settings: local.settings, progress: local.progress, review: local.review });
        if (!server) throw new Error('CREATE_FAILED'); local = fromServer(server);
      } catch (e) { throw new Error(humanError(e)); }
    }
    commit({ ...dataRef.current, children: [...dataRef.current.children.filter(c => c.id !== local.id), local] });
    setSelected(local.id);
  };
  const migrate = async (id: string) => {
    requireSession(); const local = dataRef.current.children.find(c => c.id === id);
    if (!cloud?.isAuthenticated || !local || local.cloudId) return;
    try {
      const server = await cloud.create({ parentToken: parentToken!, localId: local.id, name: local.name,
        settings: local.settings, progress: local.progress, review: local.review });
      if (!server) throw new Error('CREATE_FAILED'); edit(id, () => fromServer(server));
    } catch (e) { throw new Error(humanError(e)); }
  };
  const updateProfile = async (id: string, name: string, settings: Settings) => {
    requireSession(); const c = dataRef.current.children.find(c => c.id === id)!;
    if (c.cloudId && cloud) {
      try { await cloud.updateSettings({ childId: c.cloudId as Id<'children'>, parentToken: parentToken!, name, settings }); }
      catch (e) { throw new Error(humanError(e)); }
    }
    edit(id, c => ({ ...c, name: name.trim(), settings,
      pending: c.cloudId && c.pending.length ? [...c.pending, { type: 'preferences', settings }] : c.pending }));
  };
  const confirm = async (id: string, kind: 'recitation' | 'practice', needsHelp: boolean, reviewOn: string) => {
    requireSession(); const c = dataRef.current.children.find(c => c.id === id)!;
    if (c.cloudId && cloud) {
      try {
        const saved = await cloud.confirm({ childId: c.cloudId as Id<'children'>, parentToken: parentToken!, kind, needsHelp,
          ...(reviewOn ? { reviewOn } : {}) });
        if (saved) edit(id, c => ({ ...c, review: saved.review }));
      } catch (e) { throw new Error(humanError(e)); }
    } else edit(id, c => ({ ...c, review: kind === 'practice' ? { ...c.review, practiceAt: Date.now() }
      : { ...c.review, recitedAt: Date.now(), needsHelp, ...(reviewOn ? { reviewOn } : { reviewOn: undefined }) } }));
  };
  const remove = async (id: string) => {
    requireSession(); const c = dataRef.current.children.find(c => c.id === id)!;
    if (c.cloudId && cloud) {
      try { await cloud.remove({ childId: c.cloudId as Id<'children'>, parentToken: parentToken! }); }
      catch (e) { throw new Error(humanError(e)); }
    }
    commit({ ...dataRef.current, children: dataRef.current.children.filter(c => c.id !== id) });
    if (id === selected) { setSelected(null); setPlaying(false); }
  };
  const recover = async (id: string, mode: 'server' | 'copy') => {
    requireSession(); const c = dataRef.current.children.find(c => c.id === id)!;
    const server = cloud?.home?.children.find(r => r._id === c.cloudId);
    if (mode === 'copy') {
      const copy: LocalChild = { ...newChild(`${c.name.slice(0, 18)} نسخة`), progress: c.progress, review: c.review, settings: c.settings };
      commit({ ...dataRef.current, children: [...dataRef.current.children, copy] });
      setSelected(copy.id);
    }
    if (server) edit(id, () => fromServer(server));
    else commit({ ...dataRef.current, children: dataRef.current.children.filter(c => c.id !== id) });
  };

  const interact = (id: string) => {
    if (!child) return;
    const p = child.progress;
    if (id === 'wariq') { setModal('hifz'); return; }
    if (id === 'leaves') { dispatch({ type: 'leaves' }); setMessage('أصبح الطريق أوضح. نضع الأوراق في السلة حتى يمر الجميع بسهولة.'); return; }
    if (id.startsWith('clip')) { dispatch({ type: 'collect', clip: Number(id.slice(-1)) }); return; }
    if (id === 'blocked' || id === 'side') { dispatch({ type: 'place', position: id }); return; }
    if (p.stage === 'arrival') { dispatch({ type: 'enter' }); return; }
    if (id === 'basket') setMessage('نحتاج ثلاثة مشابك للوحة. كنت وضعتها في هذه السلة.');
    else if (id === 'box') setMessage('هذه علبة وَريق. نتركها له. نبحث عن المشابك الخشبية.');
    else if (id === 'rukn') setMessage(p.stage === 'clips' ? 'نحتاج ثلاثة مشابك للوحة. ابحث عن المشابك الخشبية.' : 'سأجهز الأدوات. من يرافقني إلى الجسر؟');
    else if (id === 'lamha' && p.location === 'square') setMessage('وجدت واحدًا تحت المقعد. ربما حرّكت الرياح الباقي.');
  };
  const p = child?.progress;
  const activeTopic: Topic | null = !p ? null : p.location === 'bridge' && !p.transfer.done ? 'transfer'
    : p.stage === 'greeting' ? 'greeting' : p.stage === 'clips' ? 'clips' : p.stage === 'placement' ? 'path' : null;
  useEffect(() => {
    if (child?.settings.assistance === 'guided' && activeTopic && activeTopic !== 'transfer' && !child.progress.hints[activeTopic]) {
      dispatch({ type: 'hint', topic: activeTopic });
    }
  }, [child?.id, child?.progress.stage, child?.settings.assistance]);

  return <div className={`app ${child?.settings.reducedMotion ? 'reduce-motion' : ''}`}>
    <header className="app-header"><a className="wordmark" href="#" onClick={e => { e.preventDefault(); setPlaying(false); stopAudio(); }}><Icon name="leaf" size={35} /><span>رِواق<small>حيّ الحكايات</small></span></a>
      <div className="header-actions">{playing && child && <button className="profile-button" onClick={() => { setPlaying(false); stopAudio(); }}><Portrait character="nawwar" /><span>{child.name}</span></button>}
        <button className="secondary" onClick={needParent}><Icon name="lock" />دفتر الأهل</button></div></header>
    {(saveError || loadError) && <div className="save-banner" role="alert"><span>{saveError || loadError}</span>
      <button className="secondary" onClick={() => exportSave()}>نزّل البيانات الأصلية</button>
      {loadError ? <button className="secondary" onClick={() => {
        if (window.confirm('هل حفظت نسخة من البيانات الأصلية؟ سيبدأ سجل جديد على الجهاز.')) { corrupt.current = false; setLoadError(''); commit({ schema: 1, children: [] }); }
      }}>ابدأ سجلًا جديدًا</button> : <button className="secondary" onClick={() => commit(dataRef.current)}>أعد محاولة الحفظ</button>}</div>}
    {!playing || !child ? <main className="welcome">
      <div className="welcome-art" style={{ backgroundImage: `url(${art.opening})` }}><div className="welcome-paper"><span className="leaf-stamp"><Icon name="leaf" size={28} /></span>
        <h1>أهلًا بك في حيّنا</h1><p>أصدقاء ينتظرونك، وأشياء صغيرة<br />نصنعها معًا.</p></div><span className="art-caption">ساحة البذور، أول حكاية</span></div>
      <section className="welcome-menu"><h2>{children.length ? 'من يبدأ الحكاية؟' : 'لنصنع أول حكاية'}</h2>
        {cloud?.isLoading || (cloud?.isAuthenticated && !cloud.home) ? <Notice>نحمّل ملفات الأسرة…</Notice>
          : children.length ? <div className="profile-grid">{children.map(c => <button className="profile-card" key={c.id} onClick={() => {
            setSelected(c.id); setPlaying(true); setMessage('');
          }}><Portrait character="nawwar" /><span>{c.name}<small>{c.progress.stage === 'bag' ? 'حكاية جديدة' : 'أكمل الحكاية'}</small></span><Icon name="arrow" /></button>)}</div>
            : <><p className="intro-copy">اختَر اسمًا مستعارًا لطفلك، ونحفظ له مغامرته.</p><button className="start-button" onClick={needParent}><Icon name="leaf" />أنشئ ملفًا وابدأ</button></>}
        {children.length > 0 && <button className="text-button" onClick={needParent}>أضف ملف طفل</button>}
        <div className="account-area">{cloud?.isAuthenticated ? <><span className="account-status"><Icon name="check" size={17} />حساب الأسرة متصل</span>
          <button className="text-button" onClick={async () => { parentClose(); await cloud.signOut(); setPlaying(false); setSelected(null); }}>تسجيل الخروج</button></>
          : <><p>يمكن البدء بملف محلي على هذا الجهاز.</p>{cloud && <button className="secondary" onClick={() => setModal('login')}><Icon name="lock" />دخول / إنشاء حساب الأسرة</button>}</>}
        </div>
        <p className="small-note audio-note"><Icon name="book" size={18} />النسخة الحالية بالقراءة. التسجيلات الصوتية لاحقًا.</p>
      </section>
    </main> : <main className="play-layout">
      <div className="game-column"><div className="mission-bar"><div><span className="mission-label">حكايتك الأولى</span><h1>{p!.location === 'bridge' ? 'لقاء على الطريق' : 'أهلًا بك في رِواق'}</h1></div>
        <div className="clip-counter" aria-label={`جمعت ${p!.clips.length} من ثلاثة مشابك`}><Icon name="clip" /><span>{p!.clips.length} / ٣</span></div></div>
        <GameView childId={child.id} progress={child.progress} settings={child.settings} interact={interact}
          arrived={() => dispatch({ type: 'enter' })} paused={modal !== null} />
        <div className="game-tools"><button className="secondary" onClick={() => setModal('map')}><Icon name="map" />خريطة الرحلة</button>
          <button className="secondary" onClick={() => setModal('hifz')}><Icon name="book" />ركن الحفظ</button>
          <button className="icon-button" aria-label={child.settings.muted ? 'تشغيل الصوت' : 'كتم الصوت'} onClick={() => { stopAudio(); dispatch({ type: 'preferences', settings: { ...child.settings, muted: !child.settings.muted } }); }}><Icon name={child.settings.muted ? 'mute' : 'sound'} /></button>
          <button className="text-button exit" onClick={() => { setPlaying(false); stopAudio(); }}>أخرج الآن</button></div>
      </div>
      <aside className="story-column"><div className="story-paper" aria-live="polite">
        <div className="speaker"><Portrait character={p!.location === 'bridge' ? 'lamha' : p!.stage === 'clips' ? 'rukn' : 'wariq'} /><div><strong>{p!.location === 'bridge' ? 'لَمْحة' : p!.stage === 'clips' ? 'رُكْن' : 'وَريق'}</strong><small>{p!.location === 'bridge' ? 'على طريق الجسر' : 'معك في الحكاية'}</small></div></div>
        {message && <div className="scene-message"><p>{message}</p><button className="text-button" onClick={() => setMessage('')}>أعود للمهمة</button></div>}
        {!message && <Story progress={child.progress} dispatch={dispatch} />}
        <div className="story-helpers"><button className="text-button" disabled={!activeTopic} onClick={() => activeTopic && dispatch({ type: 'hint', topic: activeTopic })}><Icon name="help" size={18} />أحتاج مساعدة</button>
          <button className="text-button" onClick={() => setNotice('التسجيلات الصوتية ستُضاف لاحقًا. التعليمات الحالية ظاهرة في دفتر الحكاية.')}><Icon name="sound" size={18} />أسمع مرة أخرى</button></div>
      </div>
      <div className="journey-note"><Icon name="leaf" size={24} /><p>{child.progress.flag ? 'رايتك تذكار أول ما صنعناه معًا.' : 'كل خطوة صغيرة تغيّر حيّنا.'}</p></div>
      <p className="save-status"><Icon name="check" size={16} />{saveError ? 'خطوة لم تُحفظ بعد' : syncText(child)}</p>
      </aside>
    </main>}
    <footer className="app-footer"><span>رِواق · نموذج التجربة ٠.١</span><span>مغامرة للفهم، وحفظ مع الأهل</span><button className="text-button" onClick={() => setNotice('نستخدم النصوص المعتمدة من كتاب تعليم الأطفال الإسلام لمحمد بن شمس الدين، الطبعة الرابعة. أحداث الشخصيات من تأليف رِواق. حديث الحفظ: صحيح البخاري 6231. البيانات المحلية تبقى في متصفحك؛ بيانات الحساب محفوظة في Convex وتتحقق ملكيتها على الخادم.')}>المصادر والبيانات</button></footer>
    {notice && <Modal title="عن هذه النسخة" close={() => setNotice('')}><p>{notice}</p><button onClick={() => setNotice('')}>حسنًا</button></Modal>}
    {modal === 'gate' && <ParentGate cloud={cloud} data={data} setPin={pin => commit({ ...dataRef.current, pin })} close={() => setModal(null)} unlock={(token) => {
      setParentToken(token); setParentUntil(Date.now() + 10 * 60 * 1000); setModal('parents');
    }} />}
    {modal === 'login' && cloud && <Login cloud={cloud} close={() => setModal(null)} />}
    {modal === 'parents' && parentToken && <Parents children={children} selectedId={selected} select={setSelected} close={parentClose}
      create={createChild} update={updateProfile} confirm={confirm} remove={remove} migrate={cloud?.isAuthenticated ? migrate : undefined}
      recover={recover} retry={retrySync} account={Boolean(cloud?.isAuthenticated)} backup={() => exportSave({ schema: 1, children,
        ...(!cloud?.isAuthenticated && data.pin ? { pin: data.pin } : {}) })} />}
    {modal === 'hifz' && child && <Hifz child={child} dispatch={dispatch} close={() => setModal(null)} />}
    {modal === 'map' && child && <Modal title="دفتر الرحلة" close={() => setModal(null)} wide>
      <img src={art.world} className="world-map" alt="خريطة رِواق: الحي وجسر القصب وبستان الغدير وعين صافية وهضبة الظلال والحديقة الكبيرة" />
      <p>نجهّز الحديقة الكبيرة لاستقبال الزوار. في هذه الحكاية نستكشف الساحة وبداية طريق الجسر.</p>
      <div className="button-row"><button className="secondary" onClick={() => { dispatch({ type: 'return' }); setModal(null); }}>إلى الساحة</button>
        <button disabled={child.progress.stage !== 'explore'} onClick={() => { dispatch({ type: 'travel' }); setModal(null); }}>إلى الجسر</button></div>
      {child.progress.stage !== 'explore' && <Notice>نثبّت لوحة الترحيب أولًا، ثم نبدأ الرحلة.</Notice>}
    </Modal>}
  </div>;
}

function Story({ progress: p, dispatch }: { progress: Progress; dispatch: (action: GameAction) => void }) {
  if (p.location === 'bridge') return p.transfer.done ? <><h2>الطريق إلى الجسر من هنا</h2>
    <p>{p.transfer.greeted ? `${reply}. الطريق إلى الجسر من هنا.` : 'نستطيع إكمال الاستكشاف. نتدرّب على السلام في لقاء آخر.'}</p>
    <button className="secondary" onClick={() => dispatch({ type: 'return' })}><Icon name="home" />إلى الساحة</button></>
    : <><h2>وجدتَ لَمْحة على الطريق</h2>{p.hints.transfer ? <><p>{p.transfer.first === 'path' ? 'الطريق من هنا. ' : p.transfer.first === 'bag' ? 'سأريك الحقيبة. ' : ''}نبدأ لقاءنا بالسلام عليكم ورحمة الله وبركاته.</p>
      <button onClick={() => dispatch({ type: 'transfer', choice: 'salam' })}>أحيّي لَمْحة</button>
      <button className="secondary" onClick={() => dispatch({ type: 'transfer', choice: 'skip' })}>أتابع الرحلة</button></>
      : <><p>لَمْحة تنتظر لتبدأ الكلام.</p><div className="choices"><button className="secondary" onClick={() => dispatch({ type: 'transfer', choice: 'path' })}>أين الطريق؟</button>
        <button className="secondary" onClick={() => dispatch({ type: 'transfer', choice: 'salam' })}>{salam}</button>
        <button className="secondary" onClick={() => dispatch({ type: 'transfer', choice: 'bag' })}>أرني الحقيبة</button></div></>}</>;
  switch (p.stage) {
    case 'bag': return <><h2>اختر لون حقيبتك</h2><p>أهلًا بك في رِواق! أصدقاؤنا في الساحة. هل نذهب إليهم؟</p><div className="bag-choices">
      <button className="bag-choice aqua" onClick={() => dispatch({ type: 'bag', color: 'aqua' })}><span className="bag-drawing" />تركواز</button>
      <button className="bag-choice blue" onClick={() => dispatch({ type: 'bag', color: 'blue' })}><span className="bag-drawing" />أزرق</button></div></>;
    case 'arrival': return <><h2>اذهب إلى أصدقائك في الساحة</h2><p>المس المكان الذي تريد أن تذهب إليه. أو المس صديقًا لتمشي نحوه.</p>
      <button onClick={() => dispatch({ type: 'enter' })}>ألتقي بأصدقائي<Icon name="arrow" /></button></>;
    case 'greeting': return <><h2>نبدأ اللقاء</h2><p>{p.hints.greeting ? 'يمكنك أن تسأل بعد التحية. نبدأ بالسلام عليكم ورحمة الله وبركاته. جربها معي.' : 'قبل أن نبدأ الكلام، ماذا نقول عندما نلتقي؟'}</p>
      {p.hints.greeting ? <button onClick={() => dispatch({ type: 'greet', choice: 'salam' })}>أحيّي أصدقائي</button>
        : <div className="choices"><button className="secondary" onClick={() => dispatch({ type: 'greet', choice: 'salam' })}>{salam}</button>
          <button className="secondary" onClick={() => dispatch({ type: 'greet', choice: 'bag' })}>أين حقيبتي؟</button>
          <button className="secondary" onClick={() => dispatch({ type: 'greet', choice: 'start' })}>أريد أن أبدأ الآن</button></div>}</>;
    case 'clips': return <><h2>أين المشابك؟</h2><p>{p.clips.length === 0 ? `${reply}. سعدت بلقائك! نحتاج ثلاثة مشابك للوحة. كنت وضعتها في هذه السلة.`
      : p.clips.length === 1 ? 'وجدت مشبكًا. بقي مشبكان.' : 'بقي مشبك واحد.'}</p><p className="goal">ابحث عن ثلاثة مشابك خشبية. المس المشبك لتجمعه.</p>
      {p.clips.length === 0 && <p className="small-note">وَريق: نبدأ لقاءنا بالسلام، ونردّ على من يسلّم علينا.</p>}
      {p.hints.clips && <Notice>انظر تحت المقعد، وقرب الأصيص، وبجانب الأوراق.</Notice>}
      <div className="inventory" aria-label="المشابك المجموعة">{[0, 1, 2].map(id => <span key={id} className={p.clips.includes(id) ? 'found' : ''}><Icon name="clip" size={28} /><small>{p.clips.includes(id) ? 'وجدته' : 'نبحث'}</small></span>)}</div></>;
    case 'placement': return <><h2>كلها هنا!</h2><p>{p.sign === 'blocked' ? 'لا أستطيع المرور بالعربة. أين نضعها ليقرأها القادمون ويبقى الطريق مفتوحًا؟' : 'بقي أن نختار مكان اللوحة.'}</p><p className="goal">اختر مكانًا للوحة.</p>
      {p.hints.path && <Notice>جرّب المكان بجانب المقعد.</Notice>}
      <div className="choices"><button className="secondary" onClick={() => dispatch({ type: 'place', position: 'blocked' })}>وسط الممر</button>
        <button className="secondary" onClick={() => dispatch({ type: 'place', position: 'side' })}>بجانب المقعد</button></div></>;
    case 'invitation': return <><h2>واضحة، والطريق مفتوح!</h2><p>نترك الممر مفتوحًا حتى يمرّ الجميع.</p><p>هذا أول ما صنعناه في حيّنا. اختر لون رايتك.</p>
      <div className="flag-choices"><button className="flag-choice apricot" onClick={() => dispatch({ type: 'flag', color: 'apricot' })}><Icon name="flag" size={32} />مشمشي</button>
        <button className="flag-choice aqua" onClick={() => dispatch({ type: 'flag', color: 'aqua' })}><Icon name="flag" size={32} />تركواز</button></div></>;
    case 'explore': return <><h2>حيّنا جاهز للترحيب</h2><p>نجهّز الحديقة الكبيرة لاستقبال الزوار. هناك طريق ومائدة ومكان للاستراحة. يمكننا صنعها معًا.</p>
      <div className="choices"><button onClick={() => dispatch({ type: 'travel' })}>إلى الجسر<Icon name="map" /></button>
        <button className="secondary" onClick={() => dispatch({ type: 'return' })}>أستكشف الساحة</button></div>
      <details className="customize"><summary>أغيّر حقيبتي ورايتي</summary><div className="button-row">
        <button className="secondary" onClick={() => dispatch({ type: 'bag', color: p.bag === 'aqua' ? 'blue' : 'aqua' })}>أغيّر لون الحقيبة</button>
        <button className="secondary" onClick={() => dispatch({ type: 'flag', color: p.flag === 'aqua' ? 'apricot' : 'aqua' })}>أغيّر لون الراية</button></div></details></>;
  }
}

function ParentGate({ cloud, data, setPin, close, unlock }: { cloud?: Cloud; data: Store; setPin: (pin: LocalPin) => boolean; close: () => void; unlock: (token: string) => void }) {
  const [password, setPassword] = useState(''); const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const authenticated = Boolean(cloud?.isAuthenticated);
  const setup = !authenticated && !data.pin;
  return <Modal title={setup ? 'نجهّز دفتر الأهل' : 'افتح دفتر الأهل'} close={close}>
    <div className="gate-icon"><Icon name="lock" size={32} /></div>
    <p>{authenticated ? 'أعد إدخال كلمة مرور حساب الأسرة. تبقى الإدارة مفتوحة عشر دقائق.' : setup
      ? 'اختر رمزًا من ٦ أرقام يعرفه الوالدان. يحمي التأكيدات والحذف في التجربة المحلية.' : 'أدخل رمز الأهل لهذا الجهاز.'}</p>
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try {
        if (authenticated && cloud) { unlock(await cloud.unlock({ password })); }
        else {
          if (!/^\d{6}$/.test(password)) throw new Error('أدخل ٦ أرقام.');
          if (setup) {
            if (password !== repeat) throw new Error('الرمزان مختلفان.');
            const salt = crypto.randomUUID();
            const pin = { salt, hash: await hashLocalPin(password, salt), failures: 0, lockedUntil: 0 };
            if (!setPin(pin)) throw new Error('تعذّر حفظ رمز الأهل؛ لم نفتح الإدارة.');
            unlock('local-parent');
          } else {
            const pin = data.pin!;
            if (pin.lockedUntil > Date.now()) throw new Error('محاولات كثيرة. انتظر ١٥ دقيقة ثم أعد المحاولة.');
            const matches = await hashLocalPin(password, pin.salt) === pin.hash;
            const failures = matches ? 0 : (pin.lockedUntil ? 0 : pin.failures) + 1;
            const updated = { ...pin, failures, lockedUntil: failures >= 5 ? Date.now() + 15 * 60 * 1000 : 0 };
            if (!setPin(updated)) throw new Error('تعذّر حفظ محاولة الدخول؛ لم نفتح الإدارة.');
            if (!matches) throw new Error('الرمز غير صحيح.');
            unlock('local-parent');
          }
        }
      } catch (e) { setError(authenticated ? humanError(e) : e instanceof Error ? e.message : 'تعذّر فتح الإدارة.'); }
      finally { setBusy(false); setPassword(''); setRepeat(''); }
    }}>
      <Field label={authenticated ? 'كلمة مرور حساب الأسرة' : 'رمز الأهل'}><input autoFocus type="password" autoComplete={authenticated ? 'current-password' : 'off'}
        inputMode={authenticated ? 'text' : 'numeric'} maxLength={authenticated ? 256 : 6} minLength={authenticated ? 8 : 6} required value={password} onChange={e => setPassword(e.target.value)} /></Field>
      {setup && <Field label="كرر الرمز"><input type="password" inputMode="numeric" autoComplete="off" value={repeat} maxLength={6} minLength={6} required onChange={e => setRepeat(e.target.value)} /></Field>}
      {error && <Notice error>{error}</Notice>}
      <button type="submit" disabled={busy}>{busy ? 'نتحقق…' : setup ? 'احفظ الرمز وافتح الدفتر' : 'افتح دفتر الأهل'}</button>
    </form>
    {!authenticated && <p className="small-note">حماية الرمز محلية؛ حساب الأسرة يضيف تحققًا على الخادم. احتفظ بالرمز؛ لا يوجد استرداد آلي للرمز المحلي في هذه النسخة.</p>}
  </Modal>;
}

function Login({ cloud, close }: { cloud: Cloud; close: () => void }) {
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <Modal title="حساب الأسرة" close={close}>
    <div className="login-tabs"><button className={flow === 'signIn' ? 'active' : 'secondary'} onClick={() => { setFlow('signIn'); setError(''); }}>دخول</button>
      <button className={flow === 'signUp' ? 'active' : 'secondary'} onClick={() => { setFlow('signUp'); setError(''); }}>حساب جديد</button></div>
    <p>حساب للوالد. ملفات الأطفال بأسماء مستعارة داخل الحساب.</p>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError('');
      try { await cloud.signIn('password', { flow, email: email.trim().toLowerCase(), password }); close(); }
      catch (e) { setError(humanError(e)); } finally { setBusy(false); }
    }}>
      <Field label="بريد الوالد"><input type="email" dir="ltr" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></Field>
      <Field label="كلمة المرور"><input type="password" dir="ltr" autoComplete={flow === 'signIn' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} maxLength={256} /></Field>
      <p className="small-note">٨ أحرف على الأقل. استخدم كلمة مرور خاصة بهذا الحساب.</p>
      {error && <Notice error>{error}</Notice>}
      <button type="submit" disabled={busy}>{busy ? 'نتحقق…' : flow === 'signIn' ? 'أدخل حساب الأسرة' : 'أنشئ حساب الأسرة'}</button>
    </form>
    <p className="small-note">بعد الدخول، افتح دفتر الأهل لربط ملفات الجهاز دون إعادة المغامرة. لا تتوفر استعادة كلمة المرور بالبريد في نموذج التجربة بعد.</p>
  </Modal>;
}
