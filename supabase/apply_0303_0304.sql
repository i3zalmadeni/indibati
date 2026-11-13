-- انضباطي: تطبيق 0303 ثم 0304 دفعة واحدة (قابل لإعادة التنفيذ). يُشغَّل في Supabase › SQL Editor لمشروع labeedsch_PC.
begin;
-- =====================================================================
-- انضباطي · 0303 · الأعذار الإلكترونية، وروابط ولي الأمر الآمنة، والملف الانضباطي،
-- ومركز الإشعارات (طابور واتساب)، ومحرك الإجراءات النظامية للغياب.
-- لا يعدّل جداول النواة. أرقام الجوال تُقرأ من guardians عند الإرسال فقط ولا تُنسخ ولا تُعاد للواجهة.
-- =====================================================================

insert into public.ind_settings (key, value) values
  ('excuses', '{"attachment_required": false, "max_days_after": 14, "link_valid_days": 14}'),
  ('notifications', '{"portal_url": "https://i3zalmadeni.github.io/indibati/guardian.html", "lateness_repeat_threshold": 3, "lateness_repeat_window_days": 30, "escalation_notify": false}')
on conflict (key) do nothing;

-- ---------- روابط ولي الأمر (رمز عشوائي يُخزَّن مجزّأً فقط) ----------
create table if not exists public.ind_guardian_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  guardian_id uuid references public.guardians(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.staff_members(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  use_count int not null default 0
);
create index if not exists ind_glinks_student_idx on public.ind_guardian_links (student_id);

-- ---------- الأعذار ----------
create table if not exists public.ind_excuses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  day date not null,
  link_id uuid references public.ind_guardian_links(id),
  reason text not null,
  details text,
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.staff_members(id),
  reviewed_at timestamptz,
  review_note text,
  reclassified boolean not null default false,
  request_id uuid unique
);
-- عذر قائم واحد لكل طالب ويوم؛ يجوز إعادة التقديم بعد الرفض
create unique index if not exists ind_excuse_one_open on public.ind_excuses (student_id, day) where status <> 'rejected';
create index if not exists ind_excuse_status_idx on public.ind_excuses (status, submitted_at desc);
create table if not exists public.ind_excuse_attachments (
  id uuid primary key default gen_random_uuid(),
  excuse_id uuid not null references public.ind_excuses(id) on delete restrict,
  path text not null unique,
  mime text,
  size_bytes int,
  created_at timestamptz not null default now()
);

-- ---------- قوالب الرسائل ----------
-- body: نص المعاينة والسجل. wa_template/wa_params: اسم القالب المعتمد لدى WhatsApp وترتيب متغيراته.
create table if not exists public.ind_notification_templates (
  code text primary key,
  name text not null,
  body text not null,
  wa_template text,
  wa_lang text not null default 'ar',
  wa_params text[] not null default '{}',
  is_active boolean not null default true,
  updated_by uuid references public.staff_members(id),
  updated_at timestamptz not null default now()
);
insert into public.ind_notification_templates (code, name, body, wa_params) values
  ('absence', 'إشعار غياب يومي', E'السلام عليكم ورحمة الله وبركاته،\n\nنحيطكم علماً بأن ابنكم ({student}) قد تم تسجيل غيابه اليوم ({date}) في مدرسة لبيد بن ربيعة المتوسطة.\n\nنأمل الدخول على الرابط المرفق لتوضيح سبب الغياب وإرفاق العذر إن وجد.\n{link}\n\nشاكرين لكم تعاونكم.\n\nمدرسة لبيد بن ربيعة المتوسطة.', array['student','date','link']),
  ('lateness', 'إشعار تأخر', E'السلام عليكم ورحمة الله وبركاته،\n\nنود إشعاركم بتأخر ابنكم ({student}) عن الحضور إلى المدرسة.\n\nالتاريخ: ({date}).\n\nوقت وصول الطالب: ({arrival}).\n\nسبب التأخر: ({reason}).\n\nنأمل الحرص على انتظام الطالب في الحضور الصباحي.\n\nمدرسة لبيد بن ربيعة المتوسطة.', array['student','date','arrival','reason']),
  ('lateness_repeat', 'إشعار تكرار التأخر', E'السلام عليكم ورحمة الله وبركاته،\n\nنود إشعاركم بتكرار تأخر ابنكم ({student}) عن الحضور الصباحي، إذ بلغ عدد مرات تأخره ({count}) مرات خلال الفترة الأخيرة.\n\nنأمل التعاون في الحرص على انتظامه.\n\nمدرسة لبيد بن ربيعة المتوسطة.', array['student','count']),
  ('escalation', 'إشعار الغياب النظامي', E'السلام عليكم ورحمة الله وبركاته،\n\nنحيطكم علماً بأن عدد أيام غياب ابنكم ({student}) بلغ ({days}) أيام، وعليه صدر بحقه ({level}).\n\nنأمل مراجعة المدرسة.\n{link}\n\nمدرسة لبيد بن ربيعة المتوسطة.', array['student','days','level','link']),
  ('excuse_received', 'إشعار استلام العذر', E'السلام عليكم ورحمة الله وبركاته،\n\nاستلمنا عذر غياب ابنكم ({student}) ليوم ({date})، وسيُراجع وتصلكم النتيجة.\n\nمدرسة لبيد بن ربيعة المتوسطة.', array['student','date']),
  ('excuse_result', 'إشعار نتيجة مراجعة العذر', E'السلام عليكم ورحمة الله وبركاته،\n\nنفيدكم بأن عذر غياب ابنكم ({student}) ليوم ({date}) قد ({result}).\n{note}\n\nمدرسة لبيد بن ربيعة المتوسطة.', array['student','date','result','note'])
on conflict (code) do nothing;

