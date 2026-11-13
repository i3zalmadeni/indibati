-- =====================================================================
-- انضباطي (indibati) · 0301 · الأساس: الأدوار، التكليفات، التحضير اليومي، التثبيت، التأخر، التدقيق
-- يعمل على قاعدة النواة الرقمية نفسها بجداول مستقلة ببادئة ind_.
-- لا يعدّل أي جدول من جداول النواة، ولا ينسخ بيانات الطلاب أو المنسوبين: الربط بالمعرّفات الثابتة (UUID).
-- كل كتابة عبر دوال ind_* تتحقق من الدور والإسناد والتثبيت على الخادم. الجداول مغلقة بـ RLS.
-- التوقيت المعتمد: Asia/Riyadh (القاعدة نفسها على UTC).
-- =====================================================================

-- ---------- الأدوار الخاصة بالنظام ----------
-- coordinator: منسق الغياب · affairs: شؤون الطلاب · portal_admin: مدير البوابة
-- مدخلو البيانات لا دور ثابت لهم: صلاحيتهم من التكليفات (ind_assignments).
create table if not exists public.ind_staff_roles (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id),
  role text not null check (role in ('coordinator','affairs','portal_admin')),
  created_by uuid references public.staff_members(id),
  created_at timestamptz not null default now(),
  unique (staff_id, role)
);

-- ---------- الإعدادات ----------
create table if not exists public.ind_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.staff_members(id),
  updated_at timestamptz not null default now()
);
insert into public.ind_settings (key, value) values
  ('attendance', '{"max_backdate_days": 30, "weekend": [5, 6]}'),
  ('lateness', '{"day_start": "07:00", "late_after": "07:10", "grace_minutes": 0, "calc_mode": "from_threshold", "notify_enabled": false}')
on conflict (key) do nothing;

-- ---------- أسباب التأخر ----------
create table if not exists public.ind_lateness_reasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_other boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);
insert into public.ind_lateness_reasons (name, is_other, sort_order) values
  ('ازدحام الطريق', false, 1), ('تأخر وسيلة النقل', false, 2), ('الاستيقاظ متأخراً', false, 3),
  ('ظرف عائلي', false, 4), ('مراجعة صحية', false, 5), ('مرافقة أحد أفراد الأسرة', false, 6),
  ('سبب شخصي', false, 7), ('سبب آخر', true, 99)
on conflict (name) do nothing;

-- ---------- التكليفات: مستقلة لكل مهمة ----------
create table if not exists public.ind_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id),
  task text not null check (task in ('absence','lateness')),
  starts_on date not null default ((now() at time zone 'Asia/Riyadh')::date),
  status text not null default 'active' check (status in ('active','stopped')),
  note text,
  created_by uuid references public.staff_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- تكليف فعّال واحد لكل منسوب ومهمة (تُضاف إليه الفصول) منعاً للتكرار
create unique index if not exists ind_assign_one_active on public.ind_assignments (staff_id, task) where status = 'active';
create table if not exists public.ind_assignment_sections (
  assignment_id uuid not null references public.ind_assignments(id) on delete cascade,
  section_id uuid not null references public.class_sections(id),
  primary key (assignment_id, section_id)
);
create index if not exists ind_assign_sec_idx on public.ind_assignment_sections (section_id);

-- ---------- التحضير اليومي ----------
-- جلسة لكل فصل وتاريخ. وجودها يعني أن التحضير حُفظ (ومن لم يُسجَّل غيابه فهو حاضر).
create table if not exists public.ind_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.class_sections(id),
  day date not null,
  year_id uuid not null references public.academic_years(id),
  saved_by uuid references public.staff_members(id),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (section_id, day)
);
-- سجلات الغياب فقط (الحضور هو الأصل). سجل واحد لكل طالب في اليوم.
create table if not exists public.ind_attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ind_attendance_sessions(id) on delete restrict,
  student_id uuid not null references public.students(id),
  section_id uuid not null references public.class_sections(id),
  day date not null,
  status text not null check (status in ('absent_excused','absent_unexcused')),
  recorded_by uuid references public.staff_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, day)
);
create index if not exists ind_att_rec_day_idx on public.ind_attendance_records (day, section_id);
create index if not exists ind_att_rec_student_idx on public.ind_attendance_records (student_id, day);

-- حالة التثبيت لكل فصل وتاريخ
create table if not exists public.ind_attendance_locks (
  section_id uuid not null references public.class_sections(id),
  day date not null,
  is_locked boolean not null default true,
  locked_by uuid references public.staff_members(id),
  locked_at timestamptz,
  unlocked_by uuid references public.staff_members(id),
  unlocked_at timestamptz,
  unlock_reason text,
  primary key (section_id, day)
);
create index if not exists ind_locks_day_idx on public.ind_attendance_locks (day);

-- ---------- التأخر (وحدة مستقلة عن التحضير) ----------
create table if not exists public.ind_lateness_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  section_id uuid not null references public.class_sections(id),
  grade_code text not null,
  year_id uuid not null references public.academic_years(id),
  day date not null,
  arrival_time time not null,
  minutes int not null check (minutes >= 0),
  reason_id uuid not null references public.ind_lateness_reasons(id),
  reason_text text,
  recorded_by uuid references public.staff_members(id),
  created_at timestamptz not null default now(),
  request_id uuid unique,
  voided_at timestamptz,
  voided_by uuid references public.staff_members(id),
  void_reason text
);
create unique index if not exists ind_late_one_per_day on public.ind_lateness_records (student_id, day) where voided_at is null;
create index if not exists ind_late_day_idx on public.ind_lateness_records (day, section_id);

-- ---------- سجل العمليات (إلحاق فقط) ----------
create table if not exists public.ind_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists ind_audit_idx on public.ind_audit_logs (created_at desc);
create index if not exists ind_audit_entity_idx on public.ind_audit_logs (entity, entity_id);
create or replace function public.ind_audit_immutable() returns trigger language plpgsql as $f$
begin raise exception 'audit_immutable'; end $f$;
drop trigger if exists ind_audit_no_change on public.ind_audit_logs;
create trigger ind_audit_no_change before update or delete on public.ind_audit_logs for each row execute function public.ind_audit_immutable();

