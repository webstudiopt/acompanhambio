-- Execute uma vez no SQL Editor. Guarda a data-meta do intercâmbio (uma
-- linha por usuário) usada na tela de Estimativa.
create table config (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data_meta date,
  criado_em timestamptz not null default now()
);

alter table config enable row level security;

create policy "config_select_own" on config for select using (auth.uid() = user_id);
create policy "config_insert_own" on config for insert with check (auth.uid() = user_id);
create policy "config_update_own" on config for update using (auth.uid() = user_id);