-- ---------- طابور الإشعارات وسجلها ----------
-- الحالات: queued بانتظار الإرسال · no_phone لا رقم لولي الأمر · sent أكّد المزود الاستلام · delivered · read · failed · cancelled
create table if not exists public.ind_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  guardian_id uuid references public.guardians(id),
  kind text not null check (kind in ('absence','lateness','lateness_repeat','escalation','excuse_received','excuse_result')),
  template_code text not null references public.ind_notification_templates(code),
  vars jsonb not null default '{}',
  body text,
  link_id uuid references public.ind_guardian_links(id),
  status text not null default 'queued' check (status in ('queued','sending','no_phone','sent','delivered','read','failed','cancelled')),
  provider_message_id text unique,
  error text,
  attempts int not null default 0,
  dedupe_key text unique,
  created_by uuid references public.staff_members(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists ind_notif_status_idx on public.ind_notifications (status, created_at);
create index if not exists ind_notif_student_idx on public.ind_notifications (student_id, created_at desc);
create table if not exists public.ind_notification_events (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.ind_notifications(id),
  status text not null,
  detail jsonb,
  at timestamptz not null default now()
);

-- ---------- الإجراءات النظامية ----------
-- الحدود قابلة للضبط ومعطّلة افتراضياً حتى تُراجع مع اللائحة السارية (is_active = false).
create table if not exists public.ind_escalation_rules (
  id uuid primary key default gen_random_uuid(),
  level int not null unique,
  label text not null,
  days int not null check (days > 0),
  count_mode text not null default 'unexcused' check (count_mode in ('unexcused','all')),
  pattern text not null default 'total' check (pattern in ('total','consecutive')),
  notify boolean not null default true,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.ind_escalation_rules (level, label, days) values
  (1, 'الإشعار الأول', 3), (2, 'الإشعار الثاني', 5), (3, 'الإشعار الثالث', 10), (4, 'إشعار بلوغ الحد المحدد', 18)
on conflict (level) do nothing;
create table if not exists public.ind_escalation_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  rule_id uuid not null references public.ind_escalation_rules(id),
  year_id uuid not null references public.academic_years(id),
  days_count int not null,
  status text not null default 'active' check (status in ('active','withdrawn')),
  notification_id uuid references public.ind_notifications(id),
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, rule_id, year_id)
);

-- =====================================================================
-- دوال داخلية
-- =====================================================================
create or replace function public.ind_hash(p text) returns text language sql immutable set search_path = '' as $f$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex') $f$;

-- رابط جديد لولي الأمر: يعيد الرمز الخام مرة واحدة فقط
create or replace function public.ind_new_link(p_student uuid, p_guardian uuid, out link_id uuid, out token text)
language plpgsql security definer set search_path = '' as $f$
declare days int := coalesce((public.ind_setting('excuses')->>'link_valid_days')::int, 14);
begin
  token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.ind_guardian_links (student_id, guardian_id, token_hash, expires_at, created_by)
  values (p_student, p_guardian, public.ind_hash(token), now() + make_interval(days => days), public.ind_me())
  returning id into link_id;
end $f$;

create or replace function public.ind_link_by_token(p_token text) returns public.ind_guardian_links
language sql stable security definer set search_path = '' as $f$
  select * from public.ind_guardian_links where token_hash = public.ind_hash(coalesce(p_token, ''))
    and revoked_at is null and expires_at > now() limit 1 $f$;

-- ولي الأمر الأساسي للطالب (إن وُجد في النواة)
create or replace function public.ind_primary_guardian(p_student uuid) returns uuid language sql stable security definer set search_path = '' as $f$
  select sg.guardian_id from public.student_guardians sg where sg.student_id = p_student order by sg.is_primary desc nulls last limit 1 $f$;

-- إدراج إشعار في الطابور (لا إرسال هنا). يُرجع المعرف، ولا يكرر إشعاراً بالمفتاح نفسه.
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
  has_phone := g is not null and exists (select 1 from public.guardians where id = g and nullif(trim(coalesce(phone, '')), '') is not null);
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

-- عدد أيام الغياب للطالب في العام الحالي وفق القاعدة (إجمالي أو أطول سلسلة متصلة من أيام الدراسة)
create or replace function public.ind_absence_count(p_student uuid, p_mode text, p_pattern text) returns int
language plpgsql stable security definer set search_path = '' as $f$
declare yr uuid := public.ind_current_year(); y record; wk int[]; n int;
begin
  if p_pattern = 'consecutive' then
    select * into y from public.academic_years where id = yr;
    select coalesce(array_agg(v::int), '{}') into wk from jsonb_array_elements_text(coalesce(public.ind_setting('attendance')->'weekend', '[]')) v;
    with days as (
      select d::date as day, row_number() over (order by d) as rn
      from generate_series(coalesce(y.starts_on, public.ind_today() - 365), public.ind_today(), interval '1 day') d
      where extract(dow from d)::int <> all (wk)),
    abs as (
      select dd.rn from days dd join public.ind_attendance_records r on r.day = dd.day and r.student_id = p_student
      join public.ind_attendance_sessions s on s.id = r.session_id and s.year_id = yr
      where p_mode = 'all' or r.status = 'absent_unexcused')
    select coalesce(max(c), 0) into n from (select count(*) c from (select rn, rn - row_number() over (order by rn) grp from abs) t group by grp) z;
    return n;
  end if;
  select count(*) into n from public.ind_attendance_records r join public.ind_attendance_sessions s on s.id = r.session_id
    where r.student_id = p_student and s.year_id = yr and (p_mode = 'all' or r.status = 'absent_unexcused');
  return n;
end $f$;

