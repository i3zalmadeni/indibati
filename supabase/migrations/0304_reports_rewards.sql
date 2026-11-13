-- =====================================================================
-- انضباطي · 0304 · نقاط الانتظام (تكامل مع «قيمي» – رعاية المتعلمين) والتقارير
-- النقاط تُدار في دفتر قيمي (qm_points_ledger) ولا يُنشأ دفتر نقاط مستقل هنا؛
-- ind_reward_transactions سجل مرجعي لعمليات التكامل يمنع التكرار ويتيح المراجعة.
-- =====================================================================

insert into public.ind_settings (key, value) values
  ('rewards', '{"enabled": false, "points": 5, "lateness_blocks": false}')
on conflict (key) do nothing;

create table if not exists public.ind_reward_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  year_id uuid not null references public.academic_years(id),
  week_start date not null,
  points int not null,
  status text not null default 'awarded' check (status in ('awarded','reversed','pending')),
  ledger_id uuid,
  reversal_ledger_id uuid,
  awarded_by uuid references public.staff_members(id),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reverse_reason text,
  unique (student_id, week_start)
);
create index if not exists ind_reward_week_idx on public.ind_reward_transactions (week_start);
alter table public.ind_reward_transactions enable row level security;
revoke all on public.ind_reward_transactions from anon, authenticated;

-- بداية الأسبوع الدراسي (الأحد)
create or replace function public.ind_week_start(p_day date) returns date language sql immutable set search_path = '' as $f$
  select p_day - extract(dow from p_day)::int $f$;

-- أيام الدراسة الفعلية في الأسبوع: الأيام التي حُضّر فيها فصل واحد على الأقل (ما سواها إجازة)
create or replace function public.ind_week_days(p_ws date) returns date[] language sql stable security definer set search_path = '' as $f$
  select coalesce(array_agg(distinct s.day order by s.day), '{}') from public.ind_attendance_sessions s
  where s.day between p_ws and p_ws + 6 and s.year_id = public.ind_current_year() $f$;

-- الأسبوع نهائي: انقضى، وكل يوم دراسي فيه مثبت لجميع الفصول الفعّالة
create or replace function public.ind_week_final(p_ws date) returns boolean language sql stable security definer set search_path = '' as $f$
  select public.ind_today() > p_ws + 4
    and cardinality(public.ind_week_days(p_ws)) > 0
    and not exists (
      select 1 from unnest(public.ind_week_days(p_ws)) d cross join public.class_sections c
      where c.year_id = public.ind_current_year() and c.is_active
        and not exists (select 1 from public.ind_attendance_locks l where l.section_id = c.id and l.day = d and l.is_locked)) $f$;

-- إدراج قيد في دفتر قيمي إن كان النظام مثبتاً في القاعدة
create or replace function public.ind_qm_ledger(p_student uuid, p_points int, p_kind text, p_reason text, p_source uuid, p_reverses uuid, p_by uuid) returns uuid
language plpgsql security definer set search_path = '' as $f$
declare lid uuid;
begin
  if to_regclass('public.qm_points_ledger') is null or p_by is null then return null; end if;
  execute 'insert into public.qm_points_ledger (student_id, points, kind, reason, source_type, source_id, reverses_id, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning id'
    into lid using p_student, p_points, p_kind, p_reason, case when p_reverses is null then 'indibati_week' else null end, case when p_reverses is null then p_source else null end, p_reverses, p_by;
  return lid;
end $f$;

