-- Execute uma vez no SQL Editor. Permite lançar um câmbio (geralmente uma
-- retirada) sem informar o valor em reais, quando a movimentação foi direto
-- em euro (ex: pagamento saindo do saldo da Wise sem conversão de R$).
alter table cambios alter column valor_reais drop not null;