-- محرك الإجراءات: ينشئ الإجراء عند بلوغ الحد، ويسحبه (إن لم يُشعَر بعد) إذا انخفض العدد بعد تعديل أو اعتماد عذر
create or replace function public.ind_escalate(p_student uuid) returns void language plpgsql security definer set search_path = '' as $f$
declare r record; n int; yr uuid := public.ind_current_year(); rec record; nid uuid; notify boolean := coalesce((public.ind_setting('notifications')->>'escalation_notify')::boolean, false);
begin
  if yr is null then return; end if;
  for r in select * from public.ind_escalation_rules where is_active order by level loop
    n := public.ind_absence_count(p_student, r.count_mode, r.pattern);
    select * into rec from public.ind_escalation_records where student_id = p_student and rule_id = r.id and year_id = yr;
    if n >= r.days then
      if rec.id is null then
        insert into public.ind_escalation_records (student_id, rule_id, year_id, days_count) values (p_student, r.id, yr, n) returning * into rec;
        perform public.ind_audit('escalation_created', 'escalation', rec.id::text, null, jsonb_build_object('student_id', p_student, 'level', r.level, 'days', n));
        if notify and r.notify then
          nid := public.ind_enqueue(p_student, 'escalation', 'escalation', jsonb_build_object('days', n, 'level', r.label), 'escalation:' || rec.id, true);
          update public.ind_escalation_records set notification_id = nid where id = rec.id;
        end if;
      elsif rec.status = 'withdrawn' then
        update public.ind_escalation_records set status = 'active', days_count = n where id = rec.id;
      end if;
    elsif rec.id is not null and rec.status = 'active' and rec.notification_id is null and rec.printed_at is null then
      update public.ind_escalation_records set status = 'withdrawn', days_count = n where id = rec.id;
      perform public.ind_audit('escalation_withdrawn', 'escalation', rec.id::text, null, jsonb_build_object('days', n));
    end if;
  end loop;
end $f$;

create or replace function public.ind_trg_attendance_escalate() returns trigger language plpgsql security definer set search_path = '' as $f$
begin perform public.ind_escalate(coalesce(new.student_id, old.student_id)); return null; end $f$;
drop trigger if exists ind_att_escalate on public.ind_attendance_records;
create trigger ind_att_escalate after insert or update or delete on public.ind_attendance_records for each row execute function public.ind_trg_attendance_escalate();

-- إشعارات التأخر الآلية: فوري عند التسجيل، وعند بلوغ عدد مرات التكرار
create or replace function public.ind_trg_lateness_notify() returns trigger language plpgsql security definer set search_path = '' as $f$
declare L jsonb := public.ind_setting('lateness'); N jsonb := public.ind_setting('notifications'); k int; thr int := coalesce((N->>'lateness_repeat_threshold')::int, 0);
begin
  if coalesce((L->>'notify_enabled')::boolean, false) then
    perform public.ind_enqueue(new.student_id, 'lateness', 'lateness', jsonb_build_object('date', new.day, 'arrival', to_char(new.arrival_time, 'HH24:MI'),
      'reason', coalesce(nullif(new.reason_text, ''), (select name from public.ind_lateness_reasons where id = new.reason_id))), 'lateness:' || new.id, false);
  end if;
  if thr > 0 then
    select count(*) into k from public.ind_lateness_records where student_id = new.student_id and voided_at is null
      and day > new.day - coalesce((N->>'lateness_repeat_window_days')::int, 30);
    if k >= thr and k % thr = 0 then
      perform public.ind_enqueue(new.student_id, 'lateness_repeat', 'lateness_repeat', jsonb_build_object('count', k), 'lateness_repeat:' || new.student_id || ':' || new.day, false);
    end if;
  end if;
  return null;
end $f$;
drop trigger if exists ind_late_notify on public.ind_lateness_records;
create trigger ind_late_notify after insert on public.ind_lateness_records for each row execute function public.ind_trg_lateness_notify();

-- =====================================================================
-- بوابة ولي الأمر (تُستدعى دون حساب، بالرمز فقط)
-- =====================================================================
create or replace function public.ind_g_portal(p_token text) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare lk public.ind_guardian_links; yr uuid := public.ind_current_year(); E jsonb := public.ind_setting('excuses');
begin
  lk := public.ind_link_by_token(p_token);
  if lk.id is null then return jsonb_build_object('error', 'invalid_link'); end if;
  update public.ind_guardian_links set last_used_at = now(), use_count = use_count + 1 where id = lk.id;
  return jsonb_build_object(
    'student', (select jsonb_build_object('name', s.full_name, 'grade', g.name_ar, 'section', c.name)
       from public.students s left join public.student_enrollments e on e.student_id = s.id and e.year_id = yr
       left join public.class_sections c on c.id = e.section_id left join public.grade_levels g on g.code = e.grade_code where s.id = lk.student_id limit 1),
    'expires_at', lk.expires_at, 'today', public.ind_today(), 'settings', E,
    'absences', coalesce((select jsonb_agg(jsonb_build_object('day', r.day, 'status', r.status,
        'excuse', (select jsonb_build_object('status', x.status, 'reason', x.reason, 'note', x.review_note) from public.ind_excuses x
                   where x.student_id = r.student_id and x.day = r.day order by x.submitted_at desc limit 1)) order by r.day desc)
      from public.ind_attendance_records r join public.ind_attendance_sessions s on s.id = r.session_id
      where r.student_id = lk.student_id and s.year_id = yr), '[]'::jsonb),
    'lateness', coalesce((select jsonb_agg(jsonb_build_object('day', l.day, 'arrival', to_char(l.arrival_time, 'HH24:MI'), 'minutes', l.minutes,
        'reason', coalesce(nullif(l.reason_text, ''), rr.name)) order by l.day desc)
      from public.ind_lateness_records l join public.ind_lateness_reasons rr on rr.id = l.reason_id
      where l.student_id = lk.student_id and l.year_id = yr and l.voided_at is null), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'at', coalesce(n.sent_at, n.created_at), 'status', n.status) order by n.created_at desc)
      from public.ind_notifications n where n.student_id = lk.student_id and n.status in ('sent','delivered','read')), '[]'::jsonb));
