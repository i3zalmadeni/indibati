-- بيانات تجريبية وهمية للمعاينة المحلية فقط (لا تُرفع إلى أي قاعدة حقيقية)
insert into academic_years (id, name, starts_on, status) values ('00000000-0000-0000-0000-0000000000a1', '1448', '2026-09-06', 'current');
insert into grade_levels values ('m1', 'الأول المتوسط', 1, true), ('m2', 'الثاني المتوسط', 2, true), ('m3', 'الثالث المتوسط', 3, true);
insert into class_sections (id, year_id, grade_code, name)
select ('00000000-0000-0000-0000-000000000c' || g || s)::uuid, '00000000-0000-0000-0000-0000000000a1', 'm' || g, 'فصل ' || s from generate_series(1,3) g, generate_series(1,2) s;
with n(i, first, fam) as (select row_number() over (), f, l from unnest(array['عبدالله','محمد','فهد','سلمان','خالد','يوسف','عمر','ناصر','تركي','بدر','سعد','ريان','حمد','زياد','مشاري']) f, unnest(array['الغامدي','العتيبي','الدوسري','الشهري','القحطاني','المطيري']) l)
insert into students (id, student_no, full_name, study_status)
select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, (1100000 + i)::text, first || ' ' || (array['أحمد','علي','سعيد','حسن'])[1 + i % 4] || ' ' || fam, 'enrolled' from n where i <= 72;
insert into student_enrollments (student_id, year_id, grade_code, section_id, status, started_on)
select s.id, '00000000-0000-0000-0000-0000000000a1', 'm' || (1 + (k - 1) / 24), ('00000000-0000-0000-0000-000000000c' || (1 + (k - 1) / 24) || (1 + (k - 1) % 2))::uuid, 'enrolled', '2026-09-06'
from (select id, row_number() over (order by id) k from students) s;
insert into staff_members (id, user_id, full_name, job_title, account_status, is_active) values
  ('00000000-0000-0000-0000-0000000000e0', '00000000-0000-0000-0000-0000000000f0', 'مدير النواة', 'مدير المدرسة', 'active', true),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1', 'منسق الغياب', 'وكيل', 'active', true),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f2', 'مدخل غياب الأول', 'معلم', 'active', true),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000f4', 'مدخل التأخر', 'إداري', 'active', true),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000f5', 'شؤون الطلاب', 'وكيل شؤون الطلاب', 'active', true),
  ('00000000-0000-0000-0000-0000000000e7', null, 'معلم بلا حساب', 'معلم', 'none', true);
insert into staff_roles (staff_id, role_code) values ('00000000-0000-0000-0000-0000000000e0', 'core_admin');
insert into ind_staff_roles (staff_id, role) values ('00000000-0000-0000-0000-0000000000e1', 'coordinator'), ('00000000-0000-0000-0000-0000000000e5', 'affairs');
insert into ind_assignments (id, staff_id, task, starts_on) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e2', 'absence', '2026-09-06'), ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000e4', 'lateness', '2026-09-06');
insert into ind_assignment_sections values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c11'), ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000c12'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c11'), ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c12'), ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000c21');
insert into guardians (id, full_name, phone) select ('00000000-0000-0000-0000-0000000009' || lpad(g::text, 2, '0'))::uuid, 'ولي أمر ' || g, case when g % 4 = 0 then null else '9665000000' || lpad(g::text, 2, '0') end from generate_series(1, 24) g;
insert into student_guardians select ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, ('00000000-0000-0000-0000-0000000009' || lpad(g::text, 2, '0'))::uuid, 'father', true from generate_series(1, 24) g;
