-- =====================================================================
-- انضباطي · 0306 · رقم جوال ولي الأمر من منصة النواة الرقمية.
-- المصدر: رقم ولي الأمر الأساسي في guardians إن وُجد، وإلا رقم الجوال المسجل للطالب في النواة (student_private.phone).
-- يُقرأ الرقم عند الحاجة من النواة مباشرة (دون نسخ)، فأي تحديث للرقم في النواة ينعكس فوراً على انضباطي.
-- لا يعدّل جداول النواة. الأرقام لا تُعاد إلى الواجهة؛ تُقرأ في الخادم عند الإرسال فقط.
-- =====================================================================

create or replace function public.ind_contact_phone(p_student uuid) returns text language sql stable security definer set search_path = '' as $f$
  select coalesce(
    (select nullif(trim(g.phone), '') from public.guardians g where g.id = public.ind_primary_guardian(p_student)),
    (select nullif(trim(sp.phone), '') from public.student_private sp where sp.student_id = p_student)) $f$;
create or replace function public.ind_has_phone(p_student uuid) returns boolean language sql stable security definer set search_path = '' as $f$
  select public.ind_contact_phone(p_student) is not null $f$;
-- مصدر الرقم للعرض فقط (دون الرقم نفسه): guardian | core | null
create or replace function public.ind_phone_source(p_student uuid) returns text language sql stable security definer set search_path = '' as $f$
  select case
    when exists (select 1 from public.guardians g where g.id = public.ind_primary_guardian(p_student) and nullif(trim(coalesce(g.phone, '')), '') is not null) then 'guardian'
    when exists (select 1 from public.student_private sp where sp.student_id = p_student and nullif(trim(coalesce(sp.phone, '')), '') is not null) then 'core' end $f$;

create or replace function public.ind_enqueue(p_student uuid, p_kind text, p_template text, p_vars jsonb, p_dedupe text, p_with_link boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $f$
declare g uuid := public.ind_primary_guardian(p_student); lk_id uuid; lk_token text; v jsonb := coalesce(p_vars, '{}'); nid uuid; has_phone boolean;
begin
  if p_dedupe is not null then
    select id into nid from public.ind_notifications where dedupe_key = p_dedupe and status <> 'cancelled';
    if found then return nid; end if;
    -- إشعار ملغى بالمفتاح نفسه: نحرر المفتاح ليمكن إعادة الإدراج
    update public.ind_notifications set dedupe_key = null where dedupe_key = p_dedupe and status = 'cancelled';
  end if;
  if not exists (select 1 from public.ind_notification_templates where code = p_template and is_active) then return null; end if;
  has_phone := public.ind_has_phone(p_student);
  if p_with_link then
    select l.link_id, l.token into lk_id, lk_token from public.ind_new_link(p_student, g) l;
    v := v || jsonb_build_object('link', coalesce(public.ind_setting('notifications')->>'portal_url', '') || '?t=' || lk_token);
  end if;
  v := v || jsonb_build_object('student', (select full_name from public.students where id = p_student));
  insert into public.ind_notifications (student_id, guardian_id, kind, template_code, vars, link_id, status, dedupe_key, created_by)
  values (p_student, g, p_kind, p_template, v, lk_id, case when has_phone then 'queued' else 'no_phone' end, p_dedupe, public.ind_me())
  returning id into nid;
  insert into public.ind_notification_events (notification_id, status) values (nid, case when has_phone then 'queued' else 'no_phone' end);
  return nid;
end $f$;

create or replace function public.ind_student_file(p_student uuid) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare yr uuid := public.ind_current_year(); e record; wk_start date := public.ind_today() - ((extract(dow from public.ind_today())::int) % 7);
begin
  select en.*, c.name sec, g.name_ar gname into e from public.student_enrollments en join public.class_sections c on c.id = en.section_id
    join public.grade_levels g on g.code = en.grade_code where en.student_id = p_student and en.year_id = yr;
  if not (public.ind_can_oversee() or public.ind_assigned(e.section_id, 'absence') or public.ind_assigned(e.section_id, 'lateness')) then
    return public.ind_deny('student_file', jsonb_build_object('student', p_student));
  end if;
  return jsonb_build_object(
    'student', (select jsonb_build_object('id', s.id, 'name', s.full_name, 'no', s.student_no, 'grade', e.gname, 'section', e.sec,
       'has_guardian', public.ind_primary_guardian(s.id) is not null,
       'has_phone', public.ind_has_phone(s.id), 'phone_source', public.ind_phone_source(s.id))
       from public.students s where s.id = p_student),
    'can_link', public.ind_is_coord(),
    'absence', jsonb_build_object(
      'excused', (select count(*) from public.ind_attendance_records r join public.ind_attendance_sessions s on s.id = r.session_id where r.student_id = p_student and s.year_id = yr and r.status = 'absent_excused'),
      'unexcused', (select count(*) from public.ind_attendance_records r join public.ind_attendance_sessions s on s.id = r.session_id where r.student_id = p_student and s.year_id = yr and r.status = 'absent_unexcused'),
      'week', (select count(*) from public.ind_attendance_records r where r.student_id = p_student and r.day >= wk_start),
      'consecutive_max', public.ind_absence_count(p_student, 'all', 'consecutive'),
      'days', coalesce((select jsonb_agg(jsonb_build_object('day', r.day, 'status', r.status) order by r.day desc)
        from public.ind_attendance_records r join public.ind_attendance_sessions s on s.id = r.session_id where r.student_id = p_student and s.year_id = yr), '[]'::jsonb)),
    'lateness', jsonb_build_object(
      'count', (select count(*) from public.ind_lateness_records l where l.student_id = p_student and l.year_id = yr and l.voided_at is null),
      'minutes', (select coalesce(sum(minutes), 0) from public.ind_lateness_records l where l.student_id = p_student and l.year_id = yr and l.voided_at is null),
      'rows', coalesce((select jsonb_agg(jsonb_build_object('day', l.day, 'arrival', to_char(l.arrival_time, 'HH24:MI'), 'minutes', l.minutes,
          'reason', coalesce(nullif(l.reason_text, ''), r.name)) order by l.day desc)
        from public.ind_lateness_records l join public.ind_lateness_reasons r on r.id = l.reason_id where l.student_id = p_student and l.year_id = yr and l.voided_at is null), '[]'::jsonb)),
    'excuses', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'day', x.day, 'reason', x.reason, 'status', x.status, 'submitted_at', x.submitted_at) order by x.submitted_at desc)
      from public.ind_excuses x where x.student_id = p_student), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'status', n.status, 'at', coalesce(n.sent_at, n.created_at), 'error', n.error) order by n.created_at desc)
      from public.ind_notifications n where n.student_id = p_student), '[]'::jsonb),
    'escalations', coalesce((select jsonb_agg(jsonb_build_object('id', er.id, 'level', ru.level, 'label', ru.label, 'days', er.days_count, 'status', er.status, 'at', er.created_at, 'printed_at', er.printed_at) order by ru.level)
      from public.ind_escalation_records er join public.ind_escalation_rules ru on ru.id = er.rule_id where er.student_id = p_student and er.year_id = yr), '[]'::jsonb));
