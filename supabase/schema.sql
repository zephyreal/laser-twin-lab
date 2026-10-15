-- Apply once to a new, dedicated Supabase project.
create table public.twin_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 student_id text unique not null check (student_id ~ '^[a-z0-9_-]{3,32}$'),
 display_name text not null check (length(display_name) between 1 and 40),
 class_name text not null default '' check (length(class_name)<=40),
 role text not null default 'student' check (role in ('student','teacher')),
 created_at timestamptz not null default now()
);
create table public.twin_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.twin_profiles(id) on delete cascade,
 state jsonb not null,
 score jsonb,
 status text not null default 'active' check (status in ('active','submitted','abandoned')),
 version integer not null default 0,
 last_request_id text,
 created_at timestamptz not null default now(),
 submitted_at timestamptz
);
create index twin_attempts_user_created on public.twin_attempts(user_id,created_at desc);
create index twin_attempts_status_created on public.twin_attempts(status,created_at desc);
create unique index twin_one_active_attempt on public.twin_attempts(user_id) where status='active';
alter table public.twin_profiles enable row level security;
alter table public.twin_attempts enable row level security;
revoke all on public.twin_profiles,public.twin_attempts from anon,authenticated;
grant select on public.twin_profiles,public.twin_attempts to authenticated;
grant all on public.twin_profiles,public.twin_attempts to service_role;
create policy twin_profile_self_read on public.twin_profiles for select to authenticated using ((select auth.uid())=id);
create policy twin_attempt_self_read on public.twin_attempts for select to authenticated using ((select auth.uid())=user_id);
-- No public write policies. State and scoring writes are performed only by
-- the authenticated Edge Function, which verifies ownership and teacher role.