-- =====================================================================
-- دوال الهوية والصلاحيات
-- =====================================================================
create or replace function public.ind_today() returns date language sql stable set search_path = '' as $f$
  select (now() at time zone 'Asia/Riyadh')::date $f$;
create or replace function public.ind_me() returns uuid language sql stable security definer set search_path = '' as $f$
  select id from public.staff_members where user_id = auth.uid() and is_active and account_status = 'active' limit 1 $f$;
create or replace function public.ind_is_admin() returns boolean language sql stable security definer set search_path = '' as $f$
  select coalesce(public.is_core_admin(), false) $f$;
create or replace function public.ind_has(p_role text) returns boolean language sql stable security definer set search_path = '' as $f$
  select exists (select 1 from public.ind_staff_roles where staff_id = public.ind_me() and role = p_role) $f$;
-- المنسق: منسق الغياب أو مدير النواة
create or replace function public.ind_is_coord() returns boolean language sql stable security definer set search_path = '' as $f$
  select public.ind_me() is not null and (public.ind_is_admin() or public.ind_has('coordinator')) $f$;
-- الاطلاع الإشرافي: المنسق وشؤون الطلاب
create or replace function public.ind_can_oversee() returns boolean language sql stable security definer set search_path = '' as $f$
  select public.ind_is_coord() or public.ind_has('affairs') $f$;
-- هل للمستخدم تكليف فعّال على هذا الفصل لهذه المهمة؟
create or replace function public.ind_assigned(p_section uuid, p_task text) returns boolean language sql stable security definer set search_path = '' as $f$
  select exists (select 1 from public.ind_assignments a join public.ind_assignment_sections s on s.assignment_id = a.id
    where a.staff_id = public.ind_me() and a.task = p_task and a.status = 'active' and a.starts_on <= public.ind_today() and s.section_id = p_section) $f$;

create or replace function public.ind_audit(p_action text, p_entity text, p_id text, p_old jsonb, p_new jsonb, p_reason text default null)
returns void language sql security definer set search_path = '' as $f$
  insert into public.ind_audit_logs (actor_id, action, entity, entity_id, old_data, new_data, reason)
  values (public.ind_me(), p_action, p_entity, p_id, p_old, p_new, p_reason) $f$;
-- تسجيل محاولة وصول غير مصرح بها ثم إرجاع خطأ دون إلغاء التسجيل
create or replace function public.ind_deny(p_what text, p_detail jsonb default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  insert into public.ind_audit_logs (actor_id, action, entity, entity_id, new_data)
  values (public.ind_me(), 'access_denied', p_what, auth.uid()::text, p_detail);
  return jsonb_build_object('error', 'forbidden');
end $f$;

create or replace function public.ind_setting(p_key text) returns jsonb language sql stable security definer set search_path = '' as $f$
  select value from public.ind_settings where key = p_key $f$;

-- العام الحالي
create or replace function public.ind_current_year() returns uuid language sql stable security definer set search_path = '' as $f$
  select id from public.academic_years where status = 'current' order by starts_on desc nulls last limit 1 $f$;

-- طلاب الفصل في يوم محدد (من النواة مباشرة، دون نسخ)
create or replace function public.ind_section_students(p_section uuid, p_day date)
returns table (student_id uuid, student_no text, full_name text, grade_code text)
language sql stable security definer set search_path = '' as $f$
  select s.id, s.student_no, s.full_name, e.grade_code
  from public.student_enrollments e join public.students s on s.id = e.student_id
  where e.section_id = p_section
    and coalesce(e.started_on, '-infinity'::date) <= p_day
    and (e.status = 'enrolled' or e.ended_on >= p_day)
  order by s.full_name $f$;

-- التحقق من صلاحية التاريخ للتسجيل
create or replace function public.ind_check_day(p_section uuid, p_day date) returns void language plpgsql stable security definer set search_path = '' as $f$
declare y record; cfg jsonb := public.ind_setting('attendance');
begin
  if p_day is null then raise exception 'day_required'; end if;
  if p_day > public.ind_today() then raise exception 'date_future'; end if;
  select a.* into y from public.class_sections c join public.academic_years a on a.id = c.year_id where c.id = p_section;
  if not found then raise exception 'section_not_found'; end if;
  if y.status <> 'current' then raise exception 'year_not_current'; end if;
  if y.starts_on is not null and p_day < y.starts_on then raise exception 'date_out_of_year'; end if;
  if extract(dow from p_day)::int = any (select jsonb_array_elements_text(coalesce(cfg->'weekend', '[]'))::int) then raise exception 'weekend_day'; end if;
  if not public.ind_is_coord() and p_day < public.ind_today() - coalesce((cfg->>'max_backdate_days')::int, 30) then raise exception 'date_too_old'; end if;
end $f$;

-- =====================================================================
-- الهوية والقوائم
-- =====================================================================
create or replace function public.ind_whoami() returns jsonb language sql stable security definer set search_path = '' as $f$
  select case when public.ind_me() is null then null else jsonb_build_object(
    'staff_id', public.ind_me(),
    'name', (select full_name from public.staff_members where id = public.ind_me()),
    'job_title', (select job_title from public.staff_members where id = public.ind_me()),
    'is_admin', public.ind_is_admin(),
    'is_coord', public.ind_is_coord(),
    'is_affairs', public.ind_has('affairs'),
    'is_portal_admin', public.ind_is_admin() or public.ind_has('portal_admin'),
    'tasks', coalesce((select jsonb_agg(distinct a.task) from public.ind_assignments a
       where a.staff_id = public.ind_me() and a.status = 'active' and a.starts_on <= public.ind_today()), '[]'::jsonb),
    'today', public.ind_today()) end $f$;

-- الصفوف والفصول المتاحة للمستخدم لمهمة محددة (absence | lateness | view)
create or replace function public.ind_meta(p_task text default 'view') returns jsonb language plpgsql security definer set search_path = '' as $f$
declare all_secs boolean;
begin
  if public.ind_me() is null then return public.ind_deny('meta'); end if;
  all_secs := public.ind_is_coord() or (p_task = 'view' and public.ind_has('affairs'));
  return jsonb_build_object(
    'today', public.ind_today(),
    'year_id', public.ind_current_year(),
    'grades', coalesce((select jsonb_agg(jsonb_build_object('code', g.code, 'name', g.name_ar) order by g.sort_order)
       from public.grade_levels g where g.is_active), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'grade', c.grade_code, 'name', c.name,
         'label', g.name_ar || ' – ' || c.name) order by g.sort_order, c.name)
       from public.class_sections c join public.grade_levels g on g.code = c.grade_code
       where c.year_id = public.ind_current_year() and c.is_active
         and (all_secs or public.ind_assigned(c.id, case when p_task = 'view' then 'absence' else p_task end)
              or (p_task = 'view' and public.ind_assigned(c.id, 'lateness')))), '[]'::jsonb),
    'reasons', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'is_other', r.is_other) order by r.sort_order, r.name)
       from public.ind_lateness_reasons r where r.is_active), '[]'::jsonb),
    'attendance', public.ind_setting('attendance'),
    'lateness', public.ind_setting('lateness'));
