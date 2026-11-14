-- اختبارات المرحلتين 5 و6: الأعذار، وبوابة ولي الأمر، والملف الانضباطي، والإشعارات، والإجراءات النظامية
\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
-- ولي أمر للطالب 501 برقم، وللطالب 502 بلا رقم، والطالب 503 بلا ولي أمر
insert into guardians (id, full_name, phone) values ('00000000-0000-0000-0000-0000000009a1', 'ولي أمر 1', '966500000001'), ('00000000-0000-0000-0000-0000000009a2', 'ولي أمر 2', null);
insert into student_guardians values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-0000000009a1', 'father', true),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-0000000009a2', 'father', true);
create or replace function t_token(p_url text) returns text language sql as $$ select split_part(p_url, '?t=', 2) $$;
grant execute on function t_token(text) to authenticated, anon;
grant execute on function t_ok(boolean, text), t_err(text), t_as(int) to anon;

-- 1) رابط ولي الأمر: المنسق فقط
set role authenticated; select t_as(2);
select t_ok(ind_guardian_link('00000000-0000-0000-0000-000000000501')->>'error' = 'forbidden', 'المدخل لا ينشئ رابط ولي الأمر');
select t_as(1);
select set_config('t.url', ind_guardian_link('00000000-0000-0000-0000-000000000502')->>'url', false);
select t_ok(current_setting('t.url') like 'https://%guardian.html?t=%' and length(t_token(current_setting('t.url'))) = 64, 'رابط آمن برمز عشوائي طوله 64');

-- 2) البوابة دون حساب (anon) بالرمز فقط
reset role; set role anon;
select t_ok((ind_g_portal(t_token(current_setting('t.url')))->'student'->>'name') = 'طالب 2', 'البوابة تعرض الطالب صاحب الرابط');
select t_ok(ind_g_portal('x' || t_token(current_setting('t.url')))->>'error' = 'invalid_link', 'رمز خاطئ يُرفض');
select t_ok(jsonb_array_length(ind_g_portal(t_token(current_setting('t.url')))->'absences') >= 1, 'ولي الأمر يرى غياب ابنه');
select t_ok(position('966500' in ind_g_portal(t_token(current_setting('t.url')))::text) = 0, 'لا تظهر أرقام الجوال في البوابة');
select t_ok(t_err($$select ind_student_file('00000000-0000-0000-0000-000000000501')$$) like 'permission denied%', 'الزائر لا يصل إلى الملف الانضباطي');
select t_ok(t_err($$select ind_excuses_list()$$) like 'permission denied%', 'الزائر لا يرى قائمة الأعذار');

-- 3) تقديم العذر
select t_ok(t_err(format($$select ind_g_submit_excuse(%L, '2026-11-11', 'مرض')$$, t_token(current_setting('t.url')))) = 'no_absence_that_day', 'لا عذر ليوم لم يُسجل فيه غياب');
select t_ok(t_err(format($$select ind_g_submit_excuse(%L, '2026-11-12', 'مرض', null, array['00000000-0000-0000-0000-000000000501/x.pdf'])$$, t_token(current_setting('t.url')))) = 'attachment_invalid', 'منع إرفاق ملف من مجلد طالب آخر');
select set_config('t.x', ind_g_submit_excuse(t_token(current_setting('t.url')), '2026-11-12', 'مراجعة طبية', 'كان لديه موعد', array['00000000-0000-0000-0000-000000000502/a.pdf'], '00000000-0000-0000-0000-00000000bbbb')->>'id', false);
select t_ok(current_setting('t.x') <> '', 'تقديم العذر مع مرفق');
select t_ok((ind_g_submit_excuse(t_token(current_setting('t.url')), '2026-11-12', 'مراجعة طبية', null, '{}', '00000000-0000-0000-0000-00000000bbbb'))->>'duplicate_request' = 'true', 'إعادة الإرسال لا تكرر العذر');
select t_ok(t_err(format($$select ind_g_submit_excuse(%L, '2026-11-12', 'سبب آخر')$$, t_token(current_setting('t.url')))) = 'excuse_exists', 'عذر قائم واحد لليوم');
select t_ok((select x->>'status' from jsonb_array_elements(ind_g_portal(t_token(current_setting('t.url')))->'absences') x where x->>'day' = '2026-11-12') = 'absent_unexcused', 'ولي الأمر لا يغير السجل الرسمي');

