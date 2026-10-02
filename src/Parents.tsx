import React, { useEffect, useState } from 'react';
import type { LocalChild } from './storage';
import { pathEvidence, transferEvidence, type Review, type Settings } from '../shared/game';
import { Modal, Notice, Icon, Field, Portrait } from './ui';

export const dateText = (date?: number) => date ? new Intl.DateTimeFormat('ar-JO', { dateStyle: 'medium' }).format(date) : 'لم يُؤكّد بعد';
export const syncText = (child: LocalChild) => !child.cloudId ? 'حُفظ على هذا الجهاز فقط'
  : child.sync === 'saved' ? 'تزامن مع حساب الأسرة'
    : child.sync === 'conflict' ? 'توجد نسخة أخرى؛ راجع التعارض قبل المزامنة'
      : child.sync === 'error' ? 'حُفظ على الجهاز؛ تعذّرت المزامنة'
        : 'حُفظ على الجهاز؛ ينتظر المزامنة';

export function SettingsFields({ value, change }: { value: Settings; change: (settings: Settings) => void }) {
  return <div className="settings-fields">
    <Field label="طريقة تقديم العربية"><select value={value.presentation} onChange={e => change({ ...value, presentation: e.target.value as Settings['presentation'] })}>
      <option value="read">أقرأ بنفسي</option><option value="both" disabled>أقرأ وأستمع — بعد إضافة الصوت</option>
      <option value="listen" disabled>أستمع — بعد إضافة الصوت</option></select></Field>
    <Field label="مستوى المساعدة"><select value={value.assistance} onChange={e => change({ ...value, assistance: e.target.value as Settings['assistance'] })}>
      <option value="guided">إرشاد واضح</option><option value="on-demand">تلميحات عند الطلب</option><option value="independent">استقلال أكبر</option></select></Field>
    <label className="check-field"><input type="checkbox" checked={value.reducedMotion} onChange={e => change({ ...value, reducedMotion: e.target.checked })} />تقليل الحركة</label>
    <label className="check-field"><input type="checkbox" checked={value.muted} onChange={e => change({ ...value, muted: e.target.checked })} />كتم الصوت</label>
  </div>;
}

