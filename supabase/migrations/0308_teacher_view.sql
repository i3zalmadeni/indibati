-- =====================================================================
-- انضباطي · 0308 · فصل دور المعلم عن دور المنسق في الخادم.
-- لوحة المعلم ترسل علامة «ind-view=teacher» في ترويسة x-client-info مع كل طلب، فيعامل الخادم المستخدم
-- معاملة المعلم: لا صلاحيات منسق ولا إشراف ولا إدارة، ويبقى له ما أُسند إليه فقط.
-- العلامة لا تستطيع إلا أن تُنقص الصلاحيات، فلا أثر أمنياً لإرسالها من غير صاحبها.
-- يضيف ind_teacher_classes(): فصول المعلم من إسناد التدريس في النواة، وغياب طلابها وتأخرهم.
-- قابل لإعادة التنفيذ. لا يغيّر الجداول.
-- =====================================================================

create or replace function public.ind_teacher_view() returns boolean language sql stable set search_path = '' as $f$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-client-info', '') like '%ind-view=teacher%' $f$;

-- مدير النواة وأدوار انضباطي: تتعطل في لوحة المعلم، فتتبعها ind_is_coord و ind_can_oversee وكل ما يُبنى عليها
create or replace function public.ind_is_admin() returns boolean language sql stable security definer set search_path = '' as $f$
  select not public.ind_teacher_view() and coalesce(public.is_core_admin(), false) $f$;
create or replace function public.ind_has(p_role text) returns boolean language sql stable security definer set search_path = '' as $f$
  select not public.ind_teacher_view() and exists (select 1 from public.ind_staff_roles where staff_id = public.ind_me() and role = p_role) $f$;

-- فصول المعلم (لوحة المعلم): الفصول والمواد المسندة له في إسناد التدريس بالنواة للعام الحالي،
-- ولكل فصل: حالة التحضير اليوم، وغائبو اليوم، والمتأخرون اليوم، والأكثر غياباً هذا العام. اطلاع فقط.
create or replace function public.ind_teacher_classes(p_day date default null) returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare me uuid := public.ind_me(); d date := coalesce(p_day, public.ind_today()); y uuid := public.ind_current_year();
begin
  if me is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x order by x->>'sort', x->>'label') from (
    select jsonb_build_object(
      'section_id', c.id, 'label', g.name_ar || ' – ' || c.name, 'sort', lpad(g.sort_order::text, 3, '0'),
      'subjects', (select jsonb_agg(distinct coalesce(sj.name_ar, t2.subject_code)) from public.teaching_assignments t2
                    left join public.subjects sj on sj.code = t2.subject_code where t2.staff_id = me and t2.section_id = c.id and t2.year_id = y),
      'students', (select count(*) from public.student_enrollments e where e.section_id = c.id and e.year_id = y and e.status = 'enrolled'),
      'saved', exists (select 1 from public.ind_attendance_sessions ss where ss.section_id = c.id and ss.day = d),
      'locked', coalesce((select lk.is_locked from public.ind_attendance_locks lk where lk.section_id = c.id and lk.day = d), false),
      'absent', coalesce((select jsonb_agg(jsonb_build_object('name', s.full_name, 'no', s.student_no, 'status', r.status) order by s.full_name)
                  from public.ind_attendance_records r join public.students s on s.id = r.student_id where r.section_id = c.id and r.day = d), '[]'::jsonb),
      'late', coalesce((select jsonb_agg(jsonb_build_object('name', s.full_name, 'no', s.student_no, 'minutes', l.minutes, 'time', l.arrival_time) order by l.arrival_time)
                  from public.ind_lateness_records l join public.students s on s.id = l.student_id where l.section_id = c.id and l.day = d and l.voided_at is null), '[]'::jsonb),
      'top', coalesce((select jsonb_agg(z order by (z->>'days')::int desc, z->>'name') from (
                  select jsonb_build_object('name', s.full_name, 'no', s.student_no, 'days', count(*), 'unexcused', count(*) filter (where r.status = 'absent_unexcused')) z
                  from public.ind_attendance_records r join public.students s on s.id = r.student_id
                  join public.student_enrollments e on e.student_id = r.student_id and e.section_id = c.id and e.year_id = y
                  join public.ind_attendance_sessions ss on ss.id = r.session_id and ss.year_id = y
                  where r.section_id = c.id group by s.full_name, s.student_no having count(*) >= 3 order by count(*) desc limit 8) q), '[]'::jsonb)
    ) x
    from public.class_sections c join public.grade_levels g on g.code = c.grade_code
    where c.id in (select t.section_id from public.teaching_assignments t where t.staff_id = me and t.year_id = y)
  ) q), '[]'::jsonb);
end $f$;
revoke all on function public.ind_teacher_classes(date) from public, anon;
grant execute on function public.ind_teacher_classes(date) to authenticated;
grant execute on function public.ind_teacher_view() to authenticated;
