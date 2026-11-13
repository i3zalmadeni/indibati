-- اختبارات وحدة الحضور والتثبيت والتأخر والتكليفات (القسم 37 من الأمر التنفيذي)
-- تُشغَّل على قاعدة محلية فقط: tests/run.sh
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- ---------- بيانات اختبار وهمية (محلياً فقط) ----------
insert into academic_years (id, name, starts_on, status) values ('00000000-0000-0000-0000-0000000000a1', '1448', '2026-09-06', 'current');
insert into grade_levels values ('m1', 'الأول المتوسط', 1, true), ('m2', 'الثاني المتوسط', 2, true);
insert into class_sections (id, year_id, grade_code, name) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1', 'm1', 'فصل 1'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a1', 'm1', 'فصل 2'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-0000000000a1', 'm2', 'فصل 1');
insert into students (id, student_no, full_name, study_status)
select ('00000000-0000-0000-0000-0000000005' || lpad(g::text, 2, '0'))::uuid, '10' || g, 'طالب ' || g, 'enrolled' from generate_series(1, 9) g;
insert into student_enrollments (student_id, year_id, grade_code, section_id, status, started_on)
select ('00000000-0000-0000-0000-0000000005' || lpad(g::text, 2, '0'))::uuid, '00000000-0000-0000-0000-0000000000a1',
  case when g <= 6 then 'm1' else 'm2' end,
  case when g <= 3 then '00000000-0000-0000-0000-00000000c001'::uuid when g <= 6 then '00000000-0000-0000-0000-00000000c002'::uuid else '00000000-0000-0000-0000-00000000c003'::uuid end,
  'enrolled', '2026-09-06' from generate_series(1, 9) g;
-- المنسوبون: مدير نواة، منسق، مدخل غياب 1، مدخل غياب 2، مدخل تأخر، شؤون طلاب، منسوب بلا دور
insert into staff_members (id, user_id, full_name, account_status, is_active) values
  ('00000000-0000-0000-0000-0000000000e0', '00000000-0000-0000-0000-0000000000f0', 'مدير النواة', 'active', true),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1', 'المنسق', 'active', true),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f2', 'مدخل غياب أ', 'active', true),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f3', 'مدخل غياب ب', 'active', true),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000f4', 'مدخل تأخر', 'active', true),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000f5', 'شؤون الطلاب', 'active', true),
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000f6', 'منسوب', 'active', true);
insert into staff_roles (staff_id, role_code) values ('00000000-0000-0000-0000-0000000000e0', 'core_admin');

-- ---------- أدوات الاختبار ----------
create or replace function t_as(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', case when n < 0 then '' else '00000000-0000-0000-0000-0000000000f' || n end, false) $$;
create or replace function t_err(sql text) returns text language plpgsql as $$
begin execute sql; return null; exception when others then return sqlerrm; end $$;
create or replace function t_ok(cond boolean, name text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', name; end if; raise notice 'PASS: %', name; end $$;
create or replace function t_reason(p_other boolean, p_name text default null) returns uuid language sql security definer as $$
  select id from ind_lateness_reasons where (p_name is null and is_other = p_other) or name = p_name order by sort_order limit 1 $$;
grant execute on function t_reason(boolean, text) to authenticated;
grant execute on function t_as(int), t_err(text), t_ok(boolean, text) to authenticated;
set client_min_messages = notice;
set role authenticated;

-- 1) الأدوار: مدير النواة يعيّن المنسق وشؤون الطلاب
select t_as(0);
select t_ok((select ind_whoami()->>'is_coord')::boolean, 'مدير النواة يعامل كمنسق');
select ind_set_role('00000000-0000-0000-0000-0000000000e1', 'coordinator', true);
select ind_set_role('00000000-0000-0000-0000-0000000000e5', 'affairs', true);
select t_as(1);
select t_ok((ind_whoami()->>'is_coord')::boolean, 'المنسق يحصل على دوره');
select t_ok(ind_set_role('00000000-0000-0000-0000-0000000000e6', 'coordinator', true)->>'error' = 'forbidden', 'المنسق لا يعيّن الأدوار');

-- 2) توزيع الفصول على عدة مدخلي بيانات، وفصل مهمة الغياب عن مهمة التأخر
select t_ok((ind_assignment_save(null, '00000000-0000-0000-0000-0000000000e2', 'absence', array['00000000-0000-0000-0000-00000000c001']::uuid[], '2026-09-06'))->>'ok' = 'true', 'إسناد غياب للمدخل أ');
select t_ok((ind_assignment_save(null, '00000000-0000-0000-0000-0000000000e3', 'absence', array['00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000c003']::uuid[], '2026-09-06'))->>'ok' = 'true', 'إسناد غياب للمدخل ب (فصلان)');
select t_ok((ind_assignment_save(null, '00000000-0000-0000-0000-0000000000e4', 'lateness', array['00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000c002']::uuid[], '2026-09-06'))->>'ok' = 'true', 'إسناد تأخر لمدخل مختلف');
select t_ok(jsonb_array_length(ind_assignment_save(null, '00000000-0000-0000-0000-0000000000e3', 'absence', array['00000000-0000-0000-0000-00000000c001']::uuid[], '2026-09-06')->'conflicts') = 1, 'كشف التعارض عند إسناد فصل مسند لآخر');
select t_ok((select count(*) from (select jsonb_array_elements(ind_assignments_list())) x) = 3, 'لا تكرار في التكليفات بعد رفض التعارض');