end $f$;

-- تقديم العذر: لا يغيّر سجل الغياب الرسمي؛ يراجعه منسق الغياب
create or replace function public.ind_g_submit_excuse(p_token text, p_day date, p_reason text, p_details text default null, p_paths text[] default '{}', p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare lk public.ind_guardian_links; E jsonb := public.ind_setting('excuses'); xid uuid; p text; rsn text := nullif(trim(coalesce(p_reason, '')), '');
begin
  lk := public.ind_link_by_token(p_token);
  if lk.id is null then return jsonb_build_object('error', 'invalid_link'); end if;
  if p_request_id is not null then
    select id into xid from public.ind_excuses where request_id = p_request_id;
    if found then return jsonb_build_object('ok', true, 'id', xid, 'duplicate_request', true); end if;
  end if;
  if rsn is null then raise exception 'reason_required'; end if;
  if length(rsn) > 120 or length(coalesce(p_details, '')) > 1000 then raise exception 'text_too_long'; end if;
  if not exists (select 1 from public.ind_attendance_records where student_id = lk.student_id and day = p_day) then raise exception 'no_absence_that_day'; end if;
  if p_day < public.ind_today() - coalesce((E->>'max_days_after')::int, 14) then raise exception 'excuse_too_late'; end if;
  if coalesce((E->>'attachment_required')::boolean, false) and coalesce(cardinality(p_paths), 0) = 0 then raise exception 'attachment_required'; end if;
  if coalesce(cardinality(p_paths), 0) > 3 then raise exception 'too_many_files'; end if;
  if exists (select 1 from public.ind_excuses where student_id = lk.student_id and day = p_day and status <> 'rejected') then raise exception 'excuse_exists'; end if;
  -- المرفقات رُفعت عبر دالة الحافة إلى مجلد الطالب نفسه فقط
  foreach p in array coalesce(p_paths, '{}') loop
    if p not like lk.student_id::text || '/%' then raise exception 'attachment_invalid'; end if;
  end loop;
  insert into public.ind_excuses (student_id, day, link_id, reason, details, request_id) values (lk.student_id, p_day, lk.id, rsn, nullif(trim(coalesce(p_details, '')), ''), p_request_id)
  returning id into xid;
  insert into public.ind_excuse_attachments (excuse_id, path) select xid, unnest(coalesce(p_paths, '{}'));
  insert into public.ind_audit_logs (actor_id, action, entity, entity_id, new_data)
  values (null, 'excuse_submitted', 'excuse', xid::text, jsonb_build_object('student_id', lk.student_id, 'day', p_day, 'reason', rsn, 'files', cardinality(p_paths), 'via', 'guardian_link'));
  perform public.ind_enqueue(lk.student_id, 'excuse_received', 'excuse_received', jsonb_build_object('date', p_day), 'excuse_received:' || xid, false);
  return jsonb_build_object('ok', true, 'id', xid);
end $f$;

-- للخادم فقط (دالة الحافة): التحقق من الرمز قبل رفع المرفق
create or replace function public.ind_svc_link_student(p_token text) returns uuid language sql stable security definer set search_path = '' as $f$
  select (public.ind_link_by_token(p_token)).student_id $f$;

-- =====================================================================
-- الأعذار: المراجعة
-- =====================================================================
create or replace function public.ind_guardian_link(p_student uuid) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare lk record;
begin
  if not public.ind_is_coord() then return public.ind_deny('guardian_link', jsonb_build_object('student', p_student)); end if;
  if not exists (select 1 from public.students where id = p_student) then raise exception 'not_found'; end if;
  select * into lk from public.ind_new_link(p_student, public.ind_primary_guardian(p_student));
  perform public.ind_audit('guardian_link_created', 'guardian_link', lk.link_id::text, null, jsonb_build_object('student_id', p_student));
  return jsonb_build_object('url', coalesce(public.ind_setting('notifications')->>'portal_url', '') || '?t=' || lk.token,
    'expires_at', (select expires_at from public.ind_guardian_links where id = lk.link_id));
end $f$;

create or replace function public.ind_excuses_list(p_status text default null, p_from date default null, p_to date default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_can_oversee() then return public.ind_deny('excuses_list'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'student_id', x.student_id, 'name', s.full_name, 'no', s.student_no,
      'grade_name', g.name_ar, 'section', c.name, 'day', x.day, 'reason', x.reason, 'details', x.details, 'status', x.status,
      'submitted_at', x.submitted_at, 'reviewed_by', m.full_name, 'reviewed_at', x.reviewed_at, 'review_note', x.review_note,
      'recorded', (select status from public.ind_attendance_records r where r.student_id = x.student_id and r.day = x.day),
      'files', (select count(*) from public.ind_excuse_attachments a where a.excuse_id = x.id)) order by x.submitted_at desc)
    from public.ind_excuses x join public.students s on s.id = x.student_id
    left join public.student_enrollments e on e.student_id = s.id and e.year_id = public.ind_current_year()
    left join public.class_sections c on c.id = e.section_id left join public.grade_levels g on g.code = e.grade_code
    left join public.staff_members m on m.id = x.reviewed_by
    where (p_status is null or x.status = p_status) and (p_from is null or x.day >= p_from) and (p_to is null or x.day <= p_to)), '[]'::jsonb);
end $f$;

create or replace function public.ind_excuse_files(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_can_oversee() then return public.ind_deny('excuse_files', jsonb_build_object('id', p_id)); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('path', path, 'mime', mime)) from public.ind_excuse_attachments where excuse_id = p_id), '[]'::jsonb);
end $f$;