-- معالجة استحقاق أسبوع: 5 نقاط (قابلة للضبط) لكل طالب أكمل الأسبوع دون غياب
create or replace function public.ind_rewards_process(p_ws date, p_by uuid) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare R jsonb := public.ind_setting('rewards'); pts int := coalesce((R->>'points')::int, 5); days date[]; st record; tx uuid; lid uuid; n int := 0; yr uuid := public.ind_current_year();
begin
  if not coalesce((R->>'enabled')::boolean, false) then return jsonb_build_object('skipped', 'disabled'); end if;
  if not public.ind_week_final(p_ws) then return jsonb_build_object('skipped', 'week_not_final'); end if;
  days := public.ind_week_days(p_ws);
  for st in
    select e.student_id from public.student_enrollments e join public.class_sections c on c.id = e.section_id
    where e.year_id = yr and e.status = 'enrolled' and c.is_active
      and not exists (select 1 from public.ind_attendance_records r where r.student_id = e.student_id and r.day = any (days))
      and not (coalesce((R->>'lateness_blocks')::boolean, false) and exists (select 1 from public.ind_lateness_records l where l.student_id = e.student_id and l.day = any (days) and l.voided_at is null))
      and not exists (select 1 from public.ind_reward_transactions t where t.student_id = e.student_id and t.week_start = p_ws)
  loop
    insert into public.ind_reward_transactions (student_id, year_id, week_start, points, status, awarded_by) values (st.student_id, yr, p_ws, pts, 'pending', p_by)
    on conflict (student_id, week_start) do nothing returning id into tx;
    if tx is null then continue; end if;
    lid := public.ind_qm_ledger(st.student_id, pts, 'reinforcement', 'انتظام أسبوع كامل دون غياب (انضباطي) – أسبوع ' || p_ws, tx, null, p_by);
    update public.ind_reward_transactions set ledger_id = lid, status = case when lid is null then 'pending' else 'awarded' end where id = tx;
    n := n + 1;
  end loop;
  if n > 0 then perform public.ind_audit('rewards_awarded', 'reward', p_ws::text, null, jsonb_build_object('students', n, 'points', pts)); end if;
  return jsonb_build_object('awarded', n, 'week_start', p_ws, 'days', cardinality(days));
end $f$;

-- التلقائي: عند تثبيت يوم يكتمل به الأسبوع (يستخدم هوية من ثبّت، لأن دفتر قيمي يتطلب مانحاً)
create or replace function public.ind_trg_lock_rewards() returns trigger language plpgsql security definer set search_path = '' as $f$
begin
  if new.is_locked and coalesce((public.ind_setting('rewards')->>'enabled')::boolean, false) then
    perform public.ind_rewards_process(public.ind_week_start(new.day), coalesce(public.ind_me(), new.locked_by));
  end if;
  return null;
end $f$;
drop trigger if exists ind_lock_rewards on public.ind_attendance_locks;
create trigger ind_lock_rewards after insert or update of is_locked on public.ind_attendance_locks for each row execute function public.ind_trg_lock_rewards();

-- عكس الاستحقاق إذا سُجّل غياب لاحقاً في أسبوع مُكافأ (قيد عكسي موثّق، لا حذف)
create or replace function public.ind_reward_reverse(p_student uuid, p_day date, p_reason text) returns void language plpgsql security definer set search_path = '' as $f$
declare t record; lid uuid;
begin
  select * into t from public.ind_reward_transactions where student_id = p_student and week_start = public.ind_week_start(p_day) and status in ('awarded','pending');
  if not found then return; end if;
  if t.ledger_id is not null then
    lid := public.ind_qm_ledger(p_student, -t.points, 'reversal', 'إلغاء نقاط الانتظام: ' || p_reason, null, t.ledger_id, coalesce(public.ind_me(), t.awarded_by));
  end if;
  update public.ind_reward_transactions set status = 'reversed', reversal_ledger_id = lid, reversed_at = now(), reverse_reason = p_reason where id = t.id;
  perform public.ind_audit('reward_reversed', 'reward', t.id::text, jsonb_build_object('points', t.points), null, p_reason);
end $f$;
create or replace function public.ind_trg_reward_absence() returns trigger language plpgsql security definer set search_path = '' as $f$
begin perform public.ind_reward_reverse(new.student_id, new.day, 'تسجيل غياب لاحق'); return null; end $f$;
drop trigger if exists ind_att_reward on public.ind_attendance_records;
create trigger ind_att_reward after insert on public.ind_attendance_records for each row execute function public.ind_trg_reward_absence();
create or replace function public.ind_trg_reward_lateness() returns trigger language plpgsql security definer set search_path = '' as $f$
begin
  if coalesce((public.ind_setting('rewards')->>'lateness_blocks')::boolean, false) then perform public.ind_reward_reverse(new.student_id, new.day, 'تسجيل تأخر لاحق'); end if;
  return null;
end $f$;
drop trigger if exists ind_late_reward on public.ind_lateness_records;
create trigger ind_late_reward after insert on public.ind_lateness_records for each row execute function public.ind_trg_reward_lateness();

