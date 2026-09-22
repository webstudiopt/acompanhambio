import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

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

function chaveMes(ano, mes) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}`
}

export default function Estimativa() {
  const navigate = useNavigate()
  const [dataMeta, setDataMeta] = useState('')
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [outliers, setOutliers] = useState({})
  const [editandoOutlier, setEditandoOutlier] = useState(null)
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [cambios, setCambios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    const [configRes, categoriasRes, cambiosRes] = await Promise.all([
      supabase.from('config').select('data_meta, outliers').maybeSingle(),
      supabase.from('categorias').select('valor_meta'),
      supabase.from('cambios').select('data, valor_reais, valor_euros, taxa_efetiva'),
    ])
    if (configRes.error) setError(configRes.error.message)
    else {
      setDataMeta(configRes.data?.data_meta ?? '')
      setOutliers(configRes.data?.outliers ?? {})
    }
    if (categoriasRes.error) setError(categoriasRes.error.message)
    else setCategorias(categoriasRes.data)
    if (cambiosRes.error) setError(cambiosRes.error.message)
    else setCambios(cambiosRes.data)
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

  async function salvarOutlier(chave, valor) {
    const novo = { ...outliers }
    if (valor == null) delete novo[chave]
    else novo[chave] = valor
    if (await salvarConfig({ outliers: novo })) {
      setOutliers(novo)
      setEditandoOutlier(null)
    }
  }

  if (loading) return <div className="page">Carregando...</div>

  const totalEuros = cambios.reduce((sum, c) => sum + Number(c.valor_euros), 0)
  const metaTotal = categorias.reduce((sum, c) => sum + Number(c.valor_meta), 0)
  const falta = Math.max(0, metaTotal - totalEuros)
  // Média simples: soma da taxa_efetiva de cada lançamento dividida pela
  // quantidade de lançamentos com taxa calculada.
  const taxasValidas = cambios.filter((c) => c.taxa_efetiva != null).map((c) => Number(c.taxa_efetiva))
  const taxaMedia = taxasValidas.length > 0 ? taxasValidas.reduce((sum, t) => sum + t, 0) / taxasValidas.length : null

  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth()

  let meses = []
  let mesesRestantes = 0

  if (dataMeta) {
    const [anoMeta, mesMetaStr] = dataMeta.split('-')
    const anoMetaNum = Number(anoMeta)
    const mesMetaNum = Number(mesMetaStr) - 1

    mesesRestantes = (anoMetaNum - anoAtual) * 12 + (mesMetaNum - mesAtual) + 1

    if (mesesRestantes > 0 && mesesRestantes <= 240) {
      for (let i = 0; i < mesesRestantes; i++) {
        const totalMes = mesAtual + i
        const ano = anoAtual + Math.floor(totalMes / 12)
        const mes = totalMes % 12
        meses.push({ ano, mes, chave: chaveMes(ano, mes) })
      }
    }
  }

  const cambiosPorMes = {}
  const reaisPorMes = {}
  cambios.forEach((c) => {
    const chave = c.data.slice(0, 7)
    cambiosPorMes[chave] = (cambiosPorMes[chave] || 0) + Number(c.valor_euros)
    if (c.valor_reais != null) reaisPorMes[chave] = (reaisPorMes[chave] || 0) + Number(c.valor_reais)
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

  // Meses já lançados (câmbio real feito) ou com valor customizado ("outlier")
  // saem da divisão igualitária. "falta" já desconta tudo que foi realmente
  // juntado (inclusive nos meses já lançados), então só precisamos tirar do
  // total pendente os outliers futuros ainda não lançados — por isso o plano
  // se recalcula sozinho conforme você loga os câmbios reais mês a mês.
  const mesesComValorFixo = meses.filter((m) => (cambiosPorMes[m.chave] ?? 0) > 0 || outliers[m.chave] != null)
  const mesesPendentes = meses.length - mesesComValorFixo.length
  const somaOutliersFuturos = meses.reduce((sum, m) => {
    const jaFeito = (cambiosPorMes[m.chave] ?? 0) > 0
    if (!jaFeito && outliers[m.chave] != null) return sum + Number(outliers[m.chave])
    return sum
  }, 0)
  const outliersNoRange = Object.entries(outliers).filter(([chave]) => meses.some((m) => m.chave === chave))
  const somaOutliers = outliersNoRange.reduce((sum, [, v]) => sum + Number(v), 0)
  const mesesComOutlier = outliersNoRange.length
  const faltaRestante = Math.max(0, falta - somaOutliersFuturos)
  const valorPorMes = mesesPendentes > 0 ? faltaRestante / mesesPendentes : 0

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
      {mesesComOutlier > 0 && (
        <p className="empty-state">
          {mesesComOutlier} mês(es) com valor customizado (€{somaOutliers.toFixed(2)} no total) — a sugestão acima já
          foi recalculada só com os demais meses.
        </p>
      )}

      <div className="form">
        {!editandoMeta ? (
          <div className="categoria-row">
            <span>
              Meta: <strong>{MESES[Number(dataMeta.split('-')[1]) - 1]} de {dataMeta.split('-')[0]}</strong>
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
              Mês/ano da meta final
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
                      </span>
                    </label>

                    {editandoOutlier === chave ? (
                      <form
                        className="outlier-form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const v = e.target.valor.value
                          salvarOutlier(chave, v === '' ? null : Number(v))
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
