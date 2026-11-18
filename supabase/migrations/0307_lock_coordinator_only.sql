-- =====================================================================
-- انضباطي · 0307 · التثبيت من صلاحيات منسق الغياب وحده.
-- مدخل بيانات الغياب (تكليف absence) يحضّر ويحفظ فقط، ولا يثبّت.
-- قابل لإعادة التنفيذ. لا يغيّر الجداول.
-- =====================================================================

create or replace function public.ind_lock(p_day date, p_scope text default 'list', p_sections uuid[] default null, p_grade text default null, p_include_unsaved boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.ind_me(); sec uuid; secs uuid[]; done uuid[] := '{}'; skipped uuid[] := '{}'; already uuid[] := '{}'; was_unlocked boolean;
begin
  if me is null then return public.ind_deny('lock'); end if;
  -- التثبيت للمنسق (أو مدير النواة) فقط؛ المحاولة من غيره تُرفض وتُسجَّل
  if not public.ind_is_coord() then return public.ind_deny('lock', jsonb_build_object('day', p_day)); end if;
  if p_scope not in ('list','grade','all') then raise exception 'bad_request'; end if;
  if p_day > public.ind_today() then raise exception 'date_future'; end if;
  secs := public.ind_resolve_sections(p_sections, p_scope, p_grade);
  if cardinality(secs) = 0 then raise exception 'no_sections'; end if;
  foreach sec in array secs loop
    perform 1 from public.class_sections where id = sec for update;
    if exists (select 1 from public.ind_attendance_locks where section_id = sec and day = p_day and is_locked) then already := already || sec; continue; end if;
    if not exists (select 1 from public.ind_attendance_sessions where section_id = sec and day = p_day) then
      if not p_include_unsaved then skipped := skipped || sec; continue; end if;
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
  return jsonb_build_object('locked', to_jsonb(done), 'already', to_jsonb(already), 'skipped_unsaved', to_jsonb(skipped), 'not_assigned', '[]'::jsonb);
end $f$;