-- واجهة المنسق: الإعدادات والتشغيل اليدوي لأسبوع والمراجعة
create or replace function public.ind_set_reward_settings(p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare o jsonb := public.ind_setting('rewards'); n jsonb;
begin
  if not public.ind_is_coord() then return public.ind_deny('reward_settings'); end if;
  n := jsonb_build_object('enabled', coalesce((p->>'enabled')::boolean, false), 'points', greatest(1, least(coalesce((p->>'points')::int, 5), 50)),
    'lateness_blocks', coalesce((p->>'lateness_blocks')::boolean, false));
  update public.ind_settings set value = n, updated_by = public.ind_me(), updated_at = now() where key = 'rewards';
  perform public.ind_audit('reward_settings_changed', 'settings', 'rewards', o, n);
  return n;
end $f$;

create or replace function public.ind_rewards_run(p_day date) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_is_coord() then return public.ind_deny('rewards_run'); end if;
  return public.ind_rewards_process(public.ind_week_start(p_day), public.ind_me());
end $f$;

create or replace function public.ind_rewards_overview(p_limit int default 30) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_can_oversee() then return public.ind_deny('rewards_overview'); end if;
  return jsonb_build_object('settings', public.ind_setting('rewards'), 'qiyami', to_regclass('public.qm_points_ledger') is not null,
    'weeks', coalesce((select jsonb_agg(x order by (x->>'week_start')::date desc) from (
      select jsonb_build_object('week_start', w.ws, 'days', cardinality(public.ind_week_days(w.ws)), 'final', public.ind_week_final(w.ws),
        'awarded', (select count(*) from public.ind_reward_transactions t where t.week_start = w.ws and t.status = 'awarded'),
        'pending', (select count(*) from public.ind_reward_transactions t where t.week_start = w.ws and t.status = 'pending'),
        'reversed', (select count(*) from public.ind_reward_transactions t where t.week_start = w.ws and t.status = 'reversed')) x
      from (select distinct public.ind_week_start(day) ws from public.ind_attendance_sessions where year_id = public.ind_current_year() order by 1 desc limit least(greatest(p_limit, 1), 60)) w) t), '[]'::jsonb));
end $f$;

-- =====================================================================
-- التقارير: دالة واحدة تُرجع الأعمدة والصفوف لكل نوع، مع التصفية بالتاريخ والصف والفصل والطالب
-- =====================================================================
create or replace function public.ind_report(p_kind text, p_from date, p_to date, p_grade text default null, p_section uuid default null, p_q text default null, p_min int default 3)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare yr uuid := public.ind_current_year(); q text := nullif(trim(coalesce(p_q, '')), ''); cols jsonb; rows jsonb;
begin
  if not public.ind_can_oversee() then return public.ind_deny('report', jsonb_build_object('kind', p_kind)); end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'bad_request'; end if;
  if p_to - p_from > 400 then raise exception 'range_too_long'; end if;

  -- الطلاب ضمن نطاق التصفية (العام الحالي)
  create temp table if not exists ind_rep_scope (student_id uuid primary key, name text, no text, grade text, section text, section_id uuid, sort int) on commit drop;
  truncate ind_rep_scope;
  insert into ind_rep_scope select s.id, s.full_name, s.student_no, g.name_ar, c.name, c.id, g.sort_order
    from public.student_enrollments e join public.students s on s.id = e.student_id join public.class_sections c on c.id = e.section_id join public.grade_levels g on g.code = e.grade_code
    where e.year_id = yr and (p_grade is null or e.grade_code = p_grade) and (p_section is null or e.section_id = p_section)
      and (q is null or s.full_name ilike '%' || q || '%' or s.student_no = q);

  if p_kind = 'attendance_daily' then
    cols := '["التاريخ","الصف","الفصل","الطلاب","حاضر","غائب بعذر","غائب بدون عذر","نسبة الحضور","التثبيت"]';
    select jsonb_agg(jsonb_build_array(x.day, x.grade, x.section, x.total, x.total - x.e - x.u, x.e, x.u, case when x.total > 0 then round(100.0 * (x.total - x.e - x.u) / x.total, 1) end, case when x.locked then 'مثبت' else 'غير مثبت' end) order by x.day, x.sort, x.section) into rows
    from (select ss.day, g.name_ar grade, g.sort_order sort, c.name section,
            (select count(*) from ind_rep_scope sc where sc.section_id = c.id) total,
            (select count(*) from public.ind_attendance_records r join ind_rep_scope sc on sc.student_id = r.student_id where r.section_id = c.id and r.day = ss.day and r.status = 'absent_excused') e,
            (select count(*) from public.ind_attendance_records r join ind_rep_scope sc on sc.student_id = r.student_id where r.section_id = c.id and r.day = ss.day and r.status = 'absent_unexcused') u,
            coalesce((select l.is_locked from public.ind_attendance_locks l where l.section_id = c.id and l.day = ss.day), false) locked
          from public.ind_attendance_sessions ss join public.class_sections c on c.id = ss.section_id join public.grade_levels g on g.code = c.grade_code
          where ss.day between p_from and p_to and ss.year_id = yr and exists (select 1 from ind_rep_scope sc where sc.section_id = c.id)) x;

  elsif p_kind in ('absence_list', 'absence_excused', 'absence_unexcused') then
    cols := '["التاريخ","الطالب","رقم الطالب","الصف","الفصل","الحالة","العذر"]';
    select jsonb_agg(jsonb_build_array(r.day, sc.name, sc.no, sc.grade, sc.section, case r.status when 'absent_excused' then 'غائب بعذر' else 'غائب بدون عذر' end,
        coalesce((select case x.status when 'approved' then 'معتمد' when 'rejected' then 'غير معتمد' when 'under_review' then 'قيد المراجعة' else 'مقدم' end from public.ind_excuses x where x.student_id = r.student_id and x.day = r.day order by x.submitted_at desc limit 1), 'لم يُقدَّم'))
      order by r.day, sc.sort, sc.section, sc.name) into rows
    from public.ind_attendance_records r join ind_rep_scope sc on sc.student_id = r.student_id
    where r.day between p_from and p_to and (p_kind = 'absence_list' or r.status = case p_kind when 'absence_excused' then 'absent_excused' else 'absent_unexcused' end);

  elsif p_kind in ('absence_summary', 'absence_repeat') then
    cols := '["الطالب","رقم الطالب","الصف","الفصل","أيام الغياب","بعذر","بدون عذر"]';
    select jsonb_agg(jsonb_build_array(name, no, grade, section, n, e, n - e) order by n desc, name) into rows from (
      select sc.name, sc.no, sc.grade, sc.section, count(*) n, count(*) filter (where r.status = 'absent_excused') e
      from public.ind_attendance_records r join ind_rep_scope sc on sc.student_id = r.student_id where r.day between p_from and p_to
      group by sc.student_id, sc.name, sc.no, sc.grade, sc.section having p_kind = 'absence_summary' or count(*) >= p_min) t;

  elsif p_kind = 'lateness_list' then
    cols := '["التاريخ","الطالب","رقم الطالب","الصف","الفصل","وقت الوصول","دقائق التأخر","السبب","المدخل"]';
    select jsonb_agg(jsonb_build_array(l.day, sc.name, sc.no, sc.grade, sc.section, to_char(l.arrival_time, 'HH24:MI'), l.minutes, coalesce(nullif(l.reason_text, ''), rr.name), m.full_name) order by l.day, l.arrival_time) into rows
    from public.ind_lateness_records l join ind_rep_scope sc on sc.student_id = l.student_id join public.ind_lateness_reasons rr on rr.id = l.reason_id
    left join public.staff_members m on m.id = l.recorded_by where l.day between p_from and p_to and l.voided_at is null;

  elsif p_kind in ('lateness_summary', 'lateness_repeat') then
    cols := '["الطالب","رقم الطالب","الصف","الفصل","مرات التأخر","مجموع الدقائق","متوسط الدقائق"]';
    select jsonb_agg(jsonb_build_array(name, no, grade, section, n, mins, round(mins::numeric / n, 1)) order by n desc, name) into rows from (
      select sc.name, sc.no, sc.grade, sc.section, count(*) n, sum(l.minutes) mins
      from public.ind_lateness_records l join ind_rep_scope sc on sc.student_id = l.student_id where l.day between p_from and p_to and l.voided_at is null
      group by sc.student_id, sc.name, sc.no, sc.grade, sc.section having p_kind = 'lateness_summary' or count(*) >= p_min) t;

  elsif p_kind = 'lateness_reasons' then
    cols := '["السبب","عدد الحالات","مجموع الدقائق"]';
    select jsonb_agg(jsonb_build_array(rname, n, mins) order by n desc) into rows from (
      select rr.name rname, count(*) n, sum(l.minutes) mins from public.ind_lateness_records l join ind_rep_scope sc on sc.student_id = l.student_id
      join public.ind_lateness_reasons rr on rr.id = l.reason_id where l.day between p_from and p_to and l.voided_at is null group by rr.name) t;

  elsif p_kind = 'notifications' then
    cols := '["تاريخ الإنشاء","الطالب","الصف","الفصل","النوع","الحالة","وقت الإرسال","السبب"]';
    select jsonb_agg(jsonb_build_array(to_char(n.created_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI'), sc.name, sc.grade, sc.section,
        case n.kind when 'absence' then 'غياب' when 'lateness' then 'تأخر' when 'lateness_repeat' then 'تكرار تأخر' when 'escalation' then 'إجراء نظامي' when 'excuse_received' then 'استلام عذر' else 'نتيجة عذر' end,
        case n.status when 'queued' then 'بانتظار الإرسال' when 'sending' then 'قيد الإرسال' when 'no_phone' then 'لا يوجد رقم' when 'sent' then 'قبلها واتساب' when 'delivered' then 'وصلت' when 'read' then 'قُرئت' when 'failed' then 'فشل' else 'ملغاة' end,
        to_char(n.sent_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI'), n.error) order by n.created_at) into rows
    from public.ind_notifications n join ind_rep_scope sc on sc.student_id = n.student_id where (n.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to;

  elsif p_kind = 'excuses' then
    cols := '["يوم الغياب","الطالب","الصف","الفصل","السبب","الحالة","تاريخ التقديم","المراجع","ملاحظة"]';
    select jsonb_agg(jsonb_build_array(x.day, sc.name, sc.grade, sc.section, x.reason,
        case x.status when 'approved' then 'معتمد' when 'rejected' then 'غير معتمد' when 'under_review' then 'قيد المراجعة' else 'مقدم' end,
        to_char(x.submitted_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD'), m.full_name, x.review_note) order by x.day) into rows
    from public.ind_excuses x join ind_rep_scope sc on sc.student_id = x.student_id left join public.staff_members m on m.id = x.reviewed_by where x.day between p_from and p_to;

  elsif p_kind = 'escalations' then
    cols := '["تاريخ الإصدار","الطالب","الصف","الفصل","الإجراء","أيام الغياب","الحالة","طُبع"]';
    select jsonb_agg(jsonb_build_array(to_char(er.created_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD'), sc.name, sc.grade, sc.section, ru.label, er.days_count,
        case er.status when 'active' then 'صادر' else 'مسحوب' end, case when er.printed_at is null then 'لا' else 'نعم' end) order by er.created_at) into rows
    from public.ind_escalation_records er join ind_rep_scope sc on sc.student_id = er.student_id join public.ind_escalation_rules ru on ru.id = er.rule_id
    where (er.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to;

  elsif p_kind = 'rewards' then
    cols := '["بداية الأسبوع","الطالب","الصف","الفصل","النقاط","الحالة"]';
    select jsonb_agg(jsonb_build_array(t.week_start, sc.name, sc.grade, sc.section, t.points,
        case t.status when 'awarded' then 'مُنحت في قيمي' when 'pending' then 'معلقة' else 'أُلغيت' end) order by t.week_start, sc.name) into rows
    from public.ind_reward_transactions t join ind_rep_scope sc on sc.student_id = t.student_id where t.week_start between public.ind_week_start(p_from) and p_to;

  else raise exception 'bad_request';
  end if;
  return jsonb_build_object('kind', p_kind, 'from', p_from, 'to', p_to, 'columns', cols, 'rows', coalesce(rows, '[]'::jsonb));
end $f$;

create or replace function public.ind_year_info() returns jsonb language sql stable security definer set search_path = '' as $f$
  select case when public.ind_me() is null then null else (select jsonb_build_object('id', id, 'name', name, 'starts_on', starts_on, 'ends_on', ends_on)
    from public.academic_years where id = public.ind_current_year()) end $f$;

-- المنح
do $$ declare f text; begin
  foreach f in array array['public.ind_set_reward_settings(jsonb)', 'public.ind_rewards_run(date)', 'public.ind_rewards_overview(integer)',
    'public.ind_report(text, date, date, text, uuid, text, integer)', 'public.ind_year_info()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.ind_week_start(date)', 'public.ind_week_days(date)', 'public.ind_week_final(date)',
    'public.ind_qm_ledger(uuid, integer, text, text, uuid, uuid, uuid)', 'public.ind_rewards_process(date, uuid)', 'public.ind_trg_lock_rewards()',
    'public.ind_reward_reverse(uuid, date, text)', 'public.ind_trg_reward_absence()', 'public.ind_trg_reward_lateness()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
