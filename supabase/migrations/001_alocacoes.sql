-- Execute uma vez no SQL Editor do Supabase, no projeto onde você já rodou
-- o schema.sql original (com cambios.categoria_id).
-- Troca a categoria única por câmbio por alocações (N categorias por câmbio).

alter table cambios drop column if exists categoria_id;

create table cambio_alocacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cambio_id uuid not null references cambios(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete cascade,
  valor_euros numeric(12,2) not null check (valor_euros > 0),
  criado_em timestamptz not null default now()
);

create index on cambio_alocacoes (cambio_id);
create index on cambio_alocacoes (categoria_id);

alter table cambio_alocacoes enable row level security;

create policy "alocacoes_select_own" on cambio_alocacoes for select using (auth.uid() = user_id);
create policy "alocacoes_insert_own" on cambio_alocacoes for insert with check (auth.uid() = user_id);
create policy "alocacoes_update_own" on cambio_alocacoes for update using (auth.uid() = user_id);
create policy "alocacoes_delete_own" on cambio_alocacoes for delete using (auth.uid() = user_id);
