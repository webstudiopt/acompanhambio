import { useState } from 'react'

function toFormValues(initial) {
  if (!initial) return { nome: '', valor_meta: '', despesa: false }
  const meta = Number(initial.valor_meta) || 0
  return { nome: initial.nome, valor_meta: Math.abs(meta) || '', despesa: meta < 0 }
}

export default function CategoriaForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(toFormValues(initial))

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const sinal = form.despesa ? -1 : 1
    onSubmit({ nome: form.nome, valor_meta: (Number(form.valor_meta) || 0) * sinal })
    if (!initial) setForm(toFormValues())
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Nome
        <input name="nome" value={form.nome} onChange={handleChange} required />
      </label>
      <label className="checkbox-label">
        <input name="despesa" type="checkbox" checked={form.despesa} onChange={handleChange} />
        Despesa a pagar (meta negativa, some conforme você paga)
      </label>
      <label>
        Meta (€)
        <input
          name="valor_meta"
          type="number"
          step="0.01"
          min="0"
          value={form.valor_meta}
          onChange={handleChange}
          required
        />
      </label>
      <div className="form-actions">
        <button type="submit">{initial ? 'Salvar' : 'Adicionar categoria'}</button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