-- قرار المراجعة. الاعتماد يحوّل «غائب بدون عذر» إلى «غائب بعذر» في السجل الرسمي (حتى لو كان مثبتاً) مع توثيق كامل.
create or replace function public.ind_excuse_review(p_id uuid, p_decision text, p_note text default null, p_notify boolean default true) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare x record; rec record; note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.ind_is_coord() then return public.ind_deny('excuse_review', jsonb_build_object('id', p_id)); end if;
  if p_decision not in ('under_review','approved','rejected') then raise exception 'bad_request'; end if;
  if p_decision = 'rejected' and note is null then raise exception 'reason_required'; end if;
  select * into x from public.ind_excuses where id = p_id for update; if not found then raise exception 'not_found'; end if;
  if x.status in ('approved','rejected') then raise exception 'already_decided'; end if;
  update public.ind_excuses set status = p_decision, review_note = coalesce(note, review_note), reviewed_by = public.ind_me(), reviewed_at = now() where id = p_id;
  if p_decision = 'approved' then
    select * into rec from public.ind_attendance_records where student_id = x.student_id and day = x.day;
    if rec.status = 'absent_unexcused' then
      update public.ind_attendance_records set status = 'absent_excused', recorded_by = public.ind_me(), updated_at = now() where id = rec.id;
      update public.ind_excuses set reclassified = true where id = p_id;
      perform public.ind_audit('attendance_reclassified', 'attendance', rec.section_id || '@' || x.day,
        jsonb_build_object('student_id', x.student_id, 'status', 'absent_unexcused'), jsonb_build_object('student_id', x.student_id, 'status', 'absent_excused'), 'اعتماد عذر ولي الأمر');
    end if;
  end if;
  perform public.ind_audit('excuse_' || p_decision, 'excuse', p_id::text, jsonb_build_object('status', x.status), jsonb_build_object('status', p_decision), note);
  if p_notify and p_decision in ('approved','rejected') then
    perform public.ind_enqueue(x.student_id, 'excuse_result', 'excuse_result', jsonb_build_object('date', x.day,
      'result', case when p_decision = 'approved' then 'اعتُمد' else 'لم يُعتمد' end, 'note', coalesce(note, '')), 'excuse_result:' || p_id, false);
  end if;
  return jsonb_build_object('ok', true);
end $f$;

-- =====================================================================
-- الملف الانضباطي للطالب
-- =====================================================================
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
       'has_phone', exists (select 1 from public.guardians gg where gg.id = public.ind_primary_guardian(s.id) and nullif(trim(coalesce(gg.phone, '')), '') is not null))
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

-- =====================================================================
-- مركز الإشعارات
-- =====================================================================
-- الغائبون في يوم ونطاق، مع توفر رقم ولي الأمر (دون إظهار الرقم) وحالة الإشعار السابق
create or replace function public.ind_notice_candidates(p_day date, p_scope text default 'all', p_sections uuid[] default null, p_grade text default null) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_is_coord() then return public.ind_deny('notice_candidates'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('student_id', r.student_id, 'name', s.full_name, 'no', s.student_no, 'status', r.status,
      'label', g.name_ar || ' – ' || c.name,
      'guardian', (select gg.full_name from public.guardians gg where gg.id = public.ind_primary_guardian(r.student_id)),
      'has_phone', exists (select 1 from public.guardians gg where gg.id = public.ind_primary_guardian(r.student_id) and nullif(trim(coalesce(gg.phone, '')), '') is not null),
      'notice', (select jsonb_build_object('id', n.id, 'status', n.status) from public.ind_notifications n where n.dedupe_key = 'absence:' || r.student_id || ':' || p_day))
      order by g.sort_order, c.name, s.full_name)
    from public.ind_attendance_records r join public.students s on s.id = r.student_id
    join public.class_sections c on c.id = r.section_id join public.grade_levels g on g.code = c.grade_code
    where r.day = p_day and r.section_id = any (public.ind_resolve_sections(p_sections, p_scope, p_grade))), '[]'::jsonb);
end $f$;

create or replace function public.ind_queue_absence_notices(p_day date, p_students uuid[]) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare sid uuid; nid uuid; q int := 0; np int := 0; dup int := 0; st text;
begin
  if not public.ind_is_coord() then return public.ind_deny('queue_absence'); end if;
  if coalesce(cardinality(p_students), 0) = 0 then raise exception 'students_required'; end if;
  if cardinality(p_students) > 500 then raise exception 'too_many'; end if;
  foreach sid in array p_students loop
    if not exists (select 1 from public.ind_attendance_records where student_id = sid and day = p_day) then continue; end if;
    if exists (select 1 from public.ind_notifications where dedupe_key = 'absence:' || sid || ':' || p_day and status <> 'cancelled') then dup := dup + 1; continue; end if;
    nid := public.ind_enqueue(sid, 'absence', 'absence', jsonb_build_object('date', p_day), 'absence:' || sid || ':' || p_day, true);
    select status into st from public.ind_notifications where id = nid;
    if st = 'no_phone' then np := np + 1; else q := q + 1; end if;
  end loop;
  perform public.ind_audit('absence_notices_queued', 'notification', p_day::text, null, jsonb_build_object('queued', q, 'no_phone', np, 'duplicates', dup));
  return jsonb_build_object('queued', q, 'no_phone', np, 'duplicates', dup);
end $f$;

create or replace function public.ind_notifications_list(p_status text default null, p_kind text default null, p_from date default null, p_limit int default 200) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_can_oversee() then return public.ind_deny('notifications_list'); end if;
  return coalesce((select jsonb_agg(x) from (select jsonb_build_object('id', n.id, 'student', s.full_name, 'guardian', gg.full_name, 'kind', n.kind,
      'template', n.template_code, 'vars', n.vars - 'link', 'has_link', n.vars ? 'link', 'body', n.body, 'status', n.status, 'error', n.error, 'attempts', n.attempts,
      'provider_message_id', n.provider_message_id, 'created_at', n.created_at, 'sent_at', n.sent_at, 'by', m.full_name) x
    from public.ind_notifications n join public.students s on s.id = n.student_id
    left join public.guardians gg on gg.id = n.guardian_id left join public.staff_members m on m.id = n.created_by
    where (p_status is null or n.status = p_status) and (p_kind is null or n.kind = p_kind) and (p_from is null or n.created_at >= p_from)
    order by n.created_at desc limit least(greatest(p_limit, 1), 1000)) t), '[]'::jsonb);
