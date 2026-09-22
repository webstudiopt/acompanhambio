import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ProgressBar from '../components/ProgressBar'
import AllocateForm from '../components/AllocateForm'

export default function Dashboard() {
  const [categorias, setCategorias] = useState([])
  const [cambios, setCambios] = useState([])
  const [alocacoes, setAlocacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [ultimaDistribuicao, setUltimaDistribuicao] = useState(null)

  async function load() {
    const [categoriasRes, cambiosRes, alocacoesRes] = await Promise.all([
      supabase.from('categorias').select('*'),
      supabase.from('cambios').select('*'),
      supabase.from('cambio_alocacoes').select('*'),
    ])
    if (categoriasRes.error) setError(categoriasRes.error.message)
    else setCategorias(categoriasRes.data)
    if (cambiosRes.error) setError(cambiosRes.error.message)
    else setCambios(cambiosRes.data)
    if (alocacoesRes.error) setError(alocacoesRes.error.message)
    else setAlocacoes(alocacoesRes.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <div className="page">Carregando...</div>
  if (error && cambios.length === 0) return <div className="page error-text">{error}</div>

  const totalEuros = cambios.reduce((sum, c) => sum + Number(c.valor_euros), 0)
  const metaTotal = categorias.reduce((sum, c) => sum + Number(c.valor_meta), 0)
  const totalAlocado = alocacoes.reduce((sum, a) => sum + Number(a.valor_euros), 0)

  const porCategoria = categorias
    .map((cat) => {
      const acumulado = alocacoes
        .filter((a) => a.categoria_id === cat.id)
        .reduce((sum, a) => sum + Number(a.valor_euros), 0)
      const meta = Number(cat.valor_meta)
      // Meta positiva = economia (completa ao atingir); meta negativa = despesa
      // a pagar (completa ao acumulado chegar tão negativo quanto a meta).
      const completa = meta !== 0 && (meta > 0 ? acumulado >= meta : acumulado <= meta)
      return { ...cat, acumulado, completa }
    })
    // Categorias completas vão pro fim; entre as demais, da maior magnitude de meta pra menor.
    .sort((a, b) => {
      if (a.completa !== b.completa) return a.completa ? 1 : -1
      return Math.abs(Number(b.valor_meta)) - Math.abs(Number(a.valor_meta))
    })

  // Média simples: soma da taxa_efetiva de cada lançamento (que tem reais e
  // euros informados) dividida pela quantidade de lançamentos com taxa.
  const taxasValidas = cambios.filter((c) => c.taxa_efetiva != null).map((c) => Number(c.taxa_efetiva))
  const taxaMedia = taxasValidas.length > 0 ? taxasValidas.reduce((sum, t) => sum + t, 0) / taxasValidas.length : null

  const totalPositivo = cambios.filter((c) => Number(c.valor_euros) > 0).reduce((sum, c) => sum + Number(c.valor_euros), 0)
  const totalNegativo = cambios.filter((c) => Number(c.valor_euros) < 0).reduce((sum, c) => sum + Number(c.valor_euros), 0)
  const alocadoPositivo = alocacoes.filter((a) => Number(a.valor_euros) > 0).reduce((sum, a) => sum + Number(a.valor_euros), 0)
  const alocadoNegativo = alocacoes.filter((a) => Number(a.valor_euros) < 0).reduce((sum, a) => sum + Number(a.valor_euros), 0)
  const semCategoriaNegativo = totalNegativo - alocadoNegativo

  // Teto das categorias de ECONOMIA (meta positiva): a soma alocada nelas não
  // pode passar do saldo líquido atual (totalEuros), não do total bruto
  // depositado. Dinheiro que já saiu da conta (retiradas, tagueadas nas
  // categorias de despesa) não sobra pra também contar numa meta de economia
  // — cada euro só pode estar "guardado" pra uma coisa de cada vez.
  const semCategoriaPositivo = totalEuros - alocadoPositivo

  // "Pool" disponível pra alocar em categorias de economia: sobra de cada
  // câmbio positivo (mais antigos primeiro), limitado pelo teto acima.
  function poolDisponivel() {
    const alocadoPorCambio = {}
    alocacoes.forEach((a) => {
      alocadoPorCambio[a.cambio_id] = (alocadoPorCambio[a.cambio_id] || 0) + Number(a.valor_euros)
    })

    const candidatos = cambios
      .filter((c) => Number(c.valor_euros) > 0)
      .map((c) => ({ id: c.id, sobra: Number(c.valor_euros) - (alocadoPorCambio[c.id] || 0), data: c.data }))
      .filter((c) => c.sobra > 0.004)
      .sort((a, b) => a.data.localeCompare(b.data))

    let tetoGlobal = Math.max(0, semCategoriaPositivo)
    const resultado = []
    for (const c of candidatos) {
      if (tetoGlobal <= 0.004) break
      const disponivel = Math.min(c.sobra, tetoGlobal)
      resultado.push({ ...c, sobra: disponivel })
      tetoGlobal -= disponivel
    }
    return resultado
  }

  // Corrige alocações de economia além do saldo real, removendo o excesso
  // (câmbios mais recentes primeiro) até bater com totalEuros.
  async function corrigirExcessoPositivo() {
    const excesso = alocadoPositivo - totalEuros
    if (excesso <= 0.004) return
    if (
      !window.confirm(
        `Remover €${excesso.toFixed(2)} das categorias de economia (mais recentes primeiro) pra bater com o saldo real da conta?`
      )
    ) {
      return
    }
    setError(null)
    setInfo(null)
    setUltimaDistribuicao(null)

    const positivas = alocacoes
      .filter((a) => Number(a.valor_euros) > 0)
      .map((a) => ({ ...a, data: cambioPorId[a.cambio_id]?.data ?? '' }))
      .sort((a, b) => b.data.localeCompare(a.data))

    let restante = excesso
    const idsParaApagar = []
    const paraAtualizar = []
    for (const a of positivas) {
      if (restante <= 0.004) break
      const valor = Number(a.valor_euros)
      if (valor <= restante + 0.004) {
        idsParaApagar.push(a.id)
        restante -= valor
      } else {
        paraAtualizar.push({ id: a.id, valor_euros: Number((valor - restante).toFixed(2)) })
        restante = 0
      }
    }

    if (idsParaApagar.length > 0) {
      const { error } = await supabase.from('cambio_alocacoes').delete().in('id', idsParaApagar)
      if (error) {
        setError(error.message)
        return
      }
    }
    for (const upd of paraAtualizar) {
      const { error } = await supabase.from('cambio_alocacoes').update({ valor_euros: upd.valor_euros }).eq('id', upd.id)
      if (error) {
        setError(error.message)
        return
      }
    }

    setInfo(`Removido €${(excesso - restante).toFixed(2)} das categorias de economia pra bater com o saldo real.`)
    await load()
  }

  async function alocar(categoriaId, valorSolicitado) {
    setError(null)
    setInfo(null)
    setUltimaDistribuicao(null)
    const disponiveis = poolDisponivel()

    let restante = valorSolicitado
    const novasAlocacoes = []
    for (const c of disponiveis) {
      if (restante <= 0.004) break
      const usar = Math.min(c.sobra, restante)
      novasAlocacoes.push({ cambio_id: c.id, categoria_id: categoriaId, valor_euros: Number(usar.toFixed(2)) })
      restante -= usar
    }

    if (novasAlocacoes.length === 0) {
      setError('Não há valor sem categoria disponível para alocar.')
      return
    }

    const { error } = await supabase.from('cambio_alocacoes').insert(novasAlocacoes)
    if (error) {
      setError(error.message)
      return
    }

    if (restante > 0.004) {
      setInfo(`Alocado parcialmente: faltou €${restante.toFixed(2)} sem categoria disponível.`)
    }

    await load()
  }

  // Remove valor alocado numa categoria (mais recente primeiro), soltando de
  // volta pro "sem categoria". Se a última alocação for maior que o pedido,
  // reduz ela em vez de apagar inteira.
  async function removerValor(categoriaId, valorSolicitado) {
    setError(null)
    setInfo(null)
    setUltimaDistribuicao(null)

    const alocacoesDaCategoria = alocacoes
      .filter((a) => a.categoria_id === categoriaId)
      .map((a) => ({ ...a, data: cambioPorId[a.cambio_id]?.data ?? '' }))
      .sort((a, b) => b.data.localeCompare(a.data))

    let restante = valorSolicitado
    const idsParaApagar = []
    const paraAtualizar = []

    for (const a of alocacoesDaCategoria) {
      if (restante <= 0.004) break
      const magnitude = Math.abs(Number(a.valor_euros))
      if (magnitude <= restante + 0.004) {
        idsParaApagar.push(a.id)
        restante -= magnitude
      } else {
        const sinalA = Number(a.valor_euros) < 0 ? -1 : 1
        paraAtualizar.push({ id: a.id, valor_euros: Number(((magnitude - restante) * sinalA).toFixed(2)) })
        restante = 0
      }
    }

    if (idsParaApagar.length === 0 && paraAtualizar.length === 0) {
      setError('Não há alocação nessa categoria para remover.')
      return
    }

    if (idsParaApagar.length > 0) {
      const { error } = await supabase.from('cambio_alocacoes').delete().in('id', idsParaApagar)
      if (error) {
        setError(error.message)
        return
      }
    }
    for (const upd of paraAtualizar) {
      const { error } = await supabase.from('cambio_alocacoes').update({ valor_euros: upd.valor_euros }).eq('id', upd.id)
      if (error) {
        setError(error.message)
        return
      }
    }

    setInfo(
      restante > 0.004
        ? `Removido parcialmente: só havia €${(valorSolicitado - restante).toFixed(2)} alocado nessa categoria.`
        : `Removido €${valorSolicitado.toFixed(2)} da categoria.`
    )
    await load()
  }

  // Cascata por prioridade: preenche a categoria de maior meta até 100%,
  // depois a próxima maior, e assim por diante, usando o saldo sem categoria.
  async function distribuirPorPrioridade() {
    setError(null)
    setInfo(null)

    const prioridades = categorias
      .map((cat) => {
        const acumulado = alocacoes
          .filter((a) => a.categoria_id === cat.id)
          .reduce((sum, a) => sum + Number(a.valor_euros), 0)
        return { id: cat.id, nome: cat.nome, gap: Number(cat.valor_meta) - acumulado }
      })
      .filter((c) => c.gap > 0.004)
      .sort((a, b) => b.gap - a.gap)

    if (prioridades.length === 0) {
      setInfo('Todas as categorias já estão com a meta batida.')
      return
    }

    const disponiveis = poolDisponivel()
    if (disponiveis.length === 0) {
      setError('Não há valor sem categoria disponível para distribuir.')
      return
    }

    if (
      !window.confirm(
        `Distribuir €${semCategoriaPositivo.toFixed(2)} sem categoria, priorizando a maior meta em aberto (${prioridades[0].nome}) até completá-la, depois a próxima?`
      )
    ) {
      return
    }

    let cursor = 0 // índice do câmbio atual em `disponiveis`
    let sobraCambio = disponiveis[0]?.sobra ?? 0
    const novasAlocacoes = []
    let distribuidoTotal = 0

    for (const cat of prioridades) {
      let restante = cat.gap
      while (restante > 0.004 && cursor < disponiveis.length) {
        const usar = Math.min(sobraCambio, restante)
        if (usar > 0.004) {
          novasAlocacoes.push({
            cambio_id: disponiveis[cursor].id,
            categoria_id: cat.id,
            valor_euros: Number(usar.toFixed(2)),
          })
          restante -= usar
          sobraCambio -= usar
          distribuidoTotal += usar
        }
        if (sobraCambio <= 0.004) {
          cursor += 1
          sobraCambio = disponiveis[cursor]?.sobra ?? 0
        }
      }
      if (cursor >= disponiveis.length) break
    }

    if (novasAlocacoes.length === 0) {
      setInfo('Nada foi distribuído.')
      return
    }

    const { data, error } = await supabase.from('cambio_alocacoes').insert(novasAlocacoes).select('id')
    if (error) {
      setError(error.message)
      return
    }

    setUltimaDistribuicao(data.map((d) => d.id))
    setInfo(`Distribuído €${distribuidoTotal.toFixed(2)} por prioridade de meta.`)
    await load()
  }

  async function desfazerDistribuicao() {
    if (!ultimaDistribuicao) return
    setError(null)
    const { error } = await supabase.from('cambio_alocacoes').delete().in('id', ultimaDistribuicao)
    if (error) {
      setError(error.message)
      return
    }
    setUltimaDistribuicao(null)
    setInfo('Distribuição desfeita.')
    await load()
  }

  async function removerAlocacao(id) {
    setError(null)
    setInfo(null)
    setUltimaDistribuicao(null)
    const { error } = await supabase.from('cambio_alocacoes').delete().eq('id', id)
    if (error) setError(error.message)
    else await load()
  }

  const cambioPorId = Object.fromEntries(cambios.map((c) => [c.id, c]))

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className="dashboard-summary">
        <div className="summary-card">
          <span className="summary-label">Saldo na Wise</span>
          <span className="summary-value">€{totalEuros.toFixed(2)}</span>
          {totalNegativo < -0.004 && (
            <span className="summary-sub">
              €{totalPositivo.toFixed(2)} depositado − €{Math.abs(totalNegativo).toFixed(2)} retirado
            </span>
          )}
        </div>
        <div className="summary-card">
          <span className="summary-label">Meta total</span>
          <span className="summary-value">€{metaTotal.toFixed(2)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Câmbio médio</span>
          <span className="summary-value">{taxaMedia != null ? taxaMedia.toFixed(4) : '—'}</span>
        </div>
      </div>

      <ProgressBar label="Progresso geral" current={totalEuros} target={metaTotal} />

      <div className="alloc-overview">
        <div className="alloc-overview-title-row">
          <span className="alloc-overview-title">Depósitos — distribuição por categoria</span>
          {semCategoriaPositivo > 0.004 && (
            <button type="button" className="secondary" onClick={distribuirPorPrioridade}>
              Distribuir por prioridade
            </button>
          )}
        </div>
        <div className="alloc-overview-track">
          {totalEuros > 0 && (
            <>
              <div
                className="alloc-overview-fill alocado"
                style={{ width: `${Math.max(0, Math.min(100, (alocadoPositivo / totalEuros) * 100))}%` }}
              />
              {semCategoriaPositivo > 0 && (
                <div
                  className="alloc-overview-fill livre"
                  style={{ width: `${Math.max(0, Math.min(100, (semCategoriaPositivo / totalEuros) * 100))}%` }}
                />
              )}
            </>
          )}
        </div>
        <div className="alloc-overview-legend">
          <span>
            <i className="dot alocado" /> Já alocado: €{alocadoPositivo.toFixed(2)}
          </span>
          {semCategoriaPositivo >= -0.004 ? (
            <span>
              <i className="dot livre" /> Ainda sem categoria: €{semCategoriaPositivo.toFixed(2)}
            </span>
          ) : (
            <span className="error-text">Alocado €{Math.abs(semCategoriaPositivo).toFixed(2)} além do saldo real</span>
          )}
        </div>
        {semCategoriaPositivo < -0.004 && (
          <button type="button" className="secondary" onClick={corrigirExcessoPositivo}>
            Corrigir automaticamente
          </button>
        )}
      </div>

      {totalNegativo < -0.004 && (
        <div className="alloc-overview">
          <div className="alloc-overview-title-row">
            <span className="alloc-overview-title">Retiradas — distribuição por categoria</span>
          </div>
          <div className="alloc-overview-track">
            <div
              className="alloc-overview-fill alocado"
              style={{ width: `${Math.max(0, Math.min(100, (alocadoNegativo / totalNegativo) * 100))}%` }}
            />
            <div
              className="alloc-overview-fill livre"
              style={{ width: `${Math.max(0, Math.min(100, (semCategoriaNegativo / totalNegativo) * 100))}%` }}
            />
          </div>
          <div className="alloc-overview-legend">
            <span>
              <i className="dot alocado" /> Já alocada: €{Math.abs(alocadoNegativo).toFixed(2)}
            </span>
            <span>
              <i className="dot livre" /> Ainda sem categoria: €{Math.abs(semCategoriaNegativo).toFixed(2)}
            </span>
          </div>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      {info && (
        <p className="empty-state">
          {info}
          {ultimaDistribuicao && (
            <button type="button" className="secondary inline-undo" onClick={desfazerDistribuicao}>
              Desfazer
            </button>
          )}
        </p>
      )}

      <h2>Por categoria</h2>
      {porCategoria.length === 0 ? (
        <p className="empty-state">Cadastre categorias para ver o progresso.</p>
      ) : (
        porCategoria.map((cat) => {
          const alocacoesDaCategoria = alocacoes
            .filter((a) => a.categoria_id === cat.id)
            .map((a) => ({ ...a, data: cambioPorId[a.cambio_id]?.data }))
            .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))

          return (
            <div key={cat.id} className="dashboard-categoria">
              <ProgressBar label={cat.nome} current={cat.acumulado} target={Number(cat.valor_meta)} />
              <AllocateForm onAllocate={(valor) => alocar(cat.id, valor)} onRemove={(valor) => removerValor(cat.id, valor)} />
              {alocacoesDaCategoria.length > 0 && (
                <details className="alocacoes-manager">
                  <summary>{alocacoesDaCategoria.length} alocação(ões)</summary>
                  <ul>
                    {alocacoesDaCategoria.map((a) => (
                      <li key={a.id}>
                        <span>
                          {a.data ?? '—'} · €{Number(a.valor_euros).toFixed(2)}
                        </span>
                        <button type="button" className="danger" onClick={() => removerAlocacao(a.id)}>
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
