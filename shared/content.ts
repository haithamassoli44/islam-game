export const salam = 'السلام عليكم ورحمة الله وبركاته';
export const reply = 'وعليكم السلام ورحمة الله وبركاته';
export const hadithParts = [
  'يُسَلِّمُ الصَّغِيرُ عَلَى الْكَبِيرِ',
  'وَالْمَارُّ عَلَى الْقَاعِدِ',
  'وَالْقَلِيلُ عَلَى الْكَثِيرِ',
] as const;
export const hadith = hadithParts.join('، ');
export const units = [
  { id: 'adab.salam.start', version: 1, approved: true, source: 'تعليم الأطفال الإسلام، الطبعة الرابعة، ص٢٩ وص٢٣٧',
    goal: 'بدء اللقاء بالسلام', explanation: 'نبدأ لقاءنا بالسلام، ونردّ على من يسلّم علينا' },
  { id: 'suluk.shared-path', version: 1, approved: true, source: 'تعليم الأطفال الإسلام، الطبعة الرابعة، ص١٠ وص٥٥',
    goal: 'إبقاء الممر مفتوحًا', explanation: 'نترك الممر مفتوحًا حتى يمرّ الجميع' },
  { id: 'hifz.hadith.010', version: 1, approved: true, source: 'رواه البخاري، 6231؛ الكتاب ص٢٩ وص٢٢٣',
    goal: 'تدريب حديث السلام وتسميعه للوالد', text: hadith,
    explanation: 'الصغير والكبير هنا في العمر. المارّ هو الذي يمشي، والقاعد هو الجالس. القليل والكثير هنا عدد الأشخاص' },
] as const;

// Approved recordings will be added here after they are matched against the text.
export const audio: Record<string, string> = {};