end $f$;

create or replace function public.ind_notification_cancel(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_is_coord() then return public.ind_deny('notification_cancel'); end if;
  update public.ind_notifications set status = 'cancelled', updated_at = now() where id = p_id and status in ('queued','no_phone','failed');
  if not found then raise exception 'not_allowed'; end if;
  insert into public.ind_notification_events (notification_id, status, detail) values (p_id, 'cancelled', jsonb_build_object('by', public.ind_me()));
  perform public.ind_audit('notification_cancelled', 'notification', p_id::text, null, null);
  return jsonb_build_object('ok', true);
end $f$;

-- إعادة المحاولة للفاشل
create or replace function public.ind_notification_retry(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_is_coord() then return public.ind_deny('notification_retry'); end if;
  update public.ind_notifications set status = 'queued', error = null, updated_at = now() where id = p_id and status = 'failed';
  if not found then raise exception 'not_allowed'; end if;
  insert into public.ind_notification_events (notification_id, status) values (p_id, 'requeued');
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.ind_templates_list() returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not (public.ind_is_coord() or public.ind_has('portal_admin')) then return public.ind_deny('templates_list'); end if;
  return coalesce((select jsonb_agg(to_jsonb(t) - 'updated_by' order by t.code) from public.ind_notification_templates t), '[]'::jsonb);
end $f$;

create or replace function public.ind_template_save(p_code text, p_body text, p_wa_template text, p_wa_lang text, p_wa_params text[], p_active boolean) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare o jsonb;
begin
  if not (public.ind_is_admin() or public.ind_has('portal_admin')) then return public.ind_deny('template_save'); end if;
  select to_jsonb(t) into o from public.ind_notification_templates t where code = p_code; if o is null then raise exception 'not_found'; end if;
  if nullif(trim(coalesce(p_body, '')), '') is null then raise exception 'name_required'; end if;
  update public.ind_notification_templates set body = p_body, wa_template = nullif(trim(coalesce(p_wa_template, '')), ''), wa_lang = coalesce(nullif(p_wa_lang, ''), 'ar'),
    wa_params = coalesce(p_wa_params, '{}'), is_active = coalesce(p_active, true), updated_by = public.ind_me(), updated_at = now() where code = p_code;
  perform public.ind_audit('template_changed', 'template', p_code, o, (select to_jsonb(t) from public.ind_notification_templates t where code = p_code));
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.ind_set_notification_settings(p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare o jsonb := public.ind_setting('notifications'); n jsonb;
begin
  if not public.ind_is_coord() then return public.ind_deny('notification_settings'); end if;
  n := o || jsonb_build_object(
    'lateness_repeat_threshold', greatest(0, least(coalesce((p->>'lateness_repeat_threshold')::int, 3), 50)),
    'lateness_repeat_window_days', greatest(1, least(coalesce((p->>'lateness_repeat_window_days')::int, 30), 200)),
    'escalation_notify', coalesce((p->>'escalation_notify')::boolean, false));
  if public.ind_is_admin() or public.ind_has('portal_admin') then
    n := n || jsonb_build_object('portal_url', coalesce(nullif(trim(p->>'portal_url'), ''), o->>'portal_url'));
  end if;
  update public.ind_settings set value = n, updated_by = public.ind_me(), updated_at = now() where key = 'notifications';
  perform public.ind_audit('notification_settings_changed', 'settings', 'notifications', o, n);
  return n;
end $f$;

create or replace function public.ind_set_excuse_settings(p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare o jsonb := public.ind_setting('excuses'); n jsonb;
begin
  if not public.ind_is_coord() then return public.ind_deny('excuse_settings'); end if;
  n := jsonb_build_object('attachment_required', coalesce((p->>'attachment_required')::boolean, false),
    'max_days_after', greatest(1, least(coalesce((p->>'max_days_after')::int, 14), 120)),
    'link_valid_days', greatest(1, least(coalesce((p->>'link_valid_days')::int, 14), 120)));
  update public.ind_settings set value = n, updated_by = public.ind_me(), updated_at = now() where key = 'excuses';
  perform public.ind_audit('excuse_settings_changed', 'settings', 'excuses', o, n);
  return n;
end $f$;

-- =====================================================================
-- الإجراءات النظامية
-- =====================================================================
create or replace function public.ind_escalation_rules_list() returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_can_oversee() then return public.ind_deny('escalation_rules'); end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.level) from public.ind_escalation_rules r), '[]'::jsonb);
end $f$;

create or replace function public.ind_escalation_rule_save(p_id uuid, p_label text, p_days int, p_mode text, p_pattern text, p_notify boolean, p_active boolean) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare o jsonb; s uuid;
begin
  if not public.ind_is_coord() then return public.ind_deny('escalation_rule_save'); end if;
  select to_jsonb(r) into o from public.ind_escalation_rules r where id = p_id; if o is null then raise exception 'not_found'; end if;
  if coalesce(p_days, 0) < 1 or nullif(trim(coalesce(p_label, '')), '') is null then raise exception 'bad_request'; end if;
  update public.ind_escalation_rules set label = trim(p_label), days = p_days, count_mode = case when p_mode = 'all' then 'all' else 'unexcused' end,
    pattern = case when p_pattern = 'consecutive' then 'consecutive' else 'total' end, notify = coalesce(p_notify, true), is_active = coalesce(p_active, false), updated_at = now() where id = p_id;
  perform public.ind_audit('escalation_rule_changed', 'escalation_rule', p_id::text, o, (select to_jsonb(r) from public.ind_escalation_rules r where id = p_id));
  -- عند التفعيل أو التعديل: إعادة التقييم لكل من له غياب في العام الحالي
  for s in select distinct r.student_id from public.ind_attendance_records r join public.ind_attendance_sessions x on x.id = r.session_id where x.year_id = public.ind_current_year() loop
    perform public.ind_escalate(s);
  end loop;
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.ind_escalations_list(p_status text default 'active') returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not public.ind_can_oversee() then return public.ind_deny('escalations_list'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', er.id, 'student_id', er.student_id, 'name', s.full_name, 'no', s.student_no,
      'grade_name', g.name_ar, 'section', c.name, 'level', ru.level, 'label', ru.label, 'days', er.days_count, 'status', er.status,
      'created_at', er.created_at, 'printed_at', er.printed_at, 'notice', (select status from public.ind_notifications n where n.id = er.notification_id)) order by er.created_at desc)
    from public.ind_escalation_records er join public.ind_escalation_rules ru on ru.id = er.rule_id join public.students s on s.id = er.student_id
    left join public.student_enrollments e on e.student_id = s.id and e.year_id = er.year_id
    left join public.class_sections c on c.id = e.section_id left join public.grade_levels g on g.code = e.grade_code
    where er.year_id = public.ind_current_year() and (p_status is null or er.status = p_status)), '[]'::jsonb);