-- 3) جلب الطلاب من النواة، والحالة الافتراضية «حاضر»
select t_as(2);
select t_ok(jsonb_array_length(ind_roster('00000000-0000-0000-0000-00000000c001', '2026-11-12')->'students') = 3, 'جلب طلاب الفصل من النواة');
select t_ok((select bool_and(x->>'status' = 'present') from jsonb_array_elements(ind_roster('00000000-0000-0000-0000-00000000c001', '2026-11-12')->'students') x), 'الجميع حاضر افتراضياً');
select t_ok(jsonb_array_length(ind_meta('absence')->'sections') = 1, 'المدخل يرى فصوله المسندة فقط');

-- 4) تسجيل غياب بعذر وبدون عذر
select t_ok((ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-12',
  '[{"student_id":"00000000-0000-0000-0000-000000000501","status":"absent_excused"},{"student_id":"00000000-0000-0000-0000-000000000502","status":"absent_unexcused"}]'))->>'absent' = '2', 'تسجيل غياب بعذر وبدون عذر');
select t_ok((select x->>'status' from jsonb_array_elements(ind_roster('00000000-0000-0000-0000-00000000c001', '2026-11-12')->'students') x where x->>'id' = '00000000-0000-0000-0000-000000000501') = 'absent_excused', 'حالة الغياب بعذر محفوظة');
-- الحفظ مرة أخرى بالقائمة نفسها لا ينشئ تكراراً
select ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-12',
  '[{"student_id":"00000000-0000-0000-0000-000000000501","status":"absent_excused"},{"student_id":"00000000-0000-0000-0000-000000000502","status":"absent_unexcused"}]');
