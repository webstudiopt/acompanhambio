import { useState } from 'react'
import { tipoDaCategoria } from '../lib/metas'

function toFormValues(initial) {
  if (!initial) return { nome: '', valor_meta: '', tipo: 'economia' }
  const meta = Number(initial.valor_meta) || 0
  return { nome: initial.nome, valor_meta: Math.abs(meta) || '', tipo: tipoDaCategoria(initial) }
}

export default function CategoriaForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(toFormValues(initial))

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const sinal = form.tipo === 'despesa' ? -1 : 1
    onSubmit({
      nome: form.nome,
      valor_meta: (Number(form.valor_meta) || 0) * sinal,
      a_receber: form.tipo === 'receber',
    })
    if (!initial) setForm(toFormValues())
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Nome
        <input name="nome" value={form.nome} onChange={handleChange} required />
      </label>
      <label>
        Tipo
        <select name="tipo" value={form.tipo} onChange={handleChange}>
          <option value="economia">Economia — precisa estar na conta (ex: comprovação)</option>
          <option value="despesa">Despesa a pagar — some conforme você paga (ex: curso)</option>
          <option value="receber">A receber — vai entrar sem você juntar (ex: empréstimo)</option>
        </select>
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
