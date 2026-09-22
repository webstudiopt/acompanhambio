-- Execute uma vez no SQL Editor. Guarda valores customizados por mês na tela
-- de Estimativa (ex: "em dezembro sei que consigo +5000"), como JSON
-- { "2027-12": 5000 }.
alter table config add column if not exists outliers jsonb not null default '{}'::jsonb;