end $f$;

-- =====================================================================
-- التحضير اليومي
-- =====================================================================
create or replace function public.ind_roster(p_section uuid, p_day date) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare lk record; ses record; can_edit boolean;
begin
  if not (public.ind_can_oversee() or public.ind_assigned(p_section, 'absence')) then
    return public.ind_deny('roster', jsonb_build_object('section', p_section, 'day', p_day));
  end if;
  select * into lk from public.ind_attendance_locks where section_id = p_section and day = p_day;
  select * into ses from public.ind_attendance_sessions where section_id = p_section and day = p_day;
  can_edit := (public.ind_is_coord() or public.ind_assigned(p_section, 'absence')) and not coalesce(lk.is_locked, false);
  return jsonb_build_object(
    'section', (select jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade_code, 'grade_name', g.name_ar)
                from public.class_sections c join public.grade_levels g on g.code = c.grade_code where c.id = p_section),
    'day', p_day,
    'locked', coalesce(lk.is_locked, false),
    'locked_at', lk.locked_at, 'locked_by', (select full_name from public.staff_members where id = lk.locked_by),
    'saved', ses.id is not null, 'saved_at', ses.saved_at, 'saved_by', (select full_name from public.staff_members where id = ses.saved_by),
    'can_edit', can_edit,
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', st.student_id, 'no', st.student_no, 'name', st.full_name,
        'status', coalesce(r.status, 'present')) order by st.full_name)
      from public.ind_section_students(p_section, p_day) st
      left join public.ind_attendance_records r on r.student_id = st.student_id and r.day = p_day), '[]'::jsonb));
end $f$;

-- حفظ التحضير: p_absences = [{"student_id":..., "status":"absent_excused|absent_unexcused"}]
-- يستبدل قائمة الغائبين للفصل في ذلك اليوم، ومن لم يُذكر فهو حاضر.
create or replace function public.ind_save_attendance(p_section uuid, p_day date, p_absences jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.ind_me(); ses_id uuid; yr uuid; x jsonb; sid uuid; st text; old_rows jsonb; new_rows jsonb; n_abs int := 0;
begin
  if me is null or not (public.ind_is_coord() or public.ind_assigned(p_section, 'absence')) then
    return public.ind_deny('save_attendance', jsonb_build_object('section', p_section, 'day', p_day));
  end if;
  perform public.ind_check_day(p_section, p_day);
  -- قفل الصف لمنع السباق بين عمليتي حفظ وتثبيت متزامنتين
  perform 1 from public.class_sections where id = p_section for update;
  if exists (select 1 from public.ind_attendance_locks where section_id = p_section and day = p_day and is_locked) then
    raise exception 'locked';
  end if;
  if jsonb_typeof(coalesce(p_absences, '[]'::jsonb)) <> 'array' then raise exception 'bad_request'; end if;
  -- التحقق من أن كل طالب ينتمي إلى الفصل في ذلك اليوم، وأن الحالة صحيحة، ولا تكرار
  for x in select * from jsonb_array_elements(coalesce(p_absences, '[]'::jsonb)) loop
    sid := (x->>'student_id')::uuid; st := x->>'status';
    if st not in ('absent_excused','absent_unexcused') then raise exception 'status_invalid'; end if;
    if not exists (select 1 from public.ind_section_students(p_section, p_day) s where s.student_id = sid) then raise exception 'student_not_in_section'; end if;
  end loop;
  if (select count(*) from jsonb_array_elements(coalesce(p_absences, '[]'::jsonb))) <>
     (select count(distinct e->>'student_id') from jsonb_array_elements(coalesce(p_absences, '[]'::jsonb)) e) then raise exception 'duplicate_student'; end if;
  -- طالب مسجّل غائباً في فصل آخر في اليوم نفسه (نُقل بين الفصول) يمنع التكرار
  if exists (select 1 from public.ind_attendance_records r, jsonb_array_elements(coalesce(p_absences, '[]'::jsonb)) e
             where r.student_id = (e->>'student_id')::uuid and r.day = p_day and r.section_id <> p_section) then raise exception 'recorded_in_other_section'; end if;

  select c.year_id into yr from public.class_sections c where c.id = p_section;
  select coalesce(jsonb_agg(jsonb_build_object('student_id', student_id, 'status', status) order by student_id), '[]'::jsonb) into old_rows
    from public.ind_attendance_records where section_id = p_section and day = p_day;

  insert into public.ind_attendance_sessions (section_id, day, year_id, saved_by, saved_at) values (p_section, p_day, yr, me, now())
  on conflict (section_id, day) do update set saved_by = excluded.saved_by, saved_at = excluded.saved_at
  returning id into ses_id;

  delete from public.ind_attendance_records r where r.section_id = p_section and r.day = p_day
    and not exists (select 1 from jsonb_array_elements(coalesce(p_absences, '[]'::jsonb)) e where (e->>'student_id')::uuid = r.student_id);
  insert into public.ind_attendance_records (session_id, student_id, section_id, day, status, recorded_by)
  select ses_id, (e->>'student_id')::uuid, p_section, p_day, e->>'status', me from jsonb_array_elements(coalesce(p_absences, '[]'::jsonb)) e
  on conflict (student_id, day) do update set status = excluded.status, recorded_by = excluded.recorded_by, updated_at = now()
    where public.ind_attendance_records.status is distinct from excluded.status;

  select coalesce(jsonb_agg(jsonb_build_object('student_id', student_id, 'status', status) order by student_id), '[]'::jsonb), count(*) into new_rows, n_abs
    from public.ind_attendance_records where section_id = p_section and day = p_day;
  if old_rows is distinct from new_rows or not exists (select 1 from public.ind_audit_logs where entity = 'attendance' and entity_id = p_section || '@' || p_day) then
    perform public.ind_audit(case when old_rows = '[]'::jsonb and n_abs = 0 then 'attendance_saved' when old_rows = '[]'::jsonb then 'attendance_recorded' else 'attendance_modified' end,
      'attendance', p_section || '@' || p_day, old_rows, new_rows, p_reason);
  end if;
  return jsonb_build_object('ok', true, 'absent', n_abs);
end $f$;

-- حالة التحضير والتثبيت لكل فصل في يوم (للوحة ولشاشة التثبيت)
create or replace function public.ind_day_status(p_day date, p_grade text default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare all_secs boolean := public.ind_can_oversee();
begin
  if public.ind_me() is null then return public.ind_deny('day_status'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'grade', c.grade_code, 'label', g.name_ar || ' – ' || c.name,
      'students', (select count(*) from public.ind_section_students(c.id, p_day)),
      'saved', ses.id is not null, 'saved_at', ses.saved_at,
      'locked', coalesce(lk.is_locked, false), 'locked_at', lk.locked_at,
      'excused', (select count(*) from public.ind_attendance_records r where r.section_id = c.id and r.day = p_day and r.status = 'absent_excused'),
      'unexcused', (select count(*) from public.ind_attendance_records r where r.section_id = c.id and r.day = p_day and r.status = 'absent_unexcused'),
      'mine', public.ind_assigned(c.id, 'absence')) order by g.sort_order, c.name)
    from public.class_sections c join public.grade_levels g on g.code = c.grade_code
    left join public.ind_attendance_sessions ses on ses.section_id = c.id and ses.day = p_day
    left join public.ind_attendance_locks lk on lk.section_id = c.id and lk.day = p_day
    where c.year_id = public.ind_current_year() and c.is_active and (p_grade is null or c.grade_code = p_grade)
      and (all_secs or public.ind_assigned(c.id, 'absence'))), '[]'::jsonb);