end $f$;

-- بيانات الإشعار الرسمي للطباعة، وتسجيل وقت الطباعة
create or replace function public.ind_escalation_print(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare er record;
begin
  if not public.ind_can_oversee() then return public.ind_deny('escalation_print', jsonb_build_object('id', p_id)); end if;
  select * into er from public.ind_escalation_records where id = p_id; if not found then raise exception 'not_found'; end if;
  update public.ind_escalation_records set printed_at = coalesce(printed_at, now()) where id = p_id;
  perform public.ind_audit('escalation_printed', 'escalation', p_id::text, null, null);
  return jsonb_build_object('school', (select jsonb_build_object('name', official_name, 'ministry_no', ministry_no, 'department', education_department, 'office', education_office) from public.school_profile limit 1),
    'student', (select jsonb_build_object('name', s.full_name, 'no', s.student_no, 'grade', g.name_ar, 'section', c.name)
       from public.students s left join public.student_enrollments e on e.student_id = s.id and e.year_id = er.year_id
       left join public.class_sections c on c.id = e.section_id left join public.grade_levels g on g.code = e.grade_code where s.id = er.student_id),
    'rule', (select jsonb_build_object('level', level, 'label', label, 'days', days, 'count_mode', count_mode, 'pattern', pattern) from public.ind_escalation_rules where id = er.rule_id),
    'days', er.days_count, 'created_at', er.created_at, 'today', public.ind_today(),
    'absences', coalesce((select jsonb_agg(jsonb_build_object('day', r.day, 'status', r.status) order by r.day)
       from public.ind_attendance_records r join public.ind_attendance_sessions x on x.id = r.session_id where r.student_id = er.student_id and x.year_id = er.year_id), '[]'::jsonb));
end $f$;

create or replace function public.ind_settings_get() returns jsonb language plpgsql security definer set search_path = '' as $f$
begin
  if not (public.ind_is_coord() or public.ind_has('portal_admin')) then return public.ind_deny('settings_get'); end if;
  return jsonb_build_object('excuses', public.ind_setting('excuses'), 'notifications', public.ind_setting('notifications'));
end $f$;

-- ملخص إضافي للوحة المنسق وشؤون الطلاب
create or replace function public.ind_dashboard_extra() returns jsonb language plpgsql security definer set search_path = '' as $f$
declare yr uuid := public.ind_current_year();
begin
  if not public.ind_can_oversee() then return public.ind_deny('dashboard_extra'); end if;
  return jsonb_build_object(
    'excuses_new', (select count(*) from public.ind_excuses where status in ('submitted','under_review')),
    'notif_queued', (select count(*) from public.ind_notifications where status = 'queued'),
    'notif_failed', (select count(*) from public.ind_notifications where status = 'failed'),
    'notif_no_phone', (select count(*) from public.ind_notifications where status = 'no_phone' and created_at > now() - interval '30 days'),
    'escalations_active', (select count(*) from public.ind_escalation_records where status = 'active' and year_id = yr and printed_at is null),
    'rules_active', (select count(*) from public.ind_escalation_rules where is_active),
    'top_absent', coalesce((select jsonb_agg(x) from (select jsonb_build_object('id', s.id, 'name', s.full_name, 'n', count(*)) x
       from public.ind_attendance_records r join public.ind_attendance_sessions ss on ss.id = r.session_id join public.students s on s.id = r.student_id
       where ss.year_id = yr group by s.id, s.full_name order by count(*) desc, s.full_name limit 5) t), '[]'::jsonb),
    'top_late', coalesce((select jsonb_agg(x) from (select jsonb_build_object('id', s.id, 'name', s.full_name, 'n', count(*), 'minutes', sum(l.minutes)) x
       from public.ind_lateness_records l join public.students s on s.id = l.student_id
       where l.year_id = yr and l.voided_at is null group by s.id, s.full_name order by count(*) desc, s.full_name limit 5) t), '[]'::jsonb));
end $f$;

-- =====================================================================
-- دوال الخادم لدالة الحافة ind-notify (service_role فقط)
-- =====================================================================
create or replace function public.ind_svc_claim(p_limit int default 20) returns jsonb language plpgsql security definer set search_path = '' as $f$
declare res jsonb;
begin
  with c as (
    update public.ind_notifications n set status = 'sending', attempts = attempts + 1, updated_at = now()
    where n.id in (select id from public.ind_notifications where status = 'queued' order by created_at limit least(greatest(p_limit, 1), 100) for update skip locked)
    returning n.*)
  select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'vars', c.vars, 'phone', g.phone,
    'template', jsonb_build_object('body', t.body, 'wa_template', t.wa_template, 'wa_lang', t.wa_lang, 'wa_params', t.wa_params))) into res
  from c left join public.guardians g on g.id = c.guardian_id join public.ind_notification_templates t on t.code = c.template_code;
  return coalesce(res, '[]'::jsonb);
