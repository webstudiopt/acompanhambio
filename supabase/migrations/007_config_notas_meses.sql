-- Execute uma vez no SQL Editor. Guarda uma descrição por mês na tela de
-- Estimativa (ex: de onde vem o dinheiro), como JSON
-- { "2027-10": "venda do carro" }.
alter table config add column if not exists notas_meses jsonb not null default '{}'::jsonb;