end $f$;

-- نطاق الفصول: قائمة محددة، أو جميع فصول صف، أو جميع الفصول
create or replace function public.ind_resolve_sections(p_sections uuid[], p_scope text, p_grade text) returns uuid[] language sql stable security definer set search_path = '' as $f$
  select case
    when p_scope = 'all' then (select coalesce(array_agg(c.id), '{}') from public.class_sections c where c.year_id = public.ind_current_year() and c.is_active)
    when p_scope = 'grade' then (select coalesce(array_agg(c.id), '{}') from public.class_sections c where c.year_id = public.ind_current_year() and c.is_active and c.grade_code = p_grade)
    else coalesce(p_sections, '{}') end $f$;

-- التثبيت. مدخل البيانات يثبت فصوله المسندة فقط. الفصول غير المحفوظة لا تُثبَّت إلا بموافقة صريحة من المنسق (p_include_unsaved).
create or replace function public.ind_lock(p_day date, p_scope text default 'list', p_sections uuid[] default null, p_grade text default null, p_include_unsaved boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.ind_me(); coord boolean := public.ind_is_coord(); sec uuid; secs uuid[]; done uuid[] := '{}'; skipped uuid[] := '{}'; already uuid[] := '{}'; denied uuid[] := '{}'; was_unlocked boolean;
begin
  if me is null then return public.ind_deny('lock'); end if;
  if p_scope not in ('list','grade','all') then raise exception 'bad_request'; end if;
  if p_day > public.ind_today() then raise exception 'date_future'; end if;
  secs := public.ind_resolve_sections(p_sections, p_scope, p_grade);
  if cardinality(secs) = 0 then raise exception 'no_sections'; end if;
  -- قائمة محددة تتضمن فصلاً غير مسند: يُرفض الطلب كله قبل أي تغيير
  if p_scope = 'list' and not coord and exists (select 1 from unnest(secs) u where not public.ind_assigned(u, 'absence')) then
    return public.ind_deny('lock', jsonb_build_object('sections', to_jsonb(secs), 'day', p_day));
  end if;
  foreach sec in array secs loop
    if not (coord or public.ind_assigned(sec, 'absence')) then denied := denied || sec; continue; end if;
    perform 1 from public.class_sections where id = sec for update;
    if exists (select 1 from public.ind_attendance_locks where section_id = sec and day = p_day and is_locked) then already := already || sec; continue; end if;
    if not exists (select 1 from public.ind_attendance_sessions where section_id = sec and day = p_day) then
      if not (coord and p_include_unsaved) then skipped := skipped || sec; continue; end if;
      perform public.ind_check_day(sec, p_day);
      insert into public.ind_attendance_sessions (section_id, day, year_id, saved_by) select sec, p_day, c.year_id, me from public.class_sections c where c.id = sec;
    end if;
    was_unlocked := exists (select 1 from public.ind_attendance_locks where section_id = sec and day = p_day);
    insert into public.ind_attendance_locks (section_id, day, is_locked, locked_by, locked_at) values (sec, p_day, true, me, now())
    on conflict (section_id, day) do update set is_locked = true, locked_by = me, locked_at = now();
    perform public.ind_audit(case when was_unlocked then 'relock' else 'lock' end, 'attendance_lock', sec || '@' || p_day, null,
      jsonb_build_object('scope', p_scope, 'grade', p_grade), null);
    done := done || sec;
  end loop;
  return jsonb_build_object('locked', to_jsonb(done), 'already', to_jsonb(already), 'skipped_unsaved', to_jsonb(skipped), 'not_assigned', to_jsonb(denied));
end $f$;

-- إلغاء التثبيت: للمنسق وحده، وبسبب إلزامي، ولأي تاريخ سابق
create or replace function public.ind_unlock(p_day date, p_reason text, p_scope text default 'list', p_sections uuid[] default null, p_grade text default null)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.ind_me(); sec uuid; done uuid[] := '{}';
begin
  if not public.ind_is_coord() then return public.ind_deny('unlock', jsonb_build_object('day', p_day)); end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;
  if p_scope not in ('list','grade','all') then raise exception 'bad_request'; end if;
  foreach sec in array public.ind_resolve_sections(p_sections, p_scope, p_grade) loop
    update public.ind_attendance_locks set is_locked = false, unlocked_by = me, unlocked_at = now(), unlock_reason = trim(p_reason)
      where section_id = sec and day = p_day and is_locked;
    if found then
      perform public.ind_audit('unlock', 'attendance_lock', sec || '@' || p_day, null, jsonb_build_object('scope', p_scope), trim(p_reason));
      done := done || sec;
    end if;
  end loop;
  return jsonb_build_object('unlocked', to_jsonb(done));
end $f$;

-- =====================================================================
-- التأخر
-- =====================================================================
create or replace function public.ind_late_minutes(p_arrival time) returns int language plpgsql security definer set search_path = '' as $f$
declare c jsonb := public.ind_setting('lateness'); base time; thr time; m int;
begin
  base := (c->>'day_start')::time; thr := (c->>'late_after')::time + make_interval(mins => coalesce((c->>'grace_minutes')::int, 0));
  if p_arrival <= thr then return 0; end if;
  m := floor(extract(epoch from (p_arrival - case when c->>'calc_mode' = 'from_start' then base else thr end)) / 60)::int;
  return greatest(m, 0);
end $f$;

-- البحث عن طالب في الفصول المتاحة للمهمة
create or replace function public.ind_student_search(p_q text, p_task text default 'lateness', p_limit int default 15) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare q text := trim(coalesce(p_q, '')); all_secs boolean;
begin
  if public.ind_me() is null then return public.ind_deny('student_search'); end if;
  if length(q) < 2 then return '[]'::jsonb; end if;
  all_secs := public.ind_is_coord() or (p_task = 'view' and public.ind_has('affairs'));
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id', s.id, 'no', s.student_no, 'name', s.full_name, 'grade', e.grade_code, 'grade_name', g.name_ar,
      'section_id', c.id, 'section', c.name) x
    from public.student_enrollments e join public.students s on s.id = e.student_id
    join public.class_sections c on c.id = e.section_id join public.grade_levels g on g.code = e.grade_code
    where e.year_id = public.ind_current_year() and e.status = 'enrolled'
      and (s.full_name ilike '%' || q || '%' or s.student_no = q or s.student_no like q || '%')
      and (all_secs or public.ind_assigned(c.id, case when p_task = 'view' then 'absence' else p_task end))
    order by s.full_name limit least(greatest(p_limit, 1), 50)) t), '[]'::jsonb);