end $f$;

create or replace function public.ind_notice_candidates(p_day date, p_scope text default 'all', p_sections uuid[] default null, p_grade text default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_is_coord() then return public.ind_deny('notice_candidates'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('student_id', r.student_id, 'name', s.full_name, 'no', s.student_no, 'status', r.status,
      'label', g.name_ar || ' – ' || c.name,
      'guardian', (select gg.full_name from public.guardians gg where gg.id = public.ind_primary_guardian(r.student_id)),
      'has_phone', public.ind_has_phone(r.student_id), 'phone_source', public.ind_phone_source(r.student_id),
      'notice', (select jsonb_build_object('id', n.id, 'status', n.status) from public.ind_notifications n where n.dedupe_key = 'absence:' || r.student_id || ':' || p_day))
      order by g.sort_order, c.name, s.full_name)
    from public.ind_attendance_records r join public.students s on s.id = r.student_id
    join public.class_sections c on c.id = r.section_id join public.grade_levels g on g.code = c.grade_code
    where r.day = p_day and r.section_id = any (public.ind_resolve_sections(p_sections, p_scope, p_grade))), '[]'::jsonb);
end $f$;

create or replace function public.ind_svc_claim(p_limit int default 20) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare res jsonb;
begin
  with c as (
    update public.ind_notifications n set status = 'sending', attempts = attempts + 1, updated_at = now()
    where n.id in (select id from public.ind_notifications where status = 'queued' order by created_at limit least(greatest(p_limit, 1), 100) for update skip locked)
    returning n.*)
  select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'vars', c.vars, 'phone', public.ind_contact_phone(c.student_id),
    'template', jsonb_build_object('body', t.body, 'wa_template', t.wa_template, 'wa_lang', t.wa_lang, 'wa_params', t.wa_params))) into res
  from c join public.ind_notification_templates t on t.code = c.template_code;
  return coalesce(res, '[]'::jsonb);
end $f$;

-- الرسائل المحفوظة «بلا رقم» لأن جدول أولياء الأمور كان فارغاً: تعود إلى الطابور إن صار للطالب رقم في النواة
update public.ind_notifications n set status = 'queued', updated_at = now()
where n.status = 'no_phone' and public.ind_has_phone(n.student_id);

do $$ declare f text; begin
  foreach f in array array['public.ind_contact_phone(uuid)', 'public.ind_has_phone(uuid)', 'public.ind_phone_source(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
