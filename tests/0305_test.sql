-- اختبارات 0305: شارات القائمة وقائمة غائبي اليوم
\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;

-- 1) المنسق: الشارات تطابق حالة الفصول في اليوم
set role authenticated; select t_as(1);
select set_config('t.n', ind_nav_counts('2026-11-12')::text, false);
select t_ok((current_setting('t.n')::jsonb->>'unsaved')::int = (select count(*) from jsonb_array_elements(ind_day_status('2026-11-12')) x where not (x->>'saved')::boolean), 'شارة التحضير = الفصول غير المحفوظة');
select t_ok((current_setting('t.n')::jsonb->>'unlocked')::int = (select count(*) from jsonb_array_elements(ind_day_status('2026-11-12')) x where (x->>'saved')::boolean and not (x->>'locked')::boolean), 'شارة التثبيت = المحفوظة غير المثبتة');
select t_ok((current_setting('t.n')::jsonb->>'excuses')::int = (select count(*) from jsonb_array_elements(ind_excuses_list()) x where x->>'status' in ('submitted','under_review')), 'شارة الأعذار = الأعذار التي لم يُبت فيها');
select t_ok((ind_nav_counts('2026-11-13')->>'weekend')::boolean and not (ind_nav_counts('2026-11-12')->>'weekend')::boolean, 'الجمعة عطلة والخميس يوم دراسي وفق الإعدادات');
select t_ok(case when (ind_nav_counts('2026-11-13')->>'weekend')::boolean then (ind_nav_counts('2026-11-13')->>'unsaved')::int = 0 else true end, 'لا شارة تحضير يوم العطلة');

-- 2) مدخل البيانات: فصوله المسندة فقط، ولا يرى عدد الأعذار
select t_as(2);
select t_ok((ind_nav_counts('2026-11-12')->>'unsaved')::int + (ind_nav_counts('2026-11-12')->>'unlocked')::int
  <= (select count(*) from jsonb_array_elements(ind_day_status('2026-11-12')) x where (x->>'mine')::boolean), 'شارات المدخل ضمن فصوله المسندة');
select t_ok((ind_nav_counts('2026-11-12')->>'excuses')::int = 0, 'المدخل لا يرى عدد الأعذار');
select t_ok(ind_day_absentees('2026-11-12')->>'error' = 'forbidden', 'المدخل لا يرى قائمة غائبي اليوم');

-- 3) قائمة الغائبين للمنسق وشؤون الطلاب
reset role; select set_config('t.k', (select count(*) from ind_attendance_records where day = '2026-11-12')::text, false);
set role authenticated; select t_as(1);
select t_ok(jsonb_array_length(ind_day_absentees('2026-11-12')) = current_setting('t.k')::int and current_setting('t.k')::int > 0, 'قائمة الغائبين كاملة');
select t_ok((select bool_and(x ? 'label' and x ? 'status' and x ? 'name') from jsonb_array_elements(ind_day_absentees('2026-11-12')) x), 'كل غائب معه الفصل والحالة');
select t_ok(position('966500' in ind_day_absentees('2026-11-12')::text) = 0, 'لا أرقام جوال في القائمة');
select t_as(5);
select t_ok(jsonb_typeof(ind_day_absentees('2026-11-12')) = 'array', 'شؤون الطلاب ترى القائمة');

-- 4) الزائر ممنوع
reset role; set role anon;
select t_ok(t_err($$select ind_nav_counts()$$) like 'permission denied%', 'الزائر لا يصل إلى الشارات');
select t_ok(t_err($$select ind_day_absentees()$$) like 'permission denied%', 'الزائر لا يصل إلى قائمة الغائبين');
reset role;
do $$ begin raise notice 'PHASE0305_PASSED'; end $$;
