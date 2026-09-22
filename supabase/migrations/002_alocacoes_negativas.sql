-- Execute uma vez no SQL Editor. Permite alocações negativas (retirada de
-- valor de uma categoria específica), mantendo proibido só o valor zero.
alter table cambio_alocacoes drop constraint if exists cambio_alocacoes_valor_euros_check;
alter table cambio_alocacoes add constraint cambio_alocacoes_valor_euros_check check (valor_euros <> 0);