-- 4) المراجعة: الاعتماد يعيد التصنيف حتى مع التثبيت، ويُسجل
reset role; set role authenticated; select t_as(5);
select t_ok(jsonb_array_length(ind_excuses_list('submitted')) = 1, 'شؤون الطلاب ترى العذر');
select t_ok(ind_excuse_review(current_setting('t.x')::uuid, 'approved')->>'error' = 'forbidden', 'شؤون الطلاب لا تعتمد الأعذار');
select t_as(1);
select t_ok((ind_roster('00000000-0000-0000-0000-00000000c001', '2026-11-12')->>'locked')::boolean, 'سجل اليوم مثبت قبل الاعتماد');
select t_ok(t_err(format($$select ind_excuse_review(%L, 'rejected')$$, current_setting('t.x'))) = 'reason_required', 'رفض العذر يتطلب سبباً');
select ind_excuse_review(current_setting('t.x')::uuid, 'approved', 'مقبول');
select t_ok((select x->>'status' from jsonb_array_elements(ind_roster('00000000-0000-0000-0000-00000000c001', '2026-11-12')->'students') x where x->>'id' = '00000000-0000-0000-0000-000000000502') = 'absent_excused', 'الاعتماد يحول الغياب إلى «بعذر»');
select t_ok(exists (select 1 from jsonb_array_elements(ind_audit_list(50, 'attendance')) e where e->>'action' = 'attendance_reclassified'), 'إعادة التصنيف موثقة بالقيمتين');
select t_ok(t_err(format($$select ind_excuse_review(%L, 'rejected', 'x')$$, current_setting('t.x'))) = 'already_decided', 'لا تغيير لقرار نهائي');

-- 5) الإشعارات: طالب بلا رقم يُسجل no_phone، ومع رقم queued، دون تكرار
select t_ok(jsonb_array_length(ind_notice_candidates('2026-11-12')) = 2, 'قائمة الغائبين لإشعارهم');
select t_ok(position('9665' in ind_notice_candidates('2026-11-12')::text) = 0, 'لا تظهر الأرقام في قائمة الإشعار');
select t_ok((ind_queue_absence_notices('2026-11-12', array['00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000502']::uuid[]))::text = '{"queued": 1, "no_phone": 1, "duplicates": 0}', 'رسالة فردية لكل ولي أمر: 1 بالطابور و1 بلا رقم');
select t_ok((ind_queue_absence_notices('2026-11-12', array['00000000-0000-0000-0000-000000000501']::uuid[]))->>'duplicates' = '1', 'لا تكرار لإشعار غياب اليوم نفسه');
select t_ok((select bool_and(x->>'status' in ('queued','no_phone') and not (x->'vars' ? 'link')) from jsonb_array_elements(ind_notifications_list(null, 'absence')) x), 'لا يُدّعى الإرسال، والرابط لا يظهر في السجل');
select t_as(2);
select t_ok(ind_queue_absence_notices('2026-11-12', array['00000000-0000-0000-0000-000000000501']::uuid[])->>'error' = 'forbidden', 'المدخل لا يرسل الإشعارات');

-- 6) خدمة الإرسال (service_role): استلام الطابور، ثم فشل لا يُعد نجاحاً، ثم Webhook
reset role;
select t_ok(t_err('set role authenticated; select ind_svc_claim(5)') like 'permission denied%', 'دوال الإرسال للخادم فقط'); reset role;
set role service_role;
select set_config('t.claim', ind_svc_claim(10)::text, false);
select t_ok(jsonb_array_length(current_setting('t.claim')::jsonb) = 1 and (current_setting('t.claim')::jsonb->0->>'phone') = '966500000001', 'الخادم وحده يقرأ الرقم عند الإرسال');
select ind_svc_result((current_setting('t.claim')::jsonb->0->>'id')::uuid, 'failed', null, null, 'template_not_approved');
reset role; set role authenticated; select t_as(1);
select t_ok((select count(*) from jsonb_array_elements(ind_notifications_list('failed')) x) = 1, 'معالجة فشل الإرسال وتسجيل السبب');
select ind_notification_retry((current_setting('t.claim')::jsonb->0->>'id')::uuid);
reset role; set role service_role;
select ind_svc_claim(10);
select ind_svc_result((current_setting('t.claim')::jsonb->0->>'id')::uuid, 'sent', 'نص', 'wamid.TEST1');
select ind_svc_status('wamid.TEST1', 'read'); select ind_svc_status('wamid.TEST1', 'delivered');
reset role; set role authenticated; select t_as(1);
select t_ok((select x->>'status' from jsonb_array_elements(ind_notifications_list(null, 'absence')) x where x->>'provider_message_id' = 'wamid.TEST1') = 'read', 'حالة Webhook لا تتراجع (قُرئت ثم وصلت = قُرئت)');