end $f$;

create or replace function public.ind_svc_result(p_id uuid, p_status text, p_body text default null, p_provider_id text default null, p_error text default null) returns void language plpgsql security definer set search_path = '' as $f$
begin
  if p_status not in ('sent','failed','queued','no_phone') then raise exception 'bad_request'; end if;
  update public.ind_notifications set status = p_status, body = coalesce(p_body, body), provider_message_id = coalesce(p_provider_id, provider_message_id),
    error = p_error, sent_at = case when p_status = 'sent' then now() else sent_at end, updated_at = now() where id = p_id;
  insert into public.ind_notification_events (notification_id, status, detail) values (p_id, p_status, jsonb_build_object('provider_id', p_provider_id, 'error', p_error));
end $f$;

-- تحديث الحالة من Webhook واتساب (delivered/read/failed). لا تتراجع الحالة إلى الخلف.
create or replace function public.ind_svc_status(p_provider_id text, p_status text, p_detail jsonb default null) returns void language plpgsql security definer set search_path = '' as $f$
declare n record; rank jsonb := '{"sending":0,"sent":1,"delivered":2,"read":3,"failed":4}';
begin
  select * into n from public.ind_notifications where provider_message_id = p_provider_id; if not found then return; end if;
  if p_status not in ('sent','delivered','read','failed') then return; end if;
  if p_status = 'failed' or coalesce((rank->>p_status)::int, 0) > coalesce((rank->>n.status)::int, 0) then
    update public.ind_notifications set status = p_status, error = case when p_status = 'failed' then coalesce(p_detail->>'error', 'failed') else error end, updated_at = now() where id = n.id;
  end if;
  insert into public.ind_notification_events (notification_id, status, detail) values (n.id, p_status, p_detail);
end $f$;

-- مرفقات العذر: يطّلع عليها المنسق وشؤون الطلاب فقط (تُستخدم في سياسة التخزين)
create or replace function public.ind_can_view_excuse_files() returns boolean language sql stable security definer set search_path = '' as $f$
  select public.ind_can_oversee() $f$;

-- =====================================================================
-- RLS والمنح
-- =====================================================================
do $$ declare t text; begin
  foreach t in array array['ind_guardian_links','ind_excuses','ind_excuse_attachments','ind_notification_templates','ind_notifications',
    'ind_notification_events','ind_escalation_rules','ind_escalation_records'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop; end $$;

do $$ declare f text; begin
  -- الواجهة (منسوب مسجل)
  foreach f in array array['public.ind_guardian_link(uuid)', 'public.ind_excuses_list(text, date, date)', 'public.ind_excuse_files(uuid)',
    'public.ind_excuse_review(uuid, text, text, boolean)', 'public.ind_student_file(uuid)', 'public.ind_notice_candidates(date, text, uuid[], text)',
    'public.ind_queue_absence_notices(date, uuid[])', 'public.ind_notifications_list(text, text, date, integer)', 'public.ind_notification_cancel(uuid)',
    'public.ind_notification_retry(uuid)', 'public.ind_templates_list()', 'public.ind_template_save(text, text, text, text, text[], boolean)',
    'public.ind_set_notification_settings(jsonb)', 'public.ind_set_excuse_settings(jsonb)', 'public.ind_escalation_rules_list()',
    'public.ind_escalation_rule_save(uuid, text, integer, text, text, boolean, boolean)', 'public.ind_escalations_list(text)',
    'public.ind_escalation_print(uuid)', 'public.ind_dashboard_extra()', 'public.ind_settings_get()', 'public.ind_can_view_excuse_files()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- بوابة ولي الأمر (بالرمز، دون حساب)
  foreach f in array array['public.ind_g_portal(text)', 'public.ind_g_submit_excuse(text, date, text, text, text[], uuid)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
  -- داخلية وخادمية فقط
  foreach f in array array['public.ind_hash(text)', 'public.ind_new_link(uuid, uuid)', 'public.ind_link_by_token(text)', 'public.ind_primary_guardian(uuid)',
    'public.ind_enqueue(uuid, text, text, jsonb, text, boolean)', 'public.ind_absence_count(uuid, text, text)', 'public.ind_escalate(uuid)',
    'public.ind_trg_attendance_escalate()', 'public.ind_trg_lateness_notify()', 'public.ind_svc_link_student(text)', 'public.ind_svc_claim(integer)',
    'public.ind_svc_result(uuid, text, text, text, text)', 'public.ind_svc_status(text, text, jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    foreach f in array array['public.ind_svc_link_student(text)', 'public.ind_svc_claim(integer)', 'public.ind_svc_result(uuid, text, text, text, text)', 'public.ind_svc_status(text, text, jsonb)'] loop
      execute format('grant execute on function %s to service_role', f);
    end loop;
  end if;
end $$;

-- حاوية خاصة لمرفقات الأعذار (Supabase Storage). الرفع عبر دالة الحافة فقط، والاطلاع للمنسق وشؤون الطلاب.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('ind-excuses', 'ind-excuses', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
    on conflict (id) do nothing;
    execute 'drop policy if exists ind_excuses_read on storage.objects';
    execute $p$create policy ind_excuses_read on storage.objects for select to authenticated using (bucket_id = 'ind-excuses' and public.ind_can_view_excuse_files())$p$;
  end if;
end $$;
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
commit;
