# صور رواق ونصوص التوليد

استخدمنا أداة imagegen المدمجة لإنتاج هذه الصور. ملفات النصوص أدناه تحفظ الطلبات المستخدمة، بما فيها أسلوب الرسم والألوان وعدد الأوراق والأطراف والإكسسوارات. نُسخت الصور المختارة إلى مجلد المشروع مع الحفاظ على ملفات التوليد الأصلية.

| الصورة | الملف النهائي | نص التوليد |
|---|---|---|
| نَوّار | [nawwar-sheet-v2.png](../assets/concepts/characters/nawwar-sheet-v2.png) | [character-prompts.json](character-prompts.json) بالمفتاح nawwar |
| لَمْحة | [lamha-sheet-v2.png](../assets/concepts/characters/lamha-sheet-v2.png) | [character-prompts.json](character-prompts.json) بالمفتاح lamha |
| رُكْن | [rukn-sheet.png](../assets/concepts/characters/rukn-sheet.png) | [character-prompts.json](character-prompts.json) بالمفتاح rukn |
| وَريق | [wariq-sheet-v2.png](../assets/concepts/characters/wariq-sheet-v2.png) | [character-prompts.json](character-prompts.json) بالمفتاح wariq |
| العالم | [riwaq-world.png](../assets/concepts/world/riwaq-world.png) | [world-map-prompt.json](world-map-prompt.json) |
| ساحة البداية | [seed-square-opening-v2.png](../assets/concepts/world/seed-square-opening-v2.png) | [opening-scene-prompt.json](opening-scene-prompt.json) |

أوراق الشخصيات PNG بشفافية فعلية، وكل منها تضم أربع زوايا وثلاثة تعبيرات. صورتا العالم والساحة بخلفية مرسومة. الصور أبحاث تصميمية للشكل والمكان؛ عند إنتاج التحريك نثبت موقع الإكسسوارات والنسب في مرجع واحد ثم نصنع الإطارات المطلوبة. لا تُستخدم أوراق الزوايا مباشرة بوصفها spritesheets للحركة.

صورة الساحة تستخدم صور الشخصيات الأربع والخريطة مراجع بصرية. عند نقل المشروع إلى مجلد آخر، حدّث مسارات الصور المرجعية في ملف الطلب إلى الملفات المنسوخة داخل assets/concepts.

النسخ v2 هي المختارة للتسليم. [طلبات تصحيح الشخصيات](character-corrections.json) تثبت جهة الحقيبة في المنظر الخلفي لنَوّار ووَريق، وتوحد علامات ذيل لَمْحة. [طلب تصحيح الساحة](opening-scene-correction.json) يطابق الذيل مع المرجع. أبقينا النسخ الأولى التي استخدمناها مراجع لهذه التصحيحات.

## أصول النموذج القابل للعب

أُنتجت خلفيتا [الساحة الفارغة](../assets/concepts/world/seed-square-background.png) و[طريق الجسر](../assets/concepts/world/bridge-path.png) بأداة imagegen المدمجة. [runtime-prompts.json](runtime-prompts.json) يحفظ الطلبين كاملين ومسارات المراجع والمخرجات وأوامر استخراج وضع الوقوف وضغط الأصول. نسخ التشغيل المضغوطة في `assets/runtime/` و`public/art/`.

يستخدم النموذج وضع وقوف واحدًا مستقلًا لكل شخصية مع حركة إجرائية بسيطة. لا يشغّل زوايا ورقة المرجع كإطارات مشي. إطارات المشي والحمل والتفاعل التفصيلية متبقية في M04.

[manifest.json](manifest.json) يحدد الصور الست المختارة، وأبعادها، وملفات طلباتها، وبصمات الملفات. تحققنا من وجود شفافية فعلية في أوراق الشخصيات الأربع ومن تطابق المواقع الخمسة في الخريطة مع وصف العالم.
