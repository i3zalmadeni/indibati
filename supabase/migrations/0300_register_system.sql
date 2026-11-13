-- انضباطي · 0300 · تسجيل النظام في سجل أنظمة النواة الرقمية وصلاحياته (بيانات فقط، دون أي تعديل على بنية جداول النواة).
-- قابل لإعادة التنفيذ. يجعل النظام ظاهراً في «إعدادات النواة والتكامل» وفي نافذة الأدوار والصلاحيات.
insert into public.systems (code, name_ar, description, status, scopes)
values ('indibati', 'نظام انضباطي', 'الحضور والغياب والتأخر والانضباط المدرسي', 'connected',
        array['school:read','staff:read','students:read','identity:verify','changes:read'])
on conflict (code) do nothing;
insert into public.permissions (code, system_code, level, name_ar) values
  ('indibati:view', 'indibati', 'view', 'انضباطي: اطلاع'),
  ('indibati:add', 'indibati', 'add', 'انضباطي: إضافة'),
  ('indibati:edit', 'indibati', 'edit', 'انضباطي: تعديل'),
  ('indibati:approve', 'indibati', 'approve', 'انضباطي: اعتماد')
on conflict (code) do nothing;