export function Parents({ children, selectedId, select, close, create, update, confirm, remove, migrate, recover, retry, account, backup }: {
  children: LocalChild[]; selectedId: string | null; select: (id: string) => void; close: () => void;
  create: (name: string) => Promise<void>;
  update: (id: string, name: string, settings: Settings) => Promise<void>;
  confirm: (id: string, kind: 'recitation' | 'practice', needsHelp: boolean, reviewOn: string) => Promise<void>;
  remove: (id: string) => Promise<void>; migrate?: (id: string) => Promise<void>;
  recover: (id: string, mode: 'server' | 'copy') => Promise<void>; retry: () => void;
  account: boolean; backup: () => void;
}) {
  const [name, setName] = useState('');
  const [needsHelp, setNeedsHelp] = useState(false);
  const [reviewOn, setReviewOn] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const child = children.find(c => c.id === selectedId) ?? children[0];
  useEffect(() => { setNeedsHelp(child?.review.needsHelp ?? false); setReviewOn(child?.review.reviewOn ?? ''); }, [child?.id]);
  const run = async (task: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر تنفيذ الطلب. أعد المحاولة.'); }
    finally { setBusy(false); }
  };
  return <Modal title="دفتر الأهل" close={close} wide>
    <p className="intro-copy">نرى ما جُرّب في اللعب، وما سُمّع لك، وما طُبّق في البيت.</p>
    <div className="parent-layout"><aside className="child-list">
      {children.map(c => <button className={`child-tab ${c.id === child?.id ? 'active' : ''}`} key={c.id} onClick={() => { select(c.id); setDeleteId(null); setError(''); }}>
        <Portrait character="nawwar" /><span>{c.name}<small>{c.cloudId ? 'حساب الأسرة' : 'ملف على الجهاز'}</small></span></button>)}
      <form className="new-child" onSubmit={e => { e.preventDefault(); void run(async () => { await create(name); setName(''); }); }}>
        <Field label="ملف طفل جديد"><input value={name} onChange={e => setName(e.target.value)} placeholder="اسم مستعار" maxLength={24} required /></Field>
        <button className="secondary" disabled={busy || !name.trim()} type="submit">أضف الملف</button>
      </form>
      <p className="small-note">لا نحتاج اسمًا كاملًا أو بريدًا للطفل.</p>
    </aside><section className="parent-detail" aria-live="polite">
      {!child ? <div className="empty-state"><Icon name="leaf" size={42} /><h3>نبدأ بملف صغير</h3><p>أضف اسمًا مستعارًا. لكل طفل مغامرته وإعداداته.</p></div>
        : <><div className="detail-head"><h3>رحلة {child.name}</h3><span className="tag">{child.progress.flag ? 'حلقة البداية مكتملة' : 'حلقة البداية قيد اللعب'}</span></div>
          <Notice>{syncText(child)}</Notice>
          {child.sync === 'error' && <button className="secondary" disabled={busy} onClick={retry}>أعد محاولة المزامنة</button>}
          {child.sync === 'conflict' && <div className="conflict-box"><p>حفظ جهاز آخر تغيّر. تبقى نسخة هذا الجهاز محفوظة حتى تختار.</p>
            <div className="button-row"><button disabled={busy} onClick={() => void run(() => recover(child.id, 'copy'))}>احفظ نسخة الجهاز بملف مستقل</button>
              <button className="secondary" disabled={busy} onClick={() => void run(() => recover(child.id, 'server'))}>استخدم نسخة الحساب</button></div>
          </div>}
          {!child.cloudId && migrate && <button className="secondary" disabled={busy} onClick={() => void run(() => migrate(child.id))}>اربط الملف بحساب الأسرة</button>}
          <div className="evidence-row"><span className="evidence-icon"><Icon name="leaf" /></span><div><h4>السلام في لقاء جديد</h4>
            <p>{transferEvidence(child.progress)}</p><small>لقاء لَمْحة على طريق الجسر. إكمال البحث عن المشابك دليل منفصل.</small></div></div>
          <div className="evidence-row"><span className="evidence-icon"><Icon name="flag" /></span><div><h4>ممر متاح للجميع</h4>
            <p>{pathEvidence(child.progress)}</p><small>{child.progress.hints.path ? 'استُخدم تلميح الممر' : 'لم يُستخدم تلميح الممر'}</small></div></div>
          <details><summary>تفاصيل المساعدة</summary><ul className="hint-list">{([
            ['greeting', 'اللقاء الأول'], ['clips', 'البحث عن المشابك'], ['path', 'موضع اللوحة'], ['transfer', 'اللقاء الجديد']
          ] as const).map(([key, label]) => <li key={key}>{label}: {child.progress.hints[key] ? 'استخدم مساعدة' : 'دون تلميح مسجّل'}</li>)}</ul></details>
          <section className="parent-section"><h4><Icon name="book" />حديث السلام</h4>
            <p>{child.progress.memorization.ready ? 'الطفل مستعد لتسميع حديث السلام' : child.progress.memorization.practiced ? 'تدرب على حديث السلام' : 'لم يبدأ التدريب بعد'}</p>
            <p>آخر تسميع مؤكد: <strong>{dateText(child.review.recitedAt)}</strong></p>
            {child.review.recitedAt && <p className="small-note">{child.review.needsHelp ? 'احتاج إلى تلقين أثناء التسميع' : 'سمّع دون تلقين مسجّل'}{child.review.reviewOn ? `؛ المراجعة: ${child.review.reviewOn}` : ''}</p>}
            <p className="small-note">اطلب من طفلك قول الحديث من ذاكرته. سجّل إن احتاج إلى تلقين، وأكد التسميع الذي سمعته.</p>
            <label className="check-field"><input type="checkbox" checked={needsHelp} onChange={e => setNeedsHelp(e.target.checked)} />احتاج إلى تلقين</label>
            <Field label="موعد مراجعة اختياري"><input type="date" value={reviewOn} onChange={e => setReviewOn(e.target.value)} /></Field>
            <button disabled={busy} onClick={() => void run(() => confirm(child.id, 'recitation', needsHelp, reviewOn))}>أؤكد التسميع الذي سمعته</button>
          </section>
          <section className="parent-section"><h4><Icon name="home" />نجرب في البيت</h4>
            <p>جرّبوا السلام والتحية في لقاء داخل البيت، وساعدوا في إبقاء الممر مفتوحًا.</p>
            <p className="small-note">آخر تطبيق شاهده الوالد: {dateText(child.review.practiceAt)}</p>
            <button className="secondary" disabled={busy} onClick={() => void run(() => confirm(child.id, 'practice', false, ''))}>أؤكد التطبيق الذي شاهدته</button>
          </section>
          <ProfileSettings key={child.id} child={child} busy={busy} save={(n, s) => void run(() => update(child.id, n, s))} />
          <div className="danger-zone">{deleteId === child.id ? <><p>سيُحذف ملف «{child.name}» وتقدمه وتأكيداته على الجهاز{child.cloudId ? ' وفي الحساب' : ''}. تبقى ملفات الأطفال الآخرين.</p>
            <div className="button-row"><button className="danger" disabled={busy} onClick={() => void run(async () => { await remove(child.id); setDeleteId(null); })}>أحذف هذا الملف وتقدمه</button>
              <button className="secondary" onClick={() => setDeleteId(null)}>أحتفظ بالملف</button></div></>
            : <button className="text-button danger-text" onClick={() => setDeleteId(child.id)} disabled={busy}>حذف هذا الملف</button>}</div>
        </>}
    </section></div>
    {error && <Notice error>{error}</Notice>}
    <footer className="parent-footer"><button className="text-button" onClick={backup}>نزّل نسخة من بيانات الجهاز</button><button onClick={close}><Icon name="lock" />أغلق دفتر الأهل</button></footer>
    <p className="small-note">{account ? 'تتطلب التأكيدات جلسة والد يتحقق منها الخادم. لا تعدّل الملف نفسه على جهازين في الوقت نفسه.' : 'هذه تجربة محلية. الحماية برمز على هذا الجهاز، وقد تضيع البيانات عند مسح بيانات المتصفح.'}</p>
  </Modal>;
}

function ProfileSettings({ child, busy, save }: { child: LocalChild; busy: boolean; save: (name: string, settings: Settings) => void }) {
  const [name, setName] = useState(child.name);
  const [settings, setSettings] = useState(child.settings);
  return <details className="parent-section"><summary>إعدادات {child.name}</summary>
    <Field label="الاسم المستعار"><input value={name} maxLength={24} onChange={e => setName(e.target.value)} /></Field>
    <SettingsFields value={settings} change={setSettings} />
    <button className="secondary" disabled={busy || !name.trim()} onClick={() => save(name, settings)}>احفظ الإعدادات</button></details>;
}