end $f$;

-- طلاب فصل لشاشة التأخر (الطريقة الأولى: اختيار الفصل)، لمن أُسند إليه تسجيل التأخر في هذا الفصل
create or replace function public.ind_section_lateness_roster(p_section uuid) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not (public.ind_can_oversee() or public.ind_assigned(p_section, 'lateness')) then
    return public.ind_deny('lateness_roster', jsonb_build_object('section', p_section));
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', st.student_id, 'no', st.student_no, 'name', st.full_name,
      'late_today', exists (select 1 from public.ind_lateness_records l where l.student_id = st.student_id and l.day = public.ind_today() and l.voided_at is null)) order by st.full_name)
    from public.ind_section_students(p_section, public.ind_today()) st), '[]'::jsonb);
end $f$;

create or replace function public.ind_record_lateness(p_student uuid, p_day date, p_arrival time, p_reason uuid, p_reason_text text default null, p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.ind_me(); e record; r record; rid uuid; mins int; txt text := nullif(trim(coalesce(p_reason_text, '')), '');
begin
  if me is null then return public.ind_deny('record_lateness'); end if;
  -- منع التكرار عند إعادة إرسال الطلب نفسه
  if p_request_id is not null then
    select id into rid from public.ind_lateness_records where request_id = p_request_id;
    if found then return jsonb_build_object('ok', true, 'id', rid, 'duplicate_request', true); end if;
  end if;
  select en.*, c.year_id as cyear into e from public.student_enrollments en join public.class_sections c on c.id = en.section_id
    where en.student_id = p_student and en.year_id = public.ind_current_year() and en.status = 'enrolled';
  if not found then raise exception 'student_not_enrolled'; end if;
  if not (public.ind_is_coord() or public.ind_assigned(e.section_id, 'lateness')) then
    return public.ind_deny('record_lateness', jsonb_build_object('student', p_student, 'section', e.section_id));
  end if;
  perform public.ind_check_day(e.section_id, p_day);
  if p_arrival is null then raise exception 'arrival_required'; end if;
  select * into r from public.ind_lateness_reasons where id = p_reason and is_active;
  if not found then raise exception 'reason_required'; end if;
  if r.is_other and txt is null then raise exception 'other_reason_required'; end if;
  if txt is not null and length(txt) > 300 then raise exception 'text_too_long'; end if;
  mins := public.ind_late_minutes(p_arrival);
  if mins = 0 then raise exception 'not_late'; end if;
  if exists (select 1 from public.ind_lateness_records where student_id = p_student and day = p_day and voided_at is null) then raise exception 'lateness_exists'; end if;
  insert into public.ind_lateness_records (student_id, section_id, grade_code, year_id, day, arrival_time, minutes, reason_id, reason_text, recorded_by, request_id)
  values (p_student, e.section_id, e.grade_code, e.cyear, p_day, p_arrival, mins, p_reason, txt, me, p_request_id)
  returning id into rid;
  perform public.ind_audit('lateness_recorded', 'lateness', rid::text, null,
    jsonb_build_object('student_id', p_student, 'day', p_day, 'arrival', p_arrival, 'minutes', mins, 'reason', r.name, 'text', txt));
  return jsonb_build_object('ok', true, 'id', rid, 'minutes', mins);
end $f$;

create or replace function public.ind_lateness_list(p_day date, p_section uuid default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare all_secs boolean := public.ind_can_oversee();
begin
  if public.ind_me() is null then return public.ind_deny('lateness_list'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'student_id', l.student_id, 'no', s.student_no, 'name', s.full_name,
      'grade_name', g.name_ar, 'section', c.name, 'arrival', to_char(l.arrival_time, 'HH24:MI'), 'minutes', l.minutes,
      'reason', r.name, 'reason_text', l.reason_text, 'by', m.full_name, 'created_at', l.created_at,
      'voided', l.voided_at is not null, 'void_reason', l.void_reason) order by l.arrival_time)
    from public.ind_lateness_records l join public.students s on s.id = l.student_id
    join public.class_sections c on c.id = l.section_id join public.grade_levels g on g.code = l.grade_code
    join public.ind_lateness_reasons r on r.id = l.reason_id left join public.staff_members m on m.id = l.recorded_by
    where l.day = p_day and (p_section is null or l.section_id = p_section)
      and (all_secs or public.ind_assigned(l.section_id, 'lateness'))), '[]'::jsonb);
