import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { chaveMes, planoMensal, resumoMetas } from '../lib/metas'

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export default function Estimativa() {
  const navigate = useNavigate()
  const [dataMeta, setDataMeta] = useState('')
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [outliers, setOutliers] = useState({})
  const [notas, setNotas] = useState({})
  const [editandoOutlier, setEditandoOutlier] = useState(null)
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [cambios, setCambios] = useState([])
  const [alocacoes, setAlocacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    const [configRes, categoriasRes, cambiosRes, alocacoesRes] = await Promise.all([
      supabase.from('config').select('*').maybeSingle(),
      supabase.from('categorias').select('*'),
      supabase.from('cambios').select('data, valor_reais, valor_euros, taxa_efetiva'),
      supabase.from('cambio_alocacoes').select('categoria_id, valor_euros'),
    ])
    if (configRes.error) setError(configRes.error.message)
    else {
      setDataMeta(configRes.data?.data_meta ?? '')
      setOutliers(configRes.data?.outliers ?? {})
      setNotas(configRes.data?.notas_meses ?? {})
    }
    if (categoriasRes.error) setError(categoriasRes.error.message)
    else setCategorias(categoriasRes.data)
    if (cambiosRes.error) setError(cambiosRes.error.message)
    else setCambios(cambiosRes.data)
    if (alocacoesRes.error) setError(alocacoesRes.error.message)
    else setAlocacoes(alocacoesRes.data)
    setLoading(false)
    setEditandoMeta(!configRes.data?.data_meta)
  }

  useEffect(() => {
    load()
  }, [])

  async function salvarConfig(campos) {
    setError(null)
    const { data: existing } = await supabase.from('config').select('user_id').maybeSingle()
    const { error } = existing
      ? await supabase.from('config').update(campos).eq('user_id', existing.user_id)
      : await supabase.from('config').insert(campos)
    if (error) {
      setError(error.message)
      return false
    }
    return true
  }

  async function salvarMeta(valor) {
    if (await salvarConfig({ data_meta: valor })) {
      setDataMeta(valor)
      setEditandoMeta(false)
    }
  }

  // Salva o valor customizado e a descrição do mês (ex: "venda do carro").
  // Campo vazio remove. Só manda as notas se mudaram.
  async function salvarMes(chave, valor, nota) {
    const novosOutliers = { ...outliers }
    if (valor == null) delete novosOutliers[chave]
    else novosOutliers[chave] = valor
    const novasNotas = { ...notas }
    if (nota) novasNotas[chave] = nota
    else delete novasNotas[chave]
    const campos = { outliers: novosOutliers }
    if ((notas[chave] ?? '') !== (nota ?? '')) campos.notas_meses = novasNotas
    if (await salvarConfig(campos)) {
      setOutliers(novosOutliers)
      setNotas(novasNotas)
      setEditandoOutlier(null)
    }
  }

  if (loading) return <div className="page">Carregando...</div>

  const resumo = resumoMetas(categorias, cambios, alocacoes)
  const falta = Math.max(0, resumo.falta)
  // Média simples: soma da taxa_efetiva de cada lançamento dividida pela
  // quantidade de lançamentos com taxa calculada.
  const taxasValidas = cambios.filter((c) => c.taxa_efetiva != null).map((c) => Number(c.taxa_efetiva))
  const taxaMedia = taxasValidas.length > 0 ? taxasValidas.reduce((sum, t) => sum + t, 0) / taxasValidas.length : null

  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth()

  const { meses, mesesRestantes, cambiosPorMes, valorPorMes, semCobertura, somaOutliers, mesesComOutlier } =
    planoMensal({ falta, cambios, outliers, dataMeta, hoje })

  const reaisPorMes = {}
  cambios.forEach((c) => {
    if (c.valor_reais == null) return
    const chave = c.data.slice(0, 7)
    reaisPorMes[chave] = (reaisPorMes[chave] || 0) + Number(c.valor_reais)
  })

  // Meses anteriores ao atual (histórico), só pra visualização — não entram
  // em nenhuma conta do plano futuro.
  let mesesAnteriores = []
  if (mostrarAnteriores) {
    const menorData = cambios.reduce((min, c) => (min === null || c.data < min ? c.data : min), null)
    if (menorData) {
      const anoInicio = Number(menorData.slice(0, 4))
      const mesInicio = Number(menorData.slice(5, 7)) - 1
      const totalMesAtual = anoAtual * 12 + mesAtual
      let cursor = anoInicio * 12 + mesInicio
      while (cursor < totalMesAtual) {
        const ano = Math.floor(cursor / 12)
        const mes = cursor % 12
        mesesAnteriores.push({ ano, mes, chave: chaveMes(ano, mes) })
        cursor += 1
      }
    }
  }

  // "Recalcular": apaga os valores customizados dos meses ainda não lançados,
  // pra que o que falta seja dividido igualmente entre eles. Meses já lançados
  // e meses com descrição (entrada planejada, ex: venda do carro) ficam.
  const mesesNaoLancados = meses.filter((m) => !((cambiosPorMes[m.chave] ?? 0) > 0))
  const mesesPlanejados = mesesNaoLancados.filter((m) => outliers[m.chave] != null && notas[m.chave])
  const outliersPendentes = mesesNaoLancados.filter((m) => outliers[m.chave] != null && !notas[m.chave])
  const somaPlanejados = mesesPlanejados.reduce((sum, m) => sum + Number(outliers[m.chave]), 0)
  const mesesParaDividir = mesesNaoLancados.length - mesesPlanejados.length
  const valorRecalculado = mesesParaDividir > 0 ? Math.max(0, falta - somaPlanejados) / mesesParaDividir : 0

  async function recalcularEstimativa() {
    const mantidos =
      mesesPlanejados.length > 0
        ? ` Mantém ${mesesPlanejados.map((m) => `${MESES[m.mes]}/${m.ano} (${notas[m.chave]})`).join(', ')}.`
        : ''
    if (
      !window.confirm(
        `Apagar o valor customizado de ${outliersPendentes.length} mês(es) ainda não lançado(s) e dividir o que falta igualmente: €${valorRecalculado.toFixed(2)} por mês?${mantidos}`
      )
    ) {
      return
    }
    const novo = { ...outliers }
    outliersPendentes.forEach((m) => delete novo[m.chave])
    if (await salvarConfig({ outliers: novo })) setOutliers(novo)
  }

  function irParaCambio(ano, mes, chave, jaFeito) {
    if (jaFeito) {
      navigate('/cambios')
      return
    }
    const valorSugerido = outliers[chave] != null ? Number(outliers[chave]) : valorPorMes
    const dia = ano === anoAtual && mes === mesAtual ? hoje.getDate() : 1
    const dataSugerida = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    navigate('/cambios', {
      state: { prefill: { data: dataSugerida, valor_euros: valorSugerido ? valorSugerido.toFixed(2) : '' } },
    })
  }

  return (
    <div className="page">
      <h1>Estimativa</h1>
      {error && <p className="error-text">{error}</p>}

      <div className="dashboard-summary">
        <div className="summary-card">
          <span className="summary-label">Falta juntar</span>
          <span className="summary-value">€{falta.toFixed(2)}</span>
          {resumo.aReceber > 0.004 && (
            <span className="summary-sub">já descontando €{resumo.aReceber.toFixed(2)} a receber</span>
          )}
        </div>
        <div className="summary-card">
          <span className="summary-label">Meses restantes</span>
          <span className="summary-value">{dataMeta ? Math.max(mesesRestantes, 0) : '—'}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Sugestão / mês</span>
          <span className="summary-value">{meses.length > 0 ? `€${valorPorMes.toFixed(2)}` : '—'}</span>
          {meses.length > 0 && taxaMedia != null && (
            <span className="summary-sub">≈ R${(valorPorMes * taxaMedia).toFixed(2)}</span>
          )}
        </div>
      </div>

      {meses.length > 0 && taxaMedia != null && (
        <p className="empty-state">Baseado no câmbio médio até agora (~{taxaMedia.toFixed(4)}).</p>
      )}
      {semCobertura > 0.004 && (
        <p className="error-text">
          Com os valores customizados ainda ficam faltando €{semCobertura.toFixed(2)} — aumente algum mês do plano ou
          recalcule.
        </p>
      )}
      {mesesComOutlier > 0 && (
        <p className="empty-state">
          {mesesComOutlier} mês(es) com valor customizado (€{somaOutliers.toFixed(2)} no total) — a sugestão acima já
          foi recalculada só com os demais meses.
        </p>
      )}
      {outliersPendentes.length > 0 && (
        <button type="button" className="secondary" onClick={recalcularEstimativa}>
          Recalcular estimativa (€{valorRecalculado.toFixed(2)}/mês nos {mesesParaDividir} meses faltantes)
        </button>
      )}

      <div className="form">
        {!editandoMeta ? (
          <div className="categoria-row">
            <span>
              Viagem: <strong>{MESES[Number(dataMeta.split('-')[1]) - 1]} de {dataMeta.split('-')[0]}</strong>
              {meses.length > 0 && (
                <>
                  {' '}
                  · dinheiro completo até{' '}
                  <strong>
                    {MESES[meses[meses.length - 1].mes]} de {meses[meses.length - 1].ano}
                  </strong>
                </>
              )}
            </span>
            <button type="button" className="secondary" onClick={() => setEditandoMeta(true)}>
              Alterar
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const mes = e.target.mes.value
              if (mes) salvarMeta(`${mes}-01`)
            }}
          >
            <label>
              Mês/ano da viagem
              <input name="mes" type="month" defaultValue={dataMeta ? dataMeta.slice(0, 7) : ''} required />
            </label>
            <div className="form-actions">
              <button type="submit">Salvar meta</button>
              {dataMeta && (
                <button type="button" className="secondary" onClick={() => setEditandoMeta(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {dataMeta && mesesRestantes <= 0 && (
        <p className="error-text">A data-meta já passou ou é o mês atual sem sobrar tempo — ajuste a meta acima.</p>
      )}
      {dataMeta && mesesRestantes > 240 && (
        <p className="error-text">Data-meta muito distante, confira se o mês/ano estão corretos.</p>
      )}

      {(meses.length > 0 || cambios.length > 0) && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={mostrarAnteriores}
            onChange={(e) => setMostrarAnteriores(e.target.checked)}
          />
          Mostrar meses anteriores
        </label>
      )}

      {mostrarAnteriores && mesesAnteriores.length > 0 && (
        <>
          <h2>Meses anteriores</h2>
          <ul className="categoria-list">
            {mesesAnteriores.map(({ ano, mes, chave }) => {
              const valor = cambiosPorMes[chave] ?? 0
              const reais = reaisPorMes[chave]
              return (
                <li key={chave}>
                  <div className="categoria-row">
                    <span>{MESES[mes]} de {ano}</span>
                    <span className="mes-valor mes-valor-feito">
                      €{valor.toFixed(2)}
                      {reais != null && <span className="mes-valor-reais"> (R${reais.toFixed(2)})</span>}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {meses.length > 0 && (
        <>
          <h2>Plano mês a mês</h2>
          <ul className="categoria-list">
            {meses.map(({ ano, mes, chave }) => {
              const jaFeito = (cambiosPorMes[chave] ?? 0) > 0
              const outlier = outliers[chave]
              const valorMes = jaFeito ? cambiosPorMes[chave] : outlier != null ? Number(outlier) : valorPorMes

              return (
                <li key={chave}>
                  <div className="categoria-row">
                    <label className="checkbox-label mes-label">
                      <input
                        type="checkbox"
                        checked={jaFeito}
                        readOnly
                        onClick={() => irParaCambio(ano, mes, chave, jaFeito)}
                      />
                      <span>
                        {MESES[mes]} de {ano}
                        {jaFeito && ` — já lançado (€${cambiosPorMes[chave].toFixed(2)})`}
                        {notas[chave] && editandoOutlier !== chave && <span className="mes-nota">{notas[chave]}</span>}
                      </span>
                    </label>

                    {editandoOutlier === chave ? (
                      <form
                        className="outlier-form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const v = e.target.valor.value
                          salvarMes(chave, v === '' ? null : Number(v), e.target.nota.value.trim())
                        }}
                      >
                        <input
                          name="valor"
                          type="number"
                          step="0.01"
                          autoFocus
                          defaultValue={outlier ?? ''}
                          placeholder="€ nesse mês"
                        />
                        <input
                          name="nota"
                          className="outlier-nota"
                          maxLength={80}
                          defaultValue={notas[chave] ?? ''}
                          placeholder="de onde vem? (ex: venda do carro)"
                        />
                        <button type="submit">OK</button>
                        <button type="button" className="secondary" onClick={() => setEditandoOutlier(null)}>
                          x
                        </button>
                      </form>
                    ) : jaFeito ? (
                      <span className="mes-valor mes-valor-feito">
                        €{valorMes.toFixed(2)}
                        {taxaMedia != null && <span className="mes-valor-reais"> (≈R${(valorMes * taxaMedia).toFixed(2)})</span>}
                      </span>
                    ) : (
                      <button type="button" className="secondary mes-valor" onClick={() => setEditandoOutlier(chave)}>
                        €{valorMes.toFixed(2)}
                        {taxaMedia != null && <span className="mes-valor-reais"> (≈R${(valorMes * taxaMedia).toFixed(2)})</span>}
                        {outlier != null ? <span className="mes-valor-outlier"> ★</span> : <span className="mes-valor-edit"> ✎</span>}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
