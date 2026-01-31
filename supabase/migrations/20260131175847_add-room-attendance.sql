create table public.room_attendance (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  attendance_date date not null,
  start_time text not null,
  end_time text not null,
  room_number text,
  building_id text,
  building_name text,
  user_token text not null,
  created_at timestamptz not null default now(),
  constraint room_attendance_positive_times check (length(start_time) = 5 and length(end_time) = 5)
);
 
-- Avoid duplicate “I’m coming” entries for the same person/block.
create unique index room_attendance_unique_user_block
  on public.room_attendance (room_id, attendance_date, start_time, end_time, user_token);
 
-- Speed up snapshot lookups by room/date.
create index room_attendance_room_date_idx
  on public.room_attendance (room_id, attendance_date);