end $f$;

create or replace function public.ind_void_lateness(p_id uuid, p_reason text) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare o record;
begin
  if not public.ind_is_coord() then return public.ind_deny('void_lateness', jsonb_build_object('id', p_id)); end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;
  update public.ind_lateness_records set voided_at = now(), voided_by = public.ind_me(), void_reason = trim(p_reason)
    where id = p_id and voided_at is null returning * into o;
  if not found then raise exception 'not_found'; end if;
  perform public.ind_audit('lateness_voided', 'lateness', p_id::text, to_jsonb(o) - 'void_reason', null, trim(p_reason));
  return jsonb_build_object('ok', true);
end $f$;

-- إعدادات التأخر (المنسق) مع حفظ سجل التغييرات
create or replace function public.ind_set_lateness_settings(p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare o jsonb := public.ind_setting('lateness'); n jsonb;
begin
  if not public.ind_is_coord() then return public.ind_deny('lateness_settings'); end if;
  n := jsonb_build_object(
    'day_start', to_char((p->>'day_start')::time, 'HH24:MI'),
    'late_after', to_char((p->>'late_after')::time, 'HH24:MI'),
    'grace_minutes', greatest(0, least(coalesce((p->>'grace_minutes')::int, 0), 120)),
    'calc_mode', case when p->>'calc_mode' = 'from_start' then 'from_start' else 'from_threshold' end,
    'notify_enabled', coalesce((p->>'notify_enabled')::boolean, false));
  if (n->>'late_after')::time < (n->>'day_start')::time then raise exception 'late_before_start'; end if;
  update public.ind_settings set value = n, updated_by = public.ind_me(), updated_at = now() where key = 'lateness';
  perform public.ind_audit('lateness_settings_changed', 'settings', 'lateness', o, n);
  return n;
end $f$;

create or replace function public.ind_set_attendance_settings(p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare o jsonb := public.ind_setting('attendance'); n jsonb;
begin
  if not public.ind_is_coord() then return public.ind_deny('attendance_settings'); end if;
  n := jsonb_build_object('max_backdate_days', greatest(0, least(coalesce((p->>'max_backdate_days')::int, 30), 365)),
    'weekend', coalesce((select jsonb_agg(distinct v::int) from jsonb_array_elements_text(coalesce(p->'weekend', '[5,6]')) v where v::int between 0 and 6), '[]'::jsonb));
  update public.ind_settings set value = n, updated_by = public.ind_me(), updated_at = now() where key = 'attendance';
  perform public.ind_audit('attendance_settings_changed', 'settings', 'attendance', o, n);
  return n;
end $f$;

-- أسباب التأخر: إضافة/تعديل/تعطيل/تفعيل
create or replace function public.ind_reason_save(p_id uuid, p_name text, p_active boolean default true, p_sort int default 100) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare o record; rid uuid; nm text := nullif(trim(coalesce(p_name, '')), '');
begin
  if not public.ind_is_coord() then return public.ind_deny('reason_save'); end if;
  if nm is null then raise exception 'name_required'; end if;
  if p_id is null then
    insert into public.ind_lateness_reasons (name, is_active, sort_order) values (nm, coalesce(p_active, true), coalesce(p_sort, 100)) returning id into rid;
    perform public.ind_audit('reason_added', 'lateness_reason', rid::text, null, jsonb_build_object('name', nm));
  else
    select * into o from public.ind_lateness_reasons where id = p_id; if not found then raise exception 'not_found'; end if;
    update public.ind_lateness_reasons set name = nm, is_active = coalesce(p_active, true), sort_order = coalesce(p_sort, sort_order) where id = p_id;
    rid := p_id;
    perform public.ind_audit('reason_changed', 'lateness_reason', rid::text, to_jsonb(o), jsonb_build_object('name', nm, 'is_active', p_active, 'sort_order', p_sort));
  end if;
  return jsonb_build_object('ok', true, 'id', rid);
exception when unique_violation then raise exception 'name_taken';
end $f$;

create or replace function public.ind_reasons_all() returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_is_coord() then return public.ind_deny('reasons_all'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'is_other', is_other, 'is_active', is_active, 'sort_order', sort_order,
    'uses', (select count(*) from public.ind_lateness_records l where l.reason_id = r.id)) order by sort_order, name) from public.ind_lateness_reasons r), '[]'::jsonb);
