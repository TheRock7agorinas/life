-- Life app: budget tables.
-- Run once in the Supabase SQL editor of your project.
-- Every row belongs to the signed-in user, and row level security makes sure
-- nobody else can read or change it, even with the public anon key.

create table if not exists public.budget_categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income')),
  color text not null,
  icon text not null,
  budget_cents integer not null default 0 check (budget_cents >= 0),
  sort integer not null default 0
);

create table if not exists public.budget_transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  amount_cents integer not null check (amount_cents > 0),
  kind text not null check (kind in ('expense', 'income')),
  category_id uuid not null references public.budget_categories (id),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists budget_transactions_user_date on public.budget_transactions (user_id, date desc);

alter table public.budget_categories enable row level security;
alter table public.budget_transactions enable row level security;

drop policy if exists "own categories" on public.budget_categories;
create policy "own categories" on public.budget_categories
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own transactions" on public.budget_transactions;
create policy "own transactions" on public.budget_transactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Vault: savings inside the budget section.

create table if not exists public.vault_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  salary_cents integer not null default 0 check (salary_cents >= 0),
  goal_cents integer not null default 0 check (goal_cents >= 0),
  starting_cents integer not null default 0 check (starting_cents >= 0)
);

-- amount_cents is positive for money added and negative for money taken out.
create table if not exists public.vault_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  amount_cents integer not null check (amount_cents <> 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists vault_entries_user_date on public.vault_entries (user_id, date desc);

alter table public.vault_settings enable row level security;
alter table public.vault_entries enable row level security;

drop policy if exists "own vault settings" on public.vault_settings;
create policy "own vault settings" on public.vault_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own vault entries" on public.vault_entries;
create policy "own vault entries" on public.vault_entries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Signed-in users may use these tables through the API (the policies above
-- still limit them to their own rows). People who are not signed in get nothing.
grant select, insert, update, delete on
  public.budget_categories, public.budget_transactions, public.vault_settings, public.vault_entries
  to authenticated;
revoke all on
  public.budget_categories, public.budget_transactions, public.vault_settings, public.vault_entries
  from anon;

-- Subscriptions (added 2026-11-23). handled_month is the last month ('YYYY-MM')
-- whose payment was logged or skipped from the app.

create table if not exists public.subscriptions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  amount_cents integer not null check (amount_cents > 0),
  cycle text not null check (cycle in ('monthly', 'yearly')),
  day integer not null check (day between 1 and 31),
  month integer not null check (month between 1 and 12),
  category_id uuid not null references public.budget_categories (id),
  handled_month text not null default '',
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "own subscriptions" on public.subscriptions;
create policy "own subscriptions" on public.subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.subscriptions to authenticated;
revoke all on public.subscriptions from anon;

-- Subscription type (added 2026-11-23): 'home' for household bills (rent,
-- electricity, water, phone), 'life' for personal subscriptions (streaming, cloud).
alter table public.subscriptions
  add column if not exists type text not null default 'life' check (type in ('home', 'life'));
