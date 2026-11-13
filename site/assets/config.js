// مفتاح عام (publishable) آمن للمتصفح: الحماية الفعلية في سياسات RLS ودوال ind_* بقاعدة البيانات.
// لا تضع هنا مفتاح service_role ولا مفاتيح واتساب أبداً؛ الأسرار في متغيرات بيئة Supabase فقط.
// القاعدة هي قاعدة النواة الرقمية نفسها، فتتشارك الجلسة مع بقية الأنظمة على i3zalmadeni.github.io.
window.APP_CONFIG = {
  supabaseUrl: "https://kbhovmnvqzgihhyibqkq.supabase.co",
  supabaseKey: "sb_publishable_hfzNlh9tCpuC2zCf4T_2FA_42ujADOX",
};

// الدخول بمعرّف: يُترجم المعرّف داخلياً إلى بريد غير حقيقي بهذا النطاق (يطابق نظام النواة).
window.LOGIN_DOMAIN = "id.invalid";

// رابط النواة الرقمية (يظهر في ترويسة لوحة التحكم)
window.CORE_URL = "https://i3zalmadeni.github.io/digital-core/";