end $f$;

-- =====================================================================
-- التكليفات
-- =====================================================================
create or replace function public.ind_staff_list() returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not (public.ind_is_coord() or public.ind_has('portal_admin')) then return public.ind_deny('staff_list'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.full_name, 'job_title', s.job_title,
      'has_account', s.user_id is not null and s.account_status = 'active',
      'roles', coalesce((select jsonb_agg(r.role) from public.ind_staff_roles r where r.staff_id = s.id), '[]'::jsonb)) order by s.full_name)
    from public.staff_members s where s.is_active), '[]'::jsonb);
end $f$;

create or replace function public.ind_assignments_list() returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_is_coord() then return public.ind_deny('assignments_list'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'staff_id', a.staff_id, 'staff', s.full_name,
      'has_account', s.user_id is not null and s.account_status = 'active',
      'task', a.task, 'starts_on', a.starts_on, 'status', a.status, 'note', a.note, 'updated_at', a.updated_at,
      'sections', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'label', g.name_ar || ' – ' || c.name) order by g.sort_order, c.name)
         from public.ind_assignment_sections x join public.class_sections c on c.id = x.section_id join public.grade_levels g on g.code = c.grade_code
         where x.assignment_id = a.id), '[]'::jsonb)) order by a.status, a.task, s.full_name)
    from public.ind_assignments a join public.staff_members s on s.id = a.staff_id), '[]'::jsonb);
end $f$;

