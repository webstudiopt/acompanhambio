// Regras de meta compartilhadas entre Dashboard e Estimativa.
//
// Cada categoria é de um de três tipos:
// - Economia (meta > 0): dinheiro que precisa ESTAR na conta até a viagem
//   (ex: comprovação financeira).
// - Despesa (meta < 0): só conta o que ainda falta pagar — o que já foi pago
//   saiu do saldo e não precisa ser juntado de novo (ex: curso).
// - A receber (a_receber = true): dinheiro que vai entrar sem você juntar
//   (ex: empréstimo voltando). Não é meta; desconta do "falta juntar".

export function acumuladoDaCategoria(categoriaId, alocacoes) {
  return alocacoes.filter((a) => a.categoria_id === categoriaId).reduce((sum, a) => sum + Number(a.valor_euros), 0)
}

export function tipoDaCategoria(categoria) {
  if (categoria.a_receber) return 'receber'
  return Number(categoria.valor_meta) < 0 ? 'despesa' : 'economia'
}

export function resumoMetas(categorias, cambios, alocacoes) {
  const saldo = cambios.reduce((sum, c) => sum + Number(c.valor_euros), 0)

  let economia = 0
  let despesasAPagar = 0
  let aReceber = 0
  for (const cat of categorias) {
    const meta = Number(cat.valor_meta)
    const acumulado = acumuladoDaCategoria(cat.id, alocacoes)
    const tipo = tipoDaCategoria(cat)
    if (tipo === 'receber') aReceber += Math.max(0, Math.abs(meta) - acumulado)
    else if (tipo === 'despesa') despesasAPagar += Math.max(0, Math.abs(meta) - Math.abs(Math.min(0, acumulado)))
    else economia += meta
  }

  // Quanto precisa ter na conta até a viagem: o que fica guardado + o que
  // ainda vai ser pago.
  const precisaTer = economia + despesasAPagar
  const falta = precisaTer - saldo - aReceber

  return { saldo, economia, despesasAPagar, aReceber, precisaTer, falta }
}

export function chaveMes(ano, mes) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}`
}

// Plano de depósitos mês a mês, do mês atual até o mês ANTERIOR à viagem
// (o dinheiro precisa estar completo antes de embarcar).
//
// Meses já lançados (câmbio real feito) ou com valor customizado ("outlier")
// saem da divisão igualitária. `falta` já desconta tudo que foi realmente
// juntado (inclusive nos meses já lançados), então só precisamos tirar do
// total pendente os outliers futuros ainda não lançados — por isso o plano
// se recalcula sozinho conforme você loga os câmbios reais mês a mês.
export function planoMensal({ falta, cambios, outliers, dataMeta, hoje = new Date() }) {
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth()

  const cambiosPorMes = {}
  cambios.forEach((c) => {
    const chave = c.data.slice(0, 7)
    cambiosPorMes[chave] = (cambiosPorMes[chave] || 0) + Number(c.valor_euros)
  })

  const meses = []
  let mesesRestantes = 0
  if (dataMeta) {
    const [anoMeta, mesMetaStr] = dataMeta.split('-')
    mesesRestantes = (Number(anoMeta) - anoAtual) * 12 + (Number(mesMetaStr) - 1 - mesAtual)
    if (mesesRestantes > 0 && mesesRestantes <= 240) {
      for (let i = 0; i < mesesRestantes; i++) {
        const totalMes = mesAtual + i
        const ano = anoAtual + Math.floor(totalMes / 12)
        const mes = totalMes % 12
        meses.push({ ano, mes, chave: chaveMes(ano, mes) })
      }
    }
  }

  const jaFeito = (chave) => (cambiosPorMes[chave] ?? 0) > 0
  const mesesPendentes = meses.filter((m) => !jaFeito(m.chave) && outliers[m.chave] == null).length
  const somaOutliersFuturos = meses.reduce(
    (sum, m) => (!jaFeito(m.chave) && outliers[m.chave] != null ? sum + Number(outliers[m.chave]) : sum),
    0
  )
  const outliersNoRange = Object.entries(outliers).filter(([chave]) => meses.some((m) => m.chave === chave))
  const faltaRestante = Math.max(0, falta - somaOutliersFuturos)
  const valorPorMes = mesesPendentes > 0 ? faltaRestante / mesesPendentes : 0
  // Todos os meses têm valor fixo e mesmo assim não fecha a conta.
  const semCobertura = mesesPendentes === 0 && meses.length > 0 ? faltaRestante : 0

  return {
    meses,
    mesesRestantes,
    cambiosPorMes,
    valorPorMes,
    semCobertura,
    somaOutliers: outliersNoRange.reduce((sum, [, v]) => sum + Number(v), 0),
    mesesComOutlier: outliersNoRange.length,
  }
}
