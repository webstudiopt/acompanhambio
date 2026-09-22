# Prompt para Claude Code — App de Controle Financeiro do Intercâmbio

## Contexto
Web app simples para acompanhar a organização financeira de um intercâmbio. O objetivo é registrar quanto preciso juntar por categoria de gasto (passagem, hospedagem, alimentação, curso etc.), e mensalmente lançar quanto fiz de câmbio (R$ → €) para acompanhar quanto já tenho acumulado em euros e quanto falta pra bater a meta.

## Stack
- Frontend: React (Vite)
- Backend/DB: Supabase (Postgres + Auth)
- Auth: Supabase Auth, email/senha simples, login único (uso pessoal, não precisa multi-usuário nem roles)
- Deploy: Vercel ou Netlify (sugerir o mais simples de configurar com Supabase)

## Modelo de dados (Supabase)

**categorias**
- id
- nome (ex: Passagem, Hospedagem, Alimentação, Curso)
- valor_meta (numeric — quanto preciso juntar nessa categoria, em euros)
- criado_em

**cambios** (um lançamento por mês, ou mais de um se fizer câmbio mais de uma vez no mês)
- id
- data (date)
- categoria_id (FK, opcional — nulo = câmbio geral não alocado a uma categoria específica)
- valor_reais (numeric — quanto saiu em R$)
- valor_euros (numeric — quanto entrou em €)
- taxa_efetiva (calculado: valor_reais / valor_euros, ou salvo direto)
- observacao (text, opcional)
- criado_em

## Funcionalidades (MVP)

1. **Login simples** (Supabase Auth, email/senha)
2. **Gerenciar categorias**: criar, editar, excluir categoria com valor_meta em euros
3. **Lançar câmbio**: formulário com data, valor em reais, valor recebido em euros, categoria (opcional), observação
4. **Dashboard principal**:
   - Total acumulado em euros (soma de todos os câmbios)
   - Meta total (soma de valor_meta de todas as categorias)
   - Progresso geral (% da meta total já alcançada)
   - Progresso por categoria (barra de progresso: acumulado na categoria vs meta da categoria)
5. **Histórico de câmbio**: lista/tabela dos lançamentos, ordenada por data, mostrando taxa efetiva obtida em cada um — permite ver se a taxa está melhorando ou piorando ao longo do tempo
6. **Câmbio médio geral**: taxa média ponderada (total reais / total euros) exibida no dashboard

## Fluxo de telas
- `/login` — login simples
- `/dashboard` — visão geral: progresso total, progresso por categoria, câmbio médio
- `/categorias` — CRUD de categorias
- `/cambios` — CRUD de lançamentos + histórico/tabela

## Requisitos técnicos
- Responsivo (uso principal deve ser mobile, mas funcional em desktop)
- Sem overengineering — não precisa de testes automatizados, CI/CD, nem arquitetura complexa. Prioridade é funcionar rápido e ser fácil de mexer depois
- Reaproveitar padrão de auth/estrutura já usado no projeto "Régua" (React + Supabase) se possível, pra manter consistência entre os projetos

## Fora do escopo do MVP (não implementar agora)
- Multi-usuário / múltiplos intercâmbios simultâneos
- Notificações/alertas automáticos
- Exportação de dados
- Integração com API de cotação em tempo real (o valor do câmbio é sempre inserido manualmente, porque reflete o que foi de fato pago numa corretora/exchange)
