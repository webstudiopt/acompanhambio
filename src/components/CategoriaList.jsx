import { useState } from 'react'
import CategoriaForm from './CategoriaForm'
import { tipoDaCategoria } from '../lib/metas'

function descricaoValores(c) {
  const acumulado = Number(c.valor_acumulado ?? 0)
  const meta = Math.abs(Number(c.valor_meta))
  const tipo = tipoDaCategoria(c)
  if (tipo === 'despesa') {
    const pago = Math.abs(Math.min(0, acumulado))
    return `despesa — pago €${pago.toFixed(2)} de €${meta.toFixed(2)} (falta pagar €${Math.max(0, meta - pago).toFixed(2)})`
  }
  if (tipo === 'receber') return `a receber — recebido €${acumulado.toFixed(2)} de €${meta.toFixed(2)}`
  return `€${acumulado.toFixed(2)} / meta €${meta.toFixed(2)}`
}

export default function CategoriaList({ categorias, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null)

  if (categorias.length === 0) {
    return <p className="empty-state">Nenhuma categoria cadastrada ainda.</p>
  }

  return (
    <ul className="categoria-list">
      {categorias.map((c) => (
        <li key={c.id}>
          {editingId === c.id ? (
            <CategoriaForm
              initial={{ nome: c.nome, valor_meta: c.valor_meta, a_receber: c.a_receber }}
              onSubmit={(values) => {
                onUpdate(c.id, values)
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className="categoria-row">
              <div>
                <strong>{c.nome}</strong>
                <span> — {descricaoValores(c)}</span>
              </div>
              <div className="row-actions">
                <button onClick={() => setEditingId(c.id)}>Editar</button>
                <button
                  className="danger"
                  onClick={() => {
                    if (window.confirm(`Apagar a categoria "${c.nome}"?`)) onDelete(c.id)
                  }}
                >
                  Apagar
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
