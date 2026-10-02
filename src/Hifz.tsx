import React, { useEffect, useState } from 'react';
import { hadith, hadithParts, units, audio } from '../shared/content';
import type { GameAction } from '../shared/game';
import type { LocalChild } from './storage';
import { Modal, Icon, Notice, Portrait } from './ui';
import { playAudio, stopAudio } from './audio';

const steps = ['نتعرّف إلى الحديث', 'المقطع الأول', 'المقطع الثاني', 'المقطع الثالث', 'أردد الحديث كاملًا', 'أجرّب من ذاكرتي'];

export function Hifz({ child, dispatch, close }: { child: LocalChild; dispatch: (action: GameAction) => void; close: () => void }) {
  const [show, setShow] = useState(true);
  const [message, setMessage] = useState('');
  const { step, ready } = child.progress.memorization;
  useEffect(() => { setShow(step !== 5); stopAudio(); }, [step]);
  useEffect(() => () => stopAudio(), []);
  const key = step >= 1 && step <= 3 ? `hadith.part.${step}` : 'hadith.full';
  return <Modal title="ركن وَريق للحفظ" close={close} wide>
    <div className="hifz-intro"><Portrait character="wariq" /><div><h3>حديث السلام</h3>
      <p>سنتدرّب على حديث عن السلام. تستطيع العودة إلى اللعب متى أردت.</p></div></div>
    <Notice>التسجيلات الصوتية ستُضاف لاحقًا. يمكنك الآن التدريب بالقراءة، أو بمساعدة أحد والديك.</Notice>
    <div className="step-dots" role="group" aria-label={`المرحلة ${step + 1} من 6`}>{steps.map((label, i) => <button key={label}
      className={i === step ? 'active' : ''} aria-label={label} aria-current={i === step ? 'step' : undefined}
      onClick={() => { if (i > 0) dispatch({ type: 'practice', step: i }); }} disabled={i === 0}><span>{i + 1}</span></button>)}</div>
    <h3>{steps[step]}</h3>
    <div className="hadith-paper">
      <p className="hadith-introduction">قال رسول الله ﷺ</p>
      {show ? <p className="hadith" lang="ar">{step >= 1 && step <= 3 ? hadithParts[step - 1] : hadith}</p>
        : <p className="hidden-hadith"><Icon name="leaf" size={38} />حاول أن تقول الحديث من ذاكرتك.</p>}
      <p className="source">رواه البخاري، <bdi>6231</bdi></p>
    </div>
    {step === 0 && <p>{units[2].explanation}</p>}
    <div className="button-row">
      <button className="secondary" disabled={!audio[key] || child.settings.muted} onClick={async () => {
        if (!await playAudio(key, child.settings.muted)) setMessage('تعذّر تشغيل التسجيل. أعد المحاولة.');
      }}><Icon name="sound" />{audio[key] ? 'أسمع مرة أخرى' : 'الصوت لاحقًا'}</button>
      {step >= 4 && <button className="secondary" onClick={() => setShow(!show)}>{show ? 'أخفي النص' : 'أظهر النص'}</button>}
      {step < 5 ? <button onClick={() => dispatch({ type: 'practice', step: step + 1 })}>
        {step === 0 ? 'أبدأ بالترديد النصي' : step === 4 ? 'أجرّب من ذاكرتي' : 'أكمل التدريب'}<Icon name="arrow" /></button>
        : <button onClick={() => dispatch({ type: 'ready' })} disabled={ready}><Icon name="check" />{ready ? 'أخبرنا الوالد أنك مستعد' : 'جاهز للتسميع'}</button>}
    </div>
    {ready && <Notice>سمّع الحديث لأحد والديك. سيؤكد التسميع من شاشة الأهل.</Notice>}
    {message && <Notice error>{message}</Notice>}
    <div className="hifz-footer"><button className="text-button" onClick={() => dispatch({ type: 'practice', step: 1 })}>أريد تكرارًا</button>
      <button className="secondary" onClick={close}><Icon name="home" />أعود إلى المغامرة</button></div>
    <p className="small-note">التدريب والاستعداد للتسميع محفوظان. تأكيد التسميع يكتبه الوالد بعد سماعه.</p>
  </Modal>;
}
