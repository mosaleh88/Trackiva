-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Students Table
create table public.students (
  id uuid primary key default uuid_generate_v4(),
  "studentNumber" text unique not null,
  "name_en" text not null,
  "name_ar" text not null,
  gender text not null,
  grade text not null,
  section text not null,
  "busRoute" text,
  "transportMode" text not null,
  "familyId" text,
  "isWatchlisted" boolean default false,
  "parentTelegramChatId" text,
  "parentNotificationPreferences" jsonb
);

-- Users Table
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  role text not null,
  "assignedClasses" jsonb,
  "telegramChatId" text
);

-- Attendance Table
create table public.attendance (
  id uuid primary key default uuid_generate_v4(),
  "studentId" uuid references public.students(id) on delete cascade,
  date text not null, -- YYYY-MM-DD
  period text not null,
  status text not null,
  reason text,
  timestamp bigint not null
);

-- E-Pass Destinations (Config)
create table public.destinations (
  id text primary key,
  "label_en" text not null,
  "label_ar" text not null,
  "iconName" text not null,
  "colorTheme" text not null,
  "maxDuration" integer not null
);

-- E-Passes Table
create table public.epasses (
  id uuid primary key default uuid_generate_v4(),
  "studentId" uuid references public.students(id) on delete cascade,
  "teacherId" uuid references public.users(id) on delete set null,
  type text not null, -- Destination ID or UNAUTHORIZED
  "startTime" bigint not null,
  "endTime" bigint,
  status text not null,
  notes text
);

-- Reception Logs
create table public.reception_logs (
  id uuid primary key default uuid_generate_v4(),
  "studentId" uuid references public.students(id) on delete cascade,
  type text not null, -- LateArrival, EarlyLeave
  timestamp bigint not null,
  reason text,
  "transportConflict" boolean default false,
  "pickupBy" text,
  "pickupId" text
);

-- Clinic Visits
create table public.clinic_visits (
  id uuid primary key default uuid_generate_v4(),
  "studentId" uuid references public.students(id) on delete cascade,
  timestamp bigint not null,
  "dischargeTime" bigint,
  symptom text not null,
  diagnosis text,
  treatment text,
  severity text not null,
  outcome text not null,
  notes text,
  "linkedPassId" uuid references public.epasses(id) on delete set null
);

-- App Settings (Singleton Row)
create table public.settings (
  id integer primary key check (id = 1),
  "maxPassesPerDay" integer default 4,
  "rolePermissions" jsonb,
  "attendanceSettings" jsonb,
  "telegramBotToken" text,
  "telegramChatId" text,
  "earlyLeaveBotToken" text,
  "earlyLeaveChatId" text,
  "attendanceBotToken" text,
  "watchlistBotToken" text,
  "watchlistChatId" text,
  "notificationRules" jsonb
);

-- Insert Default Settings Row
insert into public.settings (id, "maxPassesPerDay", "notificationRules", "attendanceSettings") 
values (
  1, 
  4, 
  '{"UNAUTHORIZED": true}', 
  '{"absentPeriodThreshold": 3, "countAllExcusedAsExcusedDay": true, "alertThresholds": [3, 6, 10, 15]}'
) on conflict (id) do nothing;

-- Enable RLS
alter table public.students enable row level security;
alter table public.users enable row level security;
alter table public.attendance enable row level security;
alter table public.destinations enable row level security;
alter table public.epasses enable row level security;
alter table public.reception_logs enable row level security;
alter table public.clinic_visits enable row level security;
alter table public.settings enable row level security;

-- Create permissive policies for development (Allow All)
-- WARNING: In production, you must replace these with authenticated policies based on User Roles
create policy "Allow all access" on public.students for all using (true);
create policy "Allow all access" on public.users for all using (true);
create policy "Allow all access" on public.attendance for all using (true);
create policy "Allow all access" on public.destinations for all using (true);
create policy "Allow all access" on public.epasses for all using (true);
create policy "Allow all access" on public.reception_logs for all using (true);
create policy "Allow all access" on public.clinic_visits for all using (true);
create policy "Allow all access" on public.settings for all using (true);