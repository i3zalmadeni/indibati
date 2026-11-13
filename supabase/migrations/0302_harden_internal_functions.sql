-- انضباطي · 0302 · إغلاق الدوال الداخلية أمام الاستدعاء المباشر من الواجهة (ملاحظات Supabase Advisor)
-- هذه الدوال تُستدعى من داخل دوال ind_* (SECURITY DEFINER) فقط، فلا تحتاج منح authenticated.
-- أهمها ind_section_students: كانت تتيح لأي منسوب قراءة أسماء طلاب أي فصل مباشرة، وind_deny: كانت تتيح كتابة سجلات وهمية.
alter function public.ind_audit_immutable() set search_path = '';
do $$ declare f text; begin
  foreach f in array array[
    'public.ind_section_students(uuid, date)', 'public.ind_deny(text, jsonb)', 'public.ind_check_day(uuid, date)',
    'public.ind_resolve_sections(uuid[], text, text)', 'public.ind_setting(text)', 'public.ind_assigned(uuid, text)',
    'public.ind_has(text)', 'public.ind_me()', 'public.ind_is_admin()', 'public.ind_is_coord()', 'public.ind_can_oversee()',
    'public.ind_current_year()', 'public.ind_late_minutes(time)', 'public.ind_today()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop; end $$;
