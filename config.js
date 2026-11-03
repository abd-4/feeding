// ===== إعدادات NutriCore — عدّل هنا فقط =====
window.NUTRICORE_CONFIG = {
  // بريد المطور (صاحب التطبيق). عند بيع التطبيق غيّر هذا البريد + هاش الكلمة السرية أدناه.
  DEVELOPER_EMAIL: "lionking1111112211@gmail.com",

  // هاش SHA-256 للكلمة السرية للمطور (محسوب من:  DEV_SALT + الكلمة السرية).
  // الكلمة الحالية لا تظهر هنا كنص صريح. لتغييرها راجع README.md
  DEV_SALT: "nutricore-dev:",
  DEVELOPER_CODE_HASH: "75cdc96d6cf2c84780b4df5802209feda61c8da44dbed1f2d1e7296b683035de",

  WHATSAPP_URL: "https://wa.me/963983958105",
  COPYRIGHT: "جميع الحقوق محفوظة لـِ أحمد الهوى 2026 ©",

  // تخزين البيانات في GitHub. اترك token فارغاً = وضع تجريبي (تخزين محلي على الجهاز فقط).
  GITHUB: { owner: "", repo: "", branch: "main", path: "data/db.json", token: "" },

  // الخطط المجانية (الملفات داخل مجلد pdfs في المستودع)
  FREE_PLANS: [
    { file: "Guide_to_Therapeutic_Nutrition.pdf", title: "دليل التغذية العلاجية للبدناء" },
    { file: "Guide_to_an_intrabody_device.pdf",   title: "دليل جهاز الأنبدي وتحليل مكونات الجسم" },
    { file: "Treatment_of_kidney_patients.pdf",   title: "دليل التغذية العلاجية لمرضى الكلى" }
  ]
};
