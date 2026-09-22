import { useState } from 'react'
import CategoriaForm from './CategoriaForm'

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
              initial={{ nome: c.nome, valor_meta: c.valor_meta }}
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
                <span>
                  {' '}
                  — €{Number(c.valor_acumulado ?? 0).toFixed(2)} / meta €{Number(c.valor_meta).toFixed(2)}
                </span>
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
