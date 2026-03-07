create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  is_private boolean not null default true,
  allow_expansion boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table if not exists drivers (
  id text primary key,
  code text not null,
  number int not null,
  full_name text not null,
  team_name text not null
);

create table if not exists race_weekends (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  round int not null,
  grand_prix text not null,
  qualifying_deadline timestamptz not null,
  sprint_deadline timestamptz not null,
  race_deadline timestamptz not null,
  created_at timestamptz not null default now(),
  unique (season, round)
);

create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  weekend_id uuid not null references race_weekends(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  session_type text not null check (session_type in ('qualifying', 'sprint', 'race')),
  predicted_position int not null,
  driver_id text not null references drivers(id),
  created_at timestamptz not null default now(),
  unique (weekend_id, user_id, session_type, predicted_position)
);

create table if not exists session_results (
  id uuid primary key default gen_random_uuid(),
  weekend_id uuid not null references race_weekends(id) on delete cascade,
  session_type text not null check (session_type in ('qualifying', 'sprint', 'race')),
  driver_id text not null references drivers(id),
  actual_position int not null,
  status text,
  source text not null default 'api.jolpi.ca',
  created_at timestamptz not null default now(),
  unique (weekend_id, session_type, driver_id)
);

create table if not exists score_events (
  id uuid primary key default gen_random_uuid(),
  weekend_id uuid not null references race_weekends(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  session_type text not null check (session_type in ('qualifying', 'sprint', 'race')),
  predicted_position int not null,
  driver_id text not null references drivers(id),
  driver_name text not null,
  actual_position int,
  points int not null,
  penalty_reason text,
  created_at timestamptz not null default now()
);

create or replace view leaderboard_totals as
select
  se.user_id,
  coalesce(p.display_name, left(se.user_id::text, 8)) as display_name,
  coalesce(sum(se.points), 0)::int as total_points
from score_events se
left join profiles p on p.id = se.user_id
group by se.user_id, p.display_name;

create or replace view weekly_breakdown as
select
  se.weekend_id,
  se.user_id,
  se.session_type,
  se.predicted_position,
  se.actual_position,
  se.points,
  se.penalty_reason,
  se.driver_name
from score_events se;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table profiles enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table drivers enable row level security;
alter table race_weekends enable row level security;
alter table picks enable row level security;
alter table session_results enable row level security;
alter table score_events enable row level security;

create policy "profiles read for leaderboard" on profiles
for select to authenticated using (true);

create policy "profiles self update" on profiles
for update using (auth.uid() = id);

create policy "profiles self insert" on profiles
for insert with check (auth.uid() = id);

create policy "leagues readable by authenticated" on leagues
for select to authenticated using (true);

create policy "league_members readable by authenticated" on league_members
for select to authenticated using (true);

create policy "league_members self insert" on league_members
for insert to authenticated with check (auth.uid() = user_id);

create policy "drivers readable" on drivers
for select to authenticated using (true);

create policy "race_weekends readable" on race_weekends
for select to authenticated using (true);

create policy "session_results readable" on session_results
for select to authenticated using (true);

create policy "picks own read" on picks
for select to authenticated using (auth.uid() = user_id);

create policy "picks own insert" on picks
for insert to authenticated with check (auth.uid() = user_id);

create policy "picks own update" on picks
for update to authenticated using (auth.uid() = user_id);

create policy "score read all authenticated" on score_events
for select to authenticated using (true);

insert into drivers (id, code, number, full_name, team_name) values
  ('max_verstappen','VER',1,'Max Verstappen','Red Bull Racing'),
  ('yuki_tsunoda','TSU',22,'Yuki Tsunoda','Red Bull Racing'),
  ('lewis_hamilton','HAM',44,'Lewis Hamilton','Ferrari'),
  ('charles_leclerc','LEC',16,'Charles Leclerc','Ferrari'),
  ('lando_norris','NOR',4,'Lando Norris','McLaren'),
  ('oscar_piastri','PIA',81,'Oscar Piastri','McLaren'),
  ('george_russell','RUS',63,'George Russell','Mercedes'),
  ('kimi_antonelli','ANT',12,'Andrea Kimi Antonelli','Mercedes'),
  ('fernando_alonso','ALO',14,'Fernando Alonso','Aston Martin'),
  ('lance_stroll','STR',18,'Lance Stroll','Aston Martin'),
  ('pierre_gasly','GAS',10,'Pierre Gasly','Alpine'),
  ('jack_doohan','DOO',7,'Jack Doohan','Alpine'),
  ('alexander_albon','ALB',23,'Alex Albon','Williams'),
  ('carlos_sainz','SAI',55,'Carlos Sainz','Williams'),
  ('esteban_ocon','OCO',31,'Esteban Ocon','Haas'),
  ('oliver_bearman','BEA',87,'Oliver Bearman','Haas'),
  ('nico_hulkenberg','HUL',27,'Nico Hulkenberg','Sauber'),
  ('gabriel_bortoleto','BOR',5,'Gabriel Bortoleto','Sauber'),
  ('liam_lawson','LAW',30,'Liam Lawson','Racing Bulls'),
  ('isack_hadjar','HAD',6,'Isack Hadjar','Racing Bulls')
on conflict (id) do update set
  code = excluded.code,
  number = excluded.number,
  full_name = excluded.full_name,
  team_name = excluded.team_name;

insert into leagues(name, invite_code, is_private, allow_expansion)
values ('Friends F1 League', 'FRIENDS10', true, true)
on conflict (invite_code) do nothing;
