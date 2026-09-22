-- Full schema for a fresh Supabase project. If you already ran the previous
-- version of this file, use supabase/migrations/001_alocacoes.sql instead.

create table categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  valor_meta numeric(12,2) not null default 0,
  criado_em timestamptz not null default now()
);

create table cambios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  valor_reais numeric(12,2),
  valor_euros numeric(12,2) not null,
  taxa_efetiva numeric(12,6) generated always as (
    case when valor_euros = 0 then null else valor_reais / valor_euros end
  ) stored,
  observacao text,
  criado_em timestamptz not null default now()
);

-- Um câmbio pode ser dividido entre várias categorias (ex: €150 recebidos,
-- €100 para "Curso" e €50 para "Passagem"). A parte não alocada em nenhuma
-- linha aqui continua contando no total geral, mas não em nenhuma categoria.
create table cambio_alocacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cambio_id uuid not null references cambios(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete cascade,
  valor_euros numeric(12,2) not null check (valor_euros <> 0),
  criado_em timestamptz not null default now()
);

-- Data-meta do intercâmbio, usada na tela de Estimativa (uma linha por usuário).
create table config (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data_meta date,
  -- Valores customizados por mês na tela de Estimativa, ex: { "2027-12": 5000 }.
  outliers jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index on cambios (user_id, data);
create index on cambio_alocacoes (cambio_id);
create index on cambio_alocacoes (categoria_id);

alter table categorias enable row level security;
alter table cambios enable row level security;
alter table cambio_alocacoes enable row level security;
alter table config enable row level security;

create policy "categorias_select_own" on categorias for select using (auth.uid() = user_id);
create policy "categorias_insert_own" on categorias for insert with check (auth.uid() = user_id);
create policy "categorias_update_own" on categorias for update using (auth.uid() = user_id);
create policy "categorias_delete_own" on categorias for delete using (auth.uid() = user_id);

create policy "cambios_select_own" on cambios for select using (auth.uid() = user_id);
create policy "cambios_insert_own" on cambios for insert with check (auth.uid() = user_id);
create policy "cambios_update_own" on cambios for update using (auth.uid() = user_id);
create policy "cambios_delete_own" on cambios for delete using (auth.uid() = user_id);

create policy "alocacoes_select_own" on cambio_alocacoes for select using (auth.uid() = user_id);
create policy "alocacoes_insert_own" on cambio_alocacoes for insert with check (auth.uid() = user_id);
create policy "alocacoes_update_own" on cambio_alocacoes for update using (auth.uid() = user_id);
create policy "alocacoes_delete_own" on cambio_alocacoes for delete using (auth.uid() = user_id);

create policy "config_select_own" on config for select using (auth.uid() = user_id);
create policy "config_insert_own" on config for insert with check (auth.uid() = user_id);
create policy "config_update_own" on config for update using (auth.uid() = user_id);