-- 7) إشعار التأخر الفوري والمتكرر حسب الإعدادات
select ind_set_lateness_settings('{"day_start":"07:00","late_after":"07:10","notify_enabled":true}');
select ind_set_notification_settings('{"lateness_repeat_threshold":2,"lateness_repeat_window_days":30}');
select t_as(4);
select ind_record_lateness('00000000-0000-0000-0000-000000000501', '2026-11-11', '07:20', t_reason(false, 'ازدحام الطريق'));
select t_as(1);
select t_ok((select count(*) from jsonb_array_elements(ind_notifications_list(null, 'lateness')) x) = 1, 'إشعار تأخر فوري عند التسجيل');
select t_ok((select count(*) from jsonb_array_elements(ind_notifications_list(null, 'lateness_repeat')) x) = 1, 'إشعار تكرار التأخر عند بلوغ العدد المحدد');
select t_ok((select x->'vars'->>'arrival' from jsonb_array_elements(ind_notifications_list(null, 'lateness')) x limit 1) = '07:20', 'وقت الوصول من السجل وليس وقت الإرسال');

-- 8) الإجراءات النظامية: معطلة افتراضياً، ثم تُفعّل بحدود قابلة للضبط
select t_ok(jsonb_array_length(ind_escalations_list()) = 0, 'لا إجراءات قبل تفعيل القواعد');
select ind_escalation_rule_save((select (x->>'id')::uuid from jsonb_array_elements(ind_escalation_rules_list()) x where (x->>'level')::int = 1), 'الإشعار الأول', 2, 'all', 'total', true, true);
-- الطالب 503: غياب يومين (10 و12) → يبلغ الحد 2 إجمالاً
reset role; insert into ind_attendance_sessions (section_id, day, year_id) select '00000000-0000-0000-0000-00000000c001', '2026-11-09', '00000000-0000-0000-0000-0000000000a1' on conflict do nothing;
insert into ind_attendance_records (session_id, student_id, section_id, day, status)
select id, '00000000-0000-0000-0000-000000000503', section_id, day, 'absent_unexcused' from ind_attendance_sessions where section_id = '00000000-0000-0000-0000-00000000c001' and day in ('2026-11-09', '2026-11-10') on conflict do nothing;
set role authenticated; select t_as(1);
select t_ok(exists (select 1 from jsonb_array_elements(ind_escalations_list()) x where x->>'student_id' = '00000000-0000-0000-0000-000000000503' and (x->>'days')::int >= 2), 'اكتشاف بلوغ الحد وإنشاء الإجراء تلقائياً');
select t_ok(exists (select 1 from jsonb_array_elements(ind_student_file('00000000-0000-0000-0000-000000000503')->'escalations') x), 'الإجراء مسجل في ملف الطالب');
select t_ok((ind_escalation_print((select (x->>'id')::uuid from jsonb_array_elements(ind_escalations_list()) x limit 1))->'school'->>'name') = 'متوسطة لبيد بن ربيعة', 'بيانات الإشعار الرسمي للطباعة');
reset role;
select t_ok(ind_absence_count('00000000-0000-0000-0000-000000000503', 'all', 'consecutive') = 2, 'احتساب الأيام المتصلة (الاثنين والثلاثاء)');
select t_ok(ind_absence_count('00000000-0000-0000-0000-000000000501', 'unexcused', 'total') = 0, 'التمييز بين الغياب بعذر وبدونه');
-- لا تكرار للإجراء نفسه في العام
select ind_escalate('00000000-0000-0000-0000-000000000503');
select t_ok((select count(*) from ind_escalation_records where student_id = '00000000-0000-0000-0000-000000000503') = 1, 'الإجراء لا يتكرر للطالب في العام نفسه');

-- 9) الملف الانضباطي والصلاحيات
set role authenticated; select t_as(2);
select t_ok((ind_student_file('00000000-0000-0000-0000-000000000501')->'absence'->>'excused')::int = 1, 'المدخل يرى ملف طالب في فصله');
select t_ok(ind_student_file('00000000-0000-0000-0000-000000000507')->>'error' = 'forbidden', 'المدخل لا يرى ملف طالب خارج فصوله');
select t_as(5);
select t_ok((ind_student_file('00000000-0000-0000-0000-000000000501')->'lateness'->>'count')::int >= 1, 'شؤون الطلاب ترى ملف التأخر');
select t_ok(position('966500' in ind_student_file('00000000-0000-0000-0000-000000000501')::text) = 0, 'الملف لا يكشف أرقام الجوال');
select t_ok((ind_dashboard_extra()->>'notif_failed')::int = 0, 'لوحة الإشعارات المعلقة والفاشلة');
reset role;
\echo PHASE56_PASSED
