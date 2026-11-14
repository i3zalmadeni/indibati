-- اختبارات المرحلة 7: نقاط الانتظام (تكامل قيمي) والتقارير
\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
-- أسبوع 8–12 نوفمبر (الأحد–الخميس): نحضّر ونثبت كل الفصول كل الأيام، مع غياب طالب واحد
delete from ind_attendance_records where day between '2026-11-01' and '2026-11-05';
insert into ind_attendance_sessions (section_id, day, year_id) select c.id, d::date, c.year_id from class_sections c, generate_series('2026-11-01'::date, '2026-11-05'::date, interval '1 day') d on conflict do nothing;
insert into ind_attendance_records (session_id, student_id, section_id, day, status)
select id, '00000000-0000-0000-0000-000000000504', section_id, day, 'absent_unexcused' from ind_attendance_sessions where section_id = '00000000-0000-0000-0000-00000000c002' and day = '2026-11-03';

set role authenticated; select t_as(5);
select t_ok(ind_set_reward_settings('{"enabled":true}')->>'error' = 'forbidden', 'شؤون الطلاب لا تفعّل النقاط');
select t_as(1);
select t_ok((ind_rewards_run('2026-11-03')->>'skipped') = 'disabled', 'النقاط معطلة حتى يفعّلها المنسق');
select ind_set_reward_settings('{"enabled":true,"points":5}');
select t_ok((ind_rewards_run('2026-11-03')->>'skipped') = 'week_not_final', 'لا استحقاق قبل تثبيت كل أيام الأسبوع');
-- التثبيت التلقائي للأيام الخمسة لجميع الفصول يكمل الأسبوع ويطلق الاستحقاق تلقائياً
select ind_lock(d::date, 'all', null, null, true) from generate_series('2026-11-01'::date, '2026-11-05'::date, interval '1 day') d;
reset role;
select t_ok((select count(*) from ind_reward_transactions where week_start = '2026-11-01' and status = 'awarded') = 8, 'منح 8 طلاب أكملوا الأسبوع دون غياب تلقائياً');
select t_ok(not exists (select 1 from ind_reward_transactions where student_id = '00000000-0000-0000-0000-000000000504' and week_start = '2026-11-01'), 'الغائب لا يستحق');
select t_ok((select sum(points) from qm_points_ledger where source_type = 'indibati_week') = 40, 'القيود في دفتر قيمي (5 نقاط لكل طالب) لا في دفتر مستقل');
set role authenticated; select t_as(1);
select t_ok((ind_rewards_run('2026-11-03')->>'awarded')::int = 0, 'منع تكرار منح النقاط للأسبوع نفسه');
-- غياب لاحق بعد إلغاء التثبيت يعكس النقاط بقيد موثق
select ind_unlock('2026-11-04', 'تصحيح', 'list', array['00000000-0000-0000-0000-00000000c001']::uuid[]);
select ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-04', '[{"student_id":"00000000-0000-0000-0000-000000000501","status":"absent_excused"}]', 'تصحيح');
reset role;
select t_ok((select status from ind_reward_transactions where student_id = '00000000-0000-0000-0000-000000000501' and week_start = '2026-11-01') = 'reversed', 'عكس الاستحقاق عند غياب لاحق');
select t_ok((select sum(points) from qm_points_ledger where student_id = '00000000-0000-0000-0000-000000000501') = 0, 'قيد عكسي في قيمي يعيد الرصيد');
set role authenticated; select t_as(5);
select t_ok(jsonb_array_length(ind_rewards_overview()->'weeks') >= 1, 'شؤون الطلاب تراجع الاستحقاق');

-- التقارير
select t_ok(jsonb_array_length(ind_report('attendance_daily', '2026-11-01', '2026-11-05')->'rows') = 15, 'تقرير الحضور اليومي (3 فصول × 5 أيام)');
select t_ok(jsonb_array_length(ind_report('absence_unexcused', '2026-11-01', '2026-11-05')->'rows') = 1, 'تقرير الغياب بدون عذر');
select t_ok(jsonb_array_length(ind_report('absence_excused', '2026-11-01', '2026-11-05')->'rows') = 1, 'تقرير الغياب بعذر');
select t_ok(jsonb_array_length(ind_report('absence_list', '2026-11-01', '2026-11-30', 'm2')->'rows') = 0, 'التصفية بالصف');
select t_ok(jsonb_array_length(ind_report('absence_list', '2026-09-06', '2026-11-30', null, null, '102')->'rows') >= 1, 'البحث عن طالب');
select t_ok(jsonb_array_length(ind_report('absence_repeat', '2026-09-06', '2026-11-30', null, null, null, 2)->'rows') >= 1, 'تقرير المتكرر غيابهم');
select t_ok(jsonb_array_length(ind_report('lateness_list', '2026-09-06', '2026-11-30')->'rows') >= 2, 'تقرير التأخر');
select t_ok(jsonb_array_length(ind_report('lateness_repeat', '2026-09-06', '2026-11-30', null, null, null, 2)->'rows') = 1, 'تقرير المتكرر تأخرهم');
select t_ok(jsonb_array_length(ind_report('lateness_reasons', '2026-09-06', '2026-11-30')->'rows') >= 1, 'أكثر أسباب التأخر');
select t_ok(jsonb_array_length(ind_report('notifications', '2026-01-01', '2026-12-31')->'rows') >= 1, 'تقرير الإشعارات');
select t_ok(jsonb_array_length(ind_report('excuses', '2026-09-06', '2026-11-30')->'rows') = 1, 'تقرير الأعذار');
select t_ok(jsonb_array_length(ind_report('escalations', '2026-01-01', '2026-12-31')->'rows') >= 1, 'تقرير الإجراءات النظامية');
select t_ok(jsonb_array_length(ind_report('rewards', '2026-11-01', '2026-11-30')->'rows') = 8, 'تقرير نقاط الانتظام');
select t_ok(position('966500' in ind_report('notifications', '2026-01-01', '2026-12-31')::text) = 0, 'التقارير لا تكشف الأرقام');
select t_as(2);
select t_ok(ind_report('absence_list', '2026-11-01', '2026-11-05')->>'error' = 'forbidden', 'مدخل البيانات لا يستخرج التقارير');
reset role;
\echo PHASE7_PASSED
