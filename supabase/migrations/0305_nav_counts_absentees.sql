-- =====================================================================
-- انضباطي · 0305 · شارات قائمة لوحة التحكم، وقائمة غائبي اليوم في الرئيسية.
-- دوال قراءة فقط. لا جداول جديدة ولا تعديل على جداول النواة.
-- =====================================================================

-- أعداد الشارات بجوار عناصر القائمة، بحسب نطاق المستخدم:
--   unsaved  : فصول لم يُحفظ تحضيرها اليوم (المنسق وشؤون الطلاب: جميع الفصول، ومدخل البيانات: فصوله المسندة)
--   unlocked : فصول حُفظ تحضيرها ولم تُثبَّت بعد
--   excuses  : أعذار لم يُبت فيها (جديدة أو قيد المراجعة)، لمن له الاطلاع الإشرافي فقط
-- يوم العطلة الأسبوعية: لا شارات للتحضير والتثبيت.
create or replace function public.ind_nav_counts(p_day date default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare d date := coalesce(p_day, public.ind_today()); secs jsonb; wk boolean;
begin
  if public.ind_me() is null then return public.ind_deny('nav_counts'); end if;
  wk := extract(dow from d)::int = any (select jsonb_array_elements_text(coalesce(public.ind_setting('attendance')->'weekend', '[]'))::int);
  secs := case when wk then '[]'::jsonb else public.ind_day_status(d, null) end;
  if jsonb_typeof(secs) <> 'array' then secs := '[]'::jsonb; end if;
  return jsonb_build_object('day', d, 'weekend', wk,
    'unsaved', (select count(*) from jsonb_array_elements(secs) x where not (x->>'saved')::boolean),
    'unlocked', (select count(*) from jsonb_array_elements(secs) x where (x->>'saved')::boolean and not (x->>'locked')::boolean),
    'excuses', case when public.ind_can_oversee() then (select count(*) from public.ind_excuses where status in ('submitted','under_review')) else 0 end);
end $f$;

-- أسماء الغائبين في يوم مع الفصل والحالة وحالة العذر، للمنسق وشؤون الطلاب
create or replace function public.ind_day_absentees(p_day date default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare d date := coalesce(p_day, public.ind_today());
begin
  if not public.ind_can_oversee() then return public.ind_deny('day_absentees'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('student_id', r.student_id, 'name', s.full_name, 'no', s.student_no,
      'section_id', c.id, 'label', g.name_ar || ' – ' || c.name, 'status', r.status,
      'locked', coalesce(lk.is_locked, false),
      'excuse', (select x.status from public.ind_excuses x where x.student_id = r.student_id and x.day = d order by x.submitted_at desc limit 1))
      order by g.sort_order, c.name, s.full_name)
    from public.ind_attendance_records r join public.students s on s.id = r.student_id
    join public.class_sections c on c.id = r.section_id join public.grade_levels g on g.code = c.grade_code
    left join public.ind_attendance_locks lk on lk.section_id = r.section_id and lk.day = d
    where r.day = d), '[]'::jsonb);
end $f$;

do $$ declare f text; begin
  foreach f in array array['public.ind_nav_counts(date)', 'public.ind_day_absentees(date)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
