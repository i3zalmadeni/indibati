-- نسخة هيكلية مصغّرة من جداول النواة الرقمية لاختبار ترحيلات انضباطي محلياً فقط.
-- الأعمدة مطابقة لقاعدة labeedsch_PC (فُحصت 2026-11-13). لا تُنفَّذ على أي قاعدة حقيقية.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
-- محاكاة auth.uid(): تقرأ المستخدم من إعداد الجلسة كما يفعل Supabase
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;

create table public.academic_years (id uuid primary key default gen_random_uuid(), name text unique, starts_on date, ends_on date, status text, closed_at timestamptz, created_at timestamptz default now());
create table public.grade_levels (code text primary key, name_ar text, sort_order int, is_active boolean default true);
create table public.class_sections (id uuid primary key default gen_random_uuid(), year_id uuid references public.academic_years, grade_code text references public.grade_levels, name text, capacity int, is_active boolean default true, created_at timestamptz default now());
create table public.students (id uuid primary key default gen_random_uuid(), student_no text unique, full_name text, study_status text, enrollment_type text, first_enrolled_on date, exit_on date, exit_note text, birth_date date, nationality text, source_type text, created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.student_enrollments (id uuid primary key default gen_random_uuid(), student_id uuid references public.students, year_id uuid references public.academic_years, grade_code text, section_id uuid references public.class_sections, status text, started_on date, ended_on date, note text, created_at timestamptz default now(), updated_at timestamptz default now(), unique (student_id, year_id));
create table public.staff_members (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, category text, job_title text, specialty text, qualification text, account_status text, joined_on date, source_type text, created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now(), employment_status text, department text, photo_path text, is_active boolean default true, publish_public boolean default false, public_photo_path text);
create table public.staff_roles (id uuid primary key default gen_random_uuid(), staff_id uuid references public.staff_members, role_code text, system_code text, started_on date, ended_on date);
create table public.guardians (id uuid primary key default gen_random_uuid(), full_name text, phone text, phone_alt text, email text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.student_guardians (student_id uuid references public.students, guardian_id uuid references public.guardians, relation text, is_primary boolean, primary key (student_id, guardian_id));

create or replace function public.is_core_admin() returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.staff_members s join public.staff_roles r on r.staff_id = s.id
    where s.user_id = auth.uid() and r.role_code in ('core_admin','principal') and r.ended_on is null and s.is_active) $$;

alter table public.students enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.class_sections enable row level security;
alter table public.staff_members enable row level security;
grant usage on schema public to authenticated, anon;
create table public.systems (code text primary key, name_ar text, description text, status text check (status in ('planned','connected','suspended')), api_key_hash text, last_seen_at timestamptz, created_at timestamptz default now(), scopes text[]);
create table public.permissions (code text primary key, system_code text references public.systems, level text check (level in ('view','add','edit','approve')), name_ar text);
