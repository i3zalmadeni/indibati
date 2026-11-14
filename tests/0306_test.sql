-- اختبارات 0306: رقم جوال ولي الأمر من النواة الرقمية
\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
-- 501: ولي أمر برقم · 502: ولي أمر بلا رقم · 503: بلا ولي أمر. أرقام الطلاب في النواة:
insert into student_private (student_id, phone) values ('00000000-0000-0000-0000-000000000501', '0555000009'),
  ('00000000-0000-0000-0000-000000000502', ' 0555000002 '), ('00000000-0000-0000-0000-000000000503', '0555000003')
  on conflict (student_id) do update set phone = excluded.phone;
select t_ok(ind_contact_phone('00000000-0000-0000-0000-000000000501') = '966500000001', 'رقم ولي الأمر المسجل يُقدَّم على رقم النواة');
select t_ok(ind_contact_phone('00000000-0000-0000-0000-000000000502') = '0555000002', 'ولي أمر بلا رقم: يُستخدم رقم النواة');
select t_ok(ind_contact_phone('00000000-0000-0000-0000-000000000503') = '0555000003' and ind_phone_source('00000000-0000-0000-0000-000000000503') = 'core', 'بلا ولي أمر: رقم النواة ومصدره');
select t_ok(ind_phone_source('00000000-0000-0000-0000-000000000501') = 'guardian', 'مصدر رقم ولي الأمر');
update student_private set phone = '0555000033' where student_id = '00000000-0000-0000-0000-000000000503';
select t_ok(ind_contact_phone('00000000-0000-0000-0000-000000000503') = '0555000033', 'تحديث الرقم في النواة ينعكس فوراً');
update student_private set phone = '' where student_id = '00000000-0000-0000-0000-000000000503';
select t_ok(not ind_has_phone('00000000-0000-0000-0000-000000000503'), 'الرقم الفارغ لا يُعد رقماً');
update student_private set phone = '0555000003' where student_id = '00000000-0000-0000-0000-000000000503';

-- الواجهة: لا أرقام، والعلم بوجود الرقم فقط
set role authenticated; select t_as(1);
select t_ok(position('0555' in ind_notice_candidates('2026-11-12')::text) = 0 and position('966500' in ind_notice_candidates('2026-11-12')::text) = 0, 'قائمة رسائل الغياب لا تكشف الأرقام');
select t_ok(position('0555' in ind_student_file('00000000-0000-0000-0000-000000000503')::text) = 0
  and (ind_student_file('00000000-0000-0000-0000-000000000503')->'student'->>'has_phone')::boolean is not false, 'الملف الانضباطي لا يكشف الرقم');
select t_ok(t_err($$select ind_contact_phone('00000000-0000-0000-0000-000000000503')$$) like 'permission denied%', 'المنسوب لا يقرأ الرقم مباشرة');

-- الإدراج والإرسال: يُعد للطالب رقم، ويقرأ الخادم رقم النواة عند الإرسال
reset role;
select set_config('t.nid', ind_enqueue('00000000-0000-0000-0000-000000000503', 'absence', 'absence', '{"date":"2026-11-12"}', 't0306:503', false)::text, false);
select t_ok((select status from ind_notifications where id = current_setting('t.nid')::uuid) = 'queued', 'طالب برقم في النواة يُدرج «بانتظار الإرسال» لا «بلا رقم»');
set role service_role;
select t_ok((select x->>'phone' from jsonb_array_elements(ind_svc_claim(100)) x where x->>'id' = current_setting('t.nid')) = '0555000003', 'الإرسال يقرأ رقم النواة');
reset role;
do $$ begin raise notice 'PHASE0306_PASSED'; end $$;