select t_ok((ind_roster('00000000-0000-0000-0000-00000000c001', '2026-11-12')->>'saved')::boolean, 'الجلسة محفوظة');
select t_ok(t_err($$select ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-12', '[{"student_id":"00000000-0000-0000-0000-000000000507","status":"absent_excused"}]')$$) = 'student_not_in_section', 'رفض طالب من فصل آخر');
select t_ok(t_err($$select ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-12', '[{"student_id":"00000000-0000-0000-0000-000000000501","status":"present_x"}]')$$) = 'status_invalid', 'حالتان فقط للغياب');
select t_ok(t_err($$select ind_save_attendance('00000000-0000-0000-0000-00000000c001', (now() at time zone 'Asia/Riyadh')::date + 1, '[]')$$) = 'date_future', 'منع التاريخ المستقبلي');
select t_ok(t_err($$select ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-13', '[]')$$) = 'weekend_day', 'منع يوم الإجازة الأسبوعية');

-- 5) منع الوصول إلى فصل غير مسند، وتسجيل المحاولة
select t_ok(ind_save_attendance('00000000-0000-0000-0000-00000000c002', '2026-11-12', '[]')->>'error' = 'forbidden', 'منع الحفظ في فصل غير مسند');
select t_ok(ind_roster('00000000-0000-0000-0000-00000000c003', '2026-11-12')->>'error' = 'forbidden', 'منع الاطلاع على فصل غير مسند');
select t_as(4);
select t_ok(ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-12', '[]')->>'error' = 'forbidden', 'مدخل التأخر لا يسجل الغياب');

-- 6) التحضير بتاريخ سابق (غير مثبت)
select t_as(2);
select t_ok((ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-10', '[{"student_id":"00000000-0000-0000-0000-000000000503","status":"absent_unexcused"}]'))->>'absent' = '1', 'تسجيل غياب بتاريخ سابق غير مثبت');

-- 7) تثبيت فصل واحد، ثم منع المدخل من التعديل
select t_ok(jsonb_array_length(ind_lock('2026-11-12', 'list', array['00000000-0000-0000-0000-00000000c001']::uuid[])->'locked') = 1, 'تثبيت فصل واحد');
select t_ok(t_err($$select ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-12', '[]')$$) = 'locked', 'منع مدخل البيانات من تعديل سجل مثبت');
select t_ok((ind_roster('00000000-0000-0000-0000-00000000c001', '2026-11-12')->>'can_edit')::boolean = false, 'الواجهة تعرض السجل للقراءة فقط');
select t_ok(ind_unlock('2026-11-12', 'تصحيح', 'list', array['00000000-0000-0000-0000-00000000c001']::uuid[])->>'error' = 'forbidden', 'المدخل لا يلغي التثبيت');
select t_ok(ind_lock('2026-11-12', 'list', array['00000000-0000-0000-0000-00000000c002']::uuid[])->>'error' = 'forbidden', 'المدخل لا يثبت فصلاً غير مسند');
-- لا يجوز التسجيل بتاريخ سابق في فصل مثبت لذلك التاريخ
select ind_lock('2026-11-10', 'list', array['00000000-0000-0000-0000-00000000c001']::uuid[]);
select t_ok(t_err($$select ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-10', '[]')$$) = 'locked', 'منع التسجيل بتاريخ سابق مثبت');

-- 8) المنسق: إلغاء التثبيت بسبب إلزامي، ثم التعديل، ثم إعادة التثبيت (لتاريخ سابق)
select t_as(1);
select t_ok(t_err($$select ind_unlock('2026-11-10', '  ', 'list', array['00000000-0000-0000-0000-00000000c001']::uuid[])$$) = 'reason_required', 'سبب إلغاء التثبيت إلزامي');
select t_ok(jsonb_array_length(ind_unlock('2026-11-10', 'تصحيح بناء على طلب', 'list', array['00000000-0000-0000-0000-00000000c001']::uuid[])->'unlocked') = 1, 'إلغاء تثبيت تاريخ سابق بواسطة المنسق');
select t_ok((ind_save_attendance('00000000-0000-0000-0000-00000000c001', '2026-11-10', '[]', 'أُثبت حضوره'))->>'absent' = '0', 'تعديل السجل بعد إلغاء التثبيت');
select t_ok(jsonb_array_length(ind_lock('2026-11-10', 'list', array['00000000-0000-0000-0000-00000000c001']::uuid[])->'locked') = 1, 'إعادة التثبيت بعد التعديل');
select t_ok((select count(*) from ind_audit_list(500, 'attendance_lock') x, jsonb_array_elements(x) e where e->>'action' = 'relock') = 1, 'إعادة التثبيت مسجلة باسمها');
select t_ok((select e->'old' from jsonb_array_elements(ind_audit_list(500, 'attendance')) e where e->>'action' = 'attendance_modified' limit 1) is not null, 'التعديل يحفظ القيم السابقة والجديدة');

-- 9) تثبيت عدة فصول، وتثبيت جميع الفصول (غير المحفوظ يُتخطى ما لم يؤكد المنسق)
select t_as(3);
select ind_save_attendance('00000000-0000-0000-0000-00000000c002', '2026-11-12', '[]');
select ind_save_attendance('00000000-0000-0000-0000-00000000c003', '2026-11-12', '[]');
select t_ok(jsonb_array_length(ind_lock('2026-11-12', 'list', array['00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000c003']::uuid[])->'locked') = 2, 'تثبيت عدة فصول');
select t_as(1);
select t_ok(jsonb_array_length(ind_lock('2026-11-11', 'all')->'skipped_unsaved') = 3, 'تثبيت الجميع يتخطى الفصول غير المحفوظة');
select t_ok(jsonb_array_length(ind_lock('2026-11-11', 'all', null, null, true)->'locked') = 3, 'تثبيت جميع الفصول بتأكيد المنسق');
select t_ok(jsonb_array_length(ind_unlock('2026-11-11', 'اختبار الإلغاء الجماعي', 'grade', null, 'm1')->'unlocked') = 2, 'إلغاء تثبيت جميع فصول صف');

-- 10) التأخر: حساب الدقائق، السبب الإلزامي، «سبب آخر»، البحث، ومنع التكرار
select t_as(4);
reset role; select t_ok(ind_late_minutes('07:18') = 8, 'وصول 7:18 = 8 دقائق (بداية الاحتساب 7:10)');
select t_ok(ind_late_minutes('07:09') = 0, 'قبل حد التأخر لا يحتسب'); set role authenticated;
select t_ok(jsonb_array_length(ind_student_search('طالب', 'lateness')) = 6, 'البحث المباشر في فصول التأخر المسندة فقط');
select t_ok(jsonb_array_length(ind_student_search('107', 'lateness')) = 0, 'لا نتائج لطالب خارج الإسناد');
select t_ok(t_err(format($$select ind_record_lateness('00000000-0000-0000-0000-000000000501', '2026-11-12', '07:18', '%s')$$, t_reason(true))) = 'other_reason_required', 'رسالة «سبب آخر» الإلزامي');
select t_ok((ind_record_lateness('00000000-0000-0000-0000-000000000501', '2026-11-12', '07:18', t_reason(false, 'ازدحام الطريق'), null, '00000000-0000-0000-0000-00000000aaaa'))->>'minutes' = '8', 'تسجيل التأخر بالاختيار من الفصل');
select t_ok((ind_record_lateness('00000000-0000-0000-0000-000000000501', '2026-11-12', '07:18', t_reason(false, 'ازدحام الطريق'), null, '00000000-0000-0000-0000-00000000aaaa'))->>'duplicate_request' = 'true', 'إعادة إرسال الطلب نفسه لا تنشئ سجلاً مكرراً');
select t_ok(t_err(format($$select ind_record_lateness('00000000-0000-0000-0000-000000000501', '2026-11-12', '07:30', '%s')$$, t_reason(false, 'ازدحام الطريق'))) = 'lateness_exists', 'سجل تأخر واحد للطالب في اليوم');
select t_ok((ind_record_lateness('00000000-0000-0000-0000-000000000504', '2026-11-12', '07:25', t_reason(true), 'موعد في الأحوال'))->>'minutes' = '15', 'تسجيل «سبب آخر» بنص');
select t_ok(ind_record_lateness('00000000-0000-0000-0000-000000000507', '2026-11-12', '07:25', t_reason(false))->>'error' = 'forbidden', 'منع التأخر لطالب خارج الإسناد');
select t_ok(jsonb_array_length(ind_lateness_list('2026-11-12')) = 2, 'قائمة التأخر اليومية');
select t_ok(jsonb_array_length(ind_section_lateness_roster('00000000-0000-0000-0000-00000000c002')) = 3, 'طلاب الفصل لشاشة التأخر');
select t_ok(ind_section_lateness_roster('00000000-0000-0000-0000-00000000c003')->>'error' = 'forbidden', 'منع قائمة فصل تأخر غير مسند');
select t_as(2);
select t_ok(ind_record_lateness('00000000-0000-0000-0000-000000000502', '2026-11-12', '07:25', t_reason(false))->>'error' = 'forbidden', 'مدخل الغياب لا يسجل التأخر');

-- 11) إعدادات التأخر للمنسق وحده، مع سجل التغيير
select t_as(4);
select t_ok(ind_set_lateness_settings('{"day_start":"07:00","late_after":"07:15"}')->>'error' = 'forbidden', 'مدخل التأخر لا يغير الإعدادات');
select t_as(1);
select ind_set_lateness_settings('{"day_start":"07:00","late_after":"07:15","grace_minutes":0,"calc_mode":"from_threshold"}');
reset role; select t_ok(ind_late_minutes('07:18') = 3, 'الحساب يتبع الإعداد الجديد'); set role authenticated;
select t_ok(exists (select 1 from jsonb_array_elements(ind_audit_list(50, 'settings')) e where e->>'action' = 'lateness_settings_changed' and e->'old'->>'late_after' = '07:10'), 'سجل تغيير الإعدادات بالقيمة السابقة');
select ind_set_lateness_settings('{"day_start":"07:00","late_after":"07:10"}');
select t_ok((ind_reason_save(null, 'سبب جديد'))->>'ok' = 'true', 'إضافة سبب تأخر');
select t_ok(t_err($$select ind_reason_save(null, 'ازدحام الطريق')$$) = 'name_taken', 'منع تكرار اسم السبب');

-- 12) شؤون الطلاب: اطلاع دون تعديل
select t_as(5);
select t_ok(jsonb_array_length(ind_roster('00000000-0000-0000-0000-00000000c003', '2026-11-12')->'students') = 3, 'شؤون الطلاب تطلع على جميع الفصول');
select t_ok((ind_roster('00000000-0000-0000-0000-00000000c002', '2026-11-11')->>'can_edit')::boolean = false, 'شؤون الطلاب لا تعدّل');
select t_ok(ind_save_attendance('00000000-0000-0000-0000-00000000c002', '2026-11-11', '[]')->>'error' = 'forbidden', 'شؤون الطلاب لا تسجل الغياب');
select t_ok((ind_dashboard('2026-11-12')->>'total')::int = 9, 'لوحة التحكم: إجمالي الطلاب');

-- 13) منسوب بلا دور ولا تكليف، ومستخدم غير مسجل
select t_as(6);
select t_ok(ind_dashboard('2026-11-12')->>'error' = 'forbidden', 'منسوب بلا دور لا يرى اللوحة');
select t_ok(jsonb_array_length(ind_meta('absence')->'sections') = 0, 'منسوب بلا تكليف لا يرى فصولاً');
select t_as(-1);
select t_ok(ind_whoami() is null, 'مستخدم غير مرتبط بمنسوب');
reset role;
set role anon;
select t_ok(t_err('select ind_whoami()') like 'permission denied%', 'الزائر لا يستدعي الدوال');
select t_ok(t_err('select * from ind_attendance_records') like 'permission denied%', 'الزائر لا يقرأ الجداول');
reset role;
set role authenticated;
select t_as(1);
select t_ok(t_err('select * from ind_attendance_records') like 'permission denied%', 'لا قراءة مباشرة للجداول حتى للمنسق');

-- 14) سلامة سجل العمليات
reset role;
select t_ok((select count(*) from ind_audit_logs where action = 'access_denied') >= 8, 'تسجيل محاولات الوصول غير المصرح');
select t_ok(t_err('update ind_audit_logs set action = $$x$$') = 'audit_immutable', 'سجل العمليات غير قابل للتعديل');
select t_ok(t_err('delete from ind_audit_logs') = 'audit_immutable', 'سجل العمليات غير قابل للحذف');
select t_ok((select count(*) from ind_attendance_records where day = '2026-11-12') = 2 and (select count(distinct (student_id, day)) from ind_attendance_records) = (select count(*) from ind_attendance_records), 'لا تكرار لسجل الطالب في اليوم');

-- 15) الدوال الداخلية مغلقة أمام الاستدعاء المباشر (0302)
set role authenticated; select t_as(2);
select t_ok(t_err($$select * from ind_section_students('00000000-0000-0000-0000-00000000c003', '2026-11-12')$$) like 'permission denied%', 'لا قراءة مباشرة لطلاب فصل عبر الدالة الداخلية');
select t_ok(t_err($$select ind_deny('x')$$) like 'permission denied%', 'لا كتابة سجلات وهمية عبر ind_deny');
reset role;
\echo HARDENING_PASSED
\echo ALL_TESTS_PASSED
