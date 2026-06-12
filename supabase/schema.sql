create extension if not exists pgcrypto;

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  parent_name text,
  child_name text not null,
  child_age int check (child_age is null or child_age between 0 and 18),
  school_name text,
  school_website_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.ingested_messages (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references public.children(id) on delete set null,
  source_type text not null check (
    source_type in ('pasted_email', 'newsletter', 'lunch_menu', 'forwarded_email', 'demo')
  ),
  subject text,
  sender text,
  raw_text text not null check (char_length(raw_text) <= 12000),
  processed_at timestamptz not null default now(),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references public.children(id) on delete set null,
  message_id uuid references public.ingested_messages(id) on delete set null,
  title text not null,
  date date,
  start_time text,
  end_time text,
  location text,
  category text not null default 'other',
  description text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references public.children(id) on delete set null,
  message_id uuid references public.ingested_messages(id) on delete set null,
  title text not null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'done')),
  cost text,
  notes text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now()
);

create index if not exists ingested_messages_child_id_idx on public.ingested_messages(child_id);
create index if not exists events_child_date_idx on public.events(child_id, date);
create index if not exists tasks_child_due_date_idx on public.tasks(child_id, due_date);
create index if not exists tasks_status_idx on public.tasks(status);

alter table public.children enable row level security;
alter table public.ingested_messages enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;

-- This MVP writes through the server-side service role only. Add user-scoped
-- RLS policies before exposing direct browser access in production.
