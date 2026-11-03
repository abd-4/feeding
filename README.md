# NutriCore

## الرفع والتشغيل
1. ارفع كل محتويات هذا المجلد إلى مستودع GitHub (مع الحفاظ على المجلدات: css, js, data, pdfs).
2. ضع ملفات PDF الثلاثة داخل مجلد `pdfs` بنفس الأسماء الموجودة في `config.js`.
3. فعّل GitHub Pages: Settings ← Pages ← Branch: main ← Save. سيظهر رابط الموقع.
4. افتح الرابط: سيعمل بوضع تجريبي (بيانات محلية على جهازك) إلى أن تضبط GitHub في `config.js`.

## تخزين البيانات في GitHub
ملء `GITHUB` في `config.js` (owner, repo, token). التطبيق يقرأ/يكتب الملف `data/db.json`.
⚠️ **مهم أمنياً:** كل ما في `config.js` يراه أي زائر للموقع. وضع التوكن فيه يعني أن أي شخص يمكنه
استخدامه. الحلول الأفضل (نكتبها معاً لاحقاً إن أردت): وسيط صغير (Cloudflare Worker / Netlify Function)
يحتفظ بالتوكن، ومستودع **خاص** للبيانات منفصل عن مستودع الموقع.

## تغيير مطوّر التطبيق (عند البيع)
- غيّر `DEVELOPER_EMAIL` في `config.js`.
- لتغيير الكلمة السرية احسب: SHA-256 للنص `nutricore-dev:` + الكلمة الجديدة، وضع الناتج في `DEVELOPER_CODE_HASH`
  (مثلاً من الطرفية: `printf 'nutricore-dev:NEWCODE' | sha256sum`).