-- إنشاء أو تعديل تكليف. يعيد التعارضات (فصل مسند للمهمة نفسها لمنسوب آخر) ولا يحفظ إلا بتأكيد p_allow_shared.
create or replace function public.ind_assignment_save(p_id uuid, p_staff uuid, p_task text, p_sections uuid[], p_starts date default null, p_note text default null, p_allow_shared boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.ind_me(); aid uuid; o jsonb; conflicts jsonb;
begin
  if not public.ind_is_coord() then return public.ind_deny('assignment_save'); end if;
  if p_task not in ('absence','lateness') then raise exception 'bad_request'; end if;
  if coalesce(cardinality(p_sections), 0) = 0 then raise exception 'sections_required'; end if;
  if not exists (select 1 from public.staff_members where id = p_staff and is_active) then raise exception 'staff_not_found'; end if;
  if exists (select 1 from unnest(p_sections) u where not exists (select 1 from public.class_sections c where c.id = u and c.year_id = public.ind_current_year())) then raise exception 'section_not_found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('section', g.name_ar || ' – ' || c.name, 'staff', s.full_name)), '[]'::jsonb) into conflicts
    from public.ind_assignments a join public.ind_assignment_sections x on x.assignment_id = a.id
    join public.staff_members s on s.id = a.staff_id join public.class_sections c on c.id = x.section_id join public.grade_levels g on g.code = c.grade_code
    where a.status = 'active' and a.task = p_task and a.staff_id <> p_staff and x.section_id = any (p_sections) and (p_id is null or a.id <> p_id);
  if jsonb_array_length(conflicts) > 0 and not p_allow_shared then return jsonb_build_object('ok', false, 'conflicts', conflicts); end if;

  if p_id is null then
    -- تكليف فعّال قائم للمنسوب والمهمة نفسيهما: نحدّثه بدل إنشاء مكرر
    select id into aid from public.ind_assignments where staff_id = p_staff and task = p_task and status = 'active';
  else
    aid := p_id;
    if not exists (select 1 from public.ind_assignments where id = aid and staff_id = p_staff and task = p_task) then raise exception 'not_found'; end if;
  end if;
  if aid is null then
    insert into public.ind_assignments (staff_id, task, starts_on, note, created_by) values (p_staff, p_task, coalesce(p_starts, public.ind_today()), nullif(trim(coalesce(p_note, '')), ''), me) returning id into aid;
  else
    select jsonb_build_object('starts_on', a.starts_on, 'status', a.status, 'sections', (select jsonb_agg(section_id) from public.ind_assignment_sections where assignment_id = a.id)) into o
      from public.ind_assignments a where a.id = aid;
    update public.ind_assignments set starts_on = coalesce(p_starts, starts_on), note = nullif(trim(coalesce(p_note, '')), ''), status = 'active', updated_at = now() where id = aid;
    delete from public.ind_assignment_sections where assignment_id = aid and section_id <> all (p_sections);
  end if;
  insert into public.ind_assignment_sections (assignment_id, section_id) select aid, u from unnest(p_sections) u on conflict do nothing;
  perform public.ind_audit(case when o is null then 'assignment_created' else 'assignment_changed' end, 'assignment', aid::text, o,
    jsonb_build_object('staff_id', p_staff, 'task', p_task, 'sections', to_jsonb(p_sections), 'starts_on', coalesce(p_starts, public.ind_today()), 'shared', jsonb_array_length(conflicts) > 0));
  return jsonb_build_object('ok', true, 'id', aid);
end $f$;

create or replace function public.ind_assignment_status(p_id uuid, p_status text) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare a record;
begin
  if not public.ind_is_coord() then return public.ind_deny('assignment_status'); end if;
  if p_status not in ('active','stopped') then raise exception 'bad_request'; end if;
  select * into a from public.ind_assignments where id = p_id; if not found then raise exception 'not_found'; end if;
  if p_status = 'active' and exists (select 1 from public.ind_assignments where staff_id = a.staff_id and task = a.task and status = 'active' and id <> p_id) then raise exception 'assignment_exists'; end if;
  update public.ind_assignments set status = p_status, updated_at = now() where id = p_id;
  perform public.ind_audit(case when p_status = 'stopped' then 'assignment_stopped' else 'assignment_resumed' end, 'assignment', p_id::text,
    jsonb_build_object('status', a.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('ok', true);
end $f$;

-- مهام المستخدم الحالي (للوحة مدخل البيانات)
create or replace function public.ind_my_tasks(p_day date default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare d date := coalesce(p_day, public.ind_today());
begin
  if public.ind_me() is null then return public.ind_deny('my_tasks'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('task', a.task, 'starts_on', a.starts_on,
      'sections', (select jsonb_agg(jsonb_build_object('id', c.id, 'label', g.name_ar || ' – ' || c.name,
          'saved', exists (select 1 from public.ind_attendance_sessions x where x.section_id = c.id and x.day = d),
          'locked', exists (select 1 from public.ind_attendance_locks l where l.section_id = c.id and l.day = d and l.is_locked),
          'late_today', (select count(*) from public.ind_lateness_records l where l.section_id = c.id and l.day = d and l.voided_at is null)) order by g.sort_order, c.name)
        from public.ind_assignment_sections s join public.class_sections c on c.id = s.section_id join public.grade_levels g on g.code = c.grade_code where s.assignment_id = a.id)))
    from public.ind_assignments a where a.staff_id = public.ind_me() and a.status = 'active' and a.starts_on <= public.ind_today()), '[]'::jsonb);
end $f$;

-- =====================================================================
-- الأدوار (مدير البوابة أو مدير النواة)
-- =====================================================================
create or replace function public.ind_set_role(p_staff uuid, p_role text, p_on boolean) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not (public.ind_is_admin() or public.ind_has('portal_admin')) then return public.ind_deny('set_role', jsonb_build_object('staff', p_staff, 'role', p_role)); end if;
  if p_role not in ('coordinator','affairs','portal_admin') then raise exception 'bad_request'; end if;
  -- منح دور «مدير البوابة» لمدير النواة وحده
  if p_role = 'portal_admin' and not public.ind_is_admin() then return public.ind_deny('set_role_portal_admin'); end if;
  if p_on then
    insert into public.ind_staff_roles (staff_id, role, created_by) values (p_staff, p_role, public.ind_me()) on conflict do nothing;
    if found then perform public.ind_audit('role_granted', 'role', p_staff::text, null, jsonb_build_object('role', p_role)); end if;
  else
    delete from public.ind_staff_roles where staff_id = p_staff and role = p_role;
    if found then perform public.ind_audit('role_revoked', 'role', p_staff::text, jsonb_build_object('role', p_role), null); end if;
  end if;
  return jsonb_build_object('ok', true);
end $f$;

-- =====================================================================
-- لوحة التحكم وسجل العمليات
-- =====================================================================
create or replace function public.ind_dashboard(p_day date default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare d date := coalesce(p_day, public.ind_today()); total int; exc int; unexc int; late int; secs jsonb;
begin
  if not public.ind_can_oversee() then return public.ind_deny('dashboard'); end if;
  select count(*) into total from public.student_enrollments e join public.class_sections c on c.id = e.section_id
    where e.year_id = public.ind_current_year() and e.status = 'enrolled' and c.is_active;
  select count(*) filter (where status = 'absent_excused'), count(*) filter (where status = 'absent_unexcused') into exc, unexc
    from public.ind_attendance_records where day = d;
  select count(*) into late from public.ind_lateness_records where day = d and voided_at is null;
  secs := public.ind_day_status(d, null);
  return jsonb_build_object('day', d, 'total', total, 'excused', exc, 'unexcused', unexc, 'present', total - exc - unexc,
    'late', late, 'rate', case when total > 0 then round(100.0 * (total - exc - unexc) / total, 1) end,
    'sections', secs,
    'not_saved', (select count(*) from jsonb_array_elements(secs) x where not (x->>'saved')::boolean),
    'locked', (select count(*) from jsonb_array_elements(secs) x where (x->>'locked')::boolean),
    'unlocked', (select count(*) from jsonb_array_elements(secs) x where not (x->>'locked')::boolean),
    'top_reasons', coalesce((select jsonb_agg(jsonb_build_object('name', n, 'count', k)) from (
       select r.name n, count(*) k from public.ind_lateness_records l join public.ind_lateness_reasons r on r.id = l.reason_id
       where l.day between d - 6 and d and l.voided_at is null group by r.name order by k desc limit 5) t), '[]'::jsonb),
    'week', coalesce((select jsonb_agg(jsonb_build_object('day', g::date,
        'absent', (select count(*) from public.ind_attendance_records r where r.day = g::date),
        'late', (select count(*) from public.ind_lateness_records l where l.day = g::date and l.voided_at is null)) order by g)
      from generate_series(d - 6, d, interval '1 day') g), '[]'::jsonb));
end $f$;

create or replace function public.ind_audit_list(p_limit int default 100, p_entity text default null, p_before bigint default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not (public.ind_is_coord() or public.ind_has('portal_admin')) then return public.ind_deny('audit_list'); end if;
  return coalesce((select jsonb_agg(x) from (select jsonb_build_object('id', a.id, 'at', a.created_at, 'actor', coalesce(s.full_name, '—'), 'action', a.action,
      'entity', a.entity, 'entity_id', a.entity_id, 'old', a.old_data, 'new', a.new_data, 'reason', a.reason) x
    from public.ind_audit_logs a left join public.staff_members s on s.id = a.actor_id
    where (p_entity is null or a.entity = p_entity) and (p_before is null or a.id < p_before)
    order by a.id desc limit least(greatest(p_limit, 1), 500)) t), '[]'::jsonb);
end $f$;

-- =====================================================================
-- RLS والمنح: لا وصول مباشر للجداول؛ كل شيء عبر الدوال
-- =====================================================================
do $$ declare t text; begin
  foreach t in array array['ind_staff_roles','ind_settings','ind_lateness_reasons','ind_assignments','ind_assignment_sections',
    'ind_attendance_sessions','ind_attendance_records','ind_attendance_locks','ind_lateness_records','ind_audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop; end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'ind\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop; end $$;
-- دوال داخلية لا تُستدعى من الواجهة
revoke execute on function public.ind_audit(text, text, text, jsonb, jsonb, text) from authenticated;
revoke execute on function public.ind_audit_immutable() from authenticated;
