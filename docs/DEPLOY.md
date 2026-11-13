# النشر

## البيئات
| البيئة | القاعدة | الواجهة |
|---|---|---|
| Development | Postgres محلي بنسخة هيكلية من النواة (`tests/core_stub.sql`) وبيانات وهمية (`tests/e2e/seed.sql`) | `node tests/e2e/server.js` |
| Staging | مقترح: مشروع Supabase مجاني منفصل، بالهيكل نفسه ودون بيانات حقيقية | فرع `staging`، ويمكن نشره على Pages مستودع آخر |
| Production | قاعدة النواة `labeedsch_PC` | `main` ← GitHub Pages |

## خطوات الإنتاج (بعد الموافقة)
1. نسخة احتياطية: `create schema backup_indibati_<date>` أو نسخة PITR من لوحة Supabase.
2. تطبيق `0300_register_system.sql` ثم `0301_indibati_foundation.sql` بالترتيب. لا يغيّران بنية جداول النواة، ويمكن إعادة تنفيذهما.
3. (طُبّق 0300 و0301 على labeedsch_PC بتاريخ 2026-11-13.)
4. من «الإعدادات ← الأدوار» يعيّن مدير النواة منسق الغياب وشؤون الطلاب.
5. من «إدارة التكليفات» يُسند المنسق الفصول، بشرط أن يكون لكل مكلف حساب دخول في النواة.
6. GitHub: Settings ← Pages ← Source: GitHub Actions.

## التراجع
`drop table … ind_* cascade; drop function ind_*` ينهي النظام دون أثر على النواة.
