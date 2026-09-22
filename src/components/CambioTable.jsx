import { useMemo, useState } from 'react'
import CambioForm from './CambioForm'

function alocacoesLabel(cambio, categorias) {
  const alocacoes = cambio.cambio_alocacoes ?? []
  if (alocacoes.length === 0) return 'Sem categoria'

  const nomeById = Object.fromEntries(categorias.map((c) => [c.id, c.nome]))
  const alocado = alocacoes.reduce((sum, a) => sum + Number(a.valor_euros), 0)
  const restante = Number(cambio.valor_euros) - alocado

  const partes = alocacoes.map((a) => `${nomeById[a.categoria_id] ?? '—'}: €${Number(a.valor_euros).toFixed(2)}`)
  if (restante > 0.004) partes.push(`Sem categoria: €${restante.toFixed(2)}`)
  return partes.join(' · ')
}

export default function CambioTable({ cambios, categorias, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [filtroData, setFiltroData] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroObs, setFiltroObs] = useState('')

  const cambiosFiltrados = useMemo(() => {
    return cambios.filter((c) => {
      if (filtroData && !c.data.includes(filtroData)) return false

      if (filtroCategoria) {
        const idsAlocados = (c.cambio_alocacoes ?? []).map((a) => a.categoria_id)
        if (filtroCategoria === '__sem_categoria__') {
          const alocado = (c.cambio_alocacoes ?? []).reduce((sum, a) => sum + Number(a.valor_euros), 0)
          if (idsAlocados.length > 0 && Math.abs(Number(c.valor_euros) - alocado) < 0.004) return false
        } else if (!idsAlocados.includes(filtroCategoria)) {
          return false
        }
      }

      if (filtroObs && !(c.observacao ?? '').toLowerCase().includes(filtroObs.toLowerCase())) return false

      return true
    })
  }, [cambios, filtroData, filtroCategoria, filtroObs])

  if (cambios.length === 0) {
    return <p className="empty-state">Nenhum câmbio lançado ainda.</p>
  }

  return (
    <div className="table-wrapper">
      <table className="cambio-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Categorias</th>
            <th>R$</th>
            <th>€</th>
            <th>Taxa</th>
            <th>Obs.</th>
            <th></th>
          </tr>
          <tr className="filter-row">
            <th>
              <input
                type="text"
                placeholder="filtrar (aaaa-mm-dd)"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
              />
            </th>
            <th>
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                <option value="">Todas</option>
                <option value="__sem_categoria__">Sem categoria</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </th>
            <th></th>
            <th></th>
            <th></th>
            <th>
              <input
                type="text"
                placeholder="filtrar"
                value={filtroObs}
                onChange={(e) => setFiltroObs(e.target.value)}
              />
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cambiosFiltrados.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-state">
                Nenhum lançamento bate com o filtro.
              </td>
            </tr>
          )}
          {cambiosFiltrados.map((c) =>
            editingId === c.id ? (
              <tr key={c.id}>
                <td colSpan={7}>
                  <CambioForm
                    categorias={categorias}
                    initial={{
                      data: c.data,
                      valor_reais: c.valor_reais,
                      valor_euros: c.valor_euros,
                      observacao: c.observacao ?? '',
                    }}
                    initialAlocacoes={(c.cambio_alocacoes ?? []).map((a) => ({
                      categoria_id: a.categoria_id,
                      valor_euros: a.valor_euros,
                    }))}
                    onSubmit={(values, alocacoes) => {
                      onUpdate(c.id, values, alocacoes)
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </td>
              </tr>
            ) : (
              <tr key={c.id}>
                <td>{c.data}</td>
                <td>{alocacoesLabel(c, categorias)}</td>
                <td>{c.valor_reais != null ? Number(c.valor_reais).toFixed(2) : '—'}</td>
                <td>{Number(c.valor_euros).toFixed(2)}</td>
                <td>{c.taxa_efetiva != null ? Number(c.taxa_efetiva).toFixed(4) : '—'}</td>
                <td>{c.observacao}</td>
                <td className="row-actions">
                  <button onClick={() => setEditingId(c.id)}>Editar</button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (window.confirm('Apagar este lançamento?')) onDelete(c.id)
                    }}
                  >
                    Apagar
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}
