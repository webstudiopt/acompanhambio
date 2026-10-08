-- Execute uma vez no SQL Editor. Marca categorias de dinheiro "a receber"
-- (ex: empréstimo que vai voltar): não contam como meta a juntar e descontam
-- do "falta juntar" enquanto não entram na conta.
alter table categorias add column if not exists a_receber boolean not null default false;
