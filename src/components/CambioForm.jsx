import { useState } from 'react'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function toFormValues(initial, prefill) {
  if (!initial) {
    return {
      data: prefill?.data ?? today(),
      valor_reais: '',
      valor_euros: prefill?.valor_euros ?? '',
      observacao: '',
      retirada: false,
    }
  }
  const retirada = Number(initial.valor_reais) < 0 || Number(initial.valor_euros) < 0
  return {
    data: initial.data,
    valor_reais: Math.abs(Number(initial.valor_reais) || 0) || '',
    valor_euros: Math.abs(Number(initial.valor_euros) || 0) || '',
    observacao: initial.observacao ?? '',
    retirada,
  }
}

function toAlocacoes(initial) {
  return initial?.length ? initial.map((a) => ({ ...a, valor_euros: Math.abs(Number(a.valor_euros)) })) : []
}

export default function CambioForm({ categorias, initial, initialAlocacoes, prefill, onSubmit, onCancel }) {
  const [form, setForm] = useState(toFormValues(initial, prefill))
  const [alocacoes, setAlocacoes] = useState(toAlocacoes(initialAlocacoes))

  const sinal = form.retirada ? -1 : 1
  const totalEuros = (Number(form.valor_euros) || 0) * sinal
  const alocado = alocacoes.reduce((sum, a) => sum + (Number(a.valor_euros) || 0), 0) * sinal
  const restante = totalEuros - alocado

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  function addAlocacao() {
    if (categorias.length === 0) return
    setAlocacoes((a) => [...a, { categoria_id: categorias[0].id, valor_euros: '' }])
  }

  function updateAlocacao(index, field, value) {
    setAlocacoes((a) => a.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  function removeAlocacao(index) {
    setAlocacoes((a) => a.filter((_, i) => i !== index))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const cleanAlocacoes = alocacoes
      .map((a) => ({ categoria_id: a.categoria_id, valor_euros: (Number(a.valor_euros) || 0) * sinal }))
      .filter((a) => a.categoria_id && a.valor_euros !== 0)

    onSubmit(
      {
        data: form.data,
        valor_reais: form.valor_reais === '' ? null : Number(form.valor_reais) * sinal,
        valor_euros: (Number(form.valor_euros) || 0) * sinal,
        observacao: form.observacao || null,
      },
      cleanAlocacoes
    )
    if (!initial) {
      setForm(toFormValues())
      setAlocacoes([])
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Data
        <input name="data" type="date" value={form.data} onChange={handleChange} required />
      </label>
      <label className="checkbox-label">
        <input name="retirada" type="checkbox" checked={form.retirada} onChange={handleChange} />
        Retirada (tirar valor do total, não somar)
      </label>
      <label>
        Valor em R$ (opcional — deixe em branco se pagou direto em €)
        <input
          name="valor_reais"
          type="number"
          step="0.01"
          min="0"
          value={form.valor_reais}
          onChange={handleChange}
        />
      </label>
      <label>
        Valor em €
        <input
          name="valor_euros"
          type="number"
          step="0.01"
          min="0"
          value={form.valor_euros}
          onChange={handleChange}
          required
        />
      </label>
      <label>
        Observação
        <textarea name="observacao" value={form.observacao ?? ''} onChange={handleChange} rows={2} />
      </label>

      <div className="alocacoes">
        <div className="alocacoes-header">
          <span>Distribuir entre categorias (opcional)</span>
          <button type="button" className="secondary" onClick={addAlocacao} disabled={categorias.length === 0}>
            + categoria
          </button>
        </div>

        {alocacoes.map((a, i) => (
          <div className="alocacao-row" key={i}>
            <select value={a.categoria_id} onChange={(e) => updateAlocacao(i, 'categoria_id', e.target.value)}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="€"
              value={a.valor_euros}
              onChange={(e) => updateAlocacao(i, 'valor_euros', e.target.value)}
            />
            <button type="button" className="danger" onClick={() => removeAlocacao(i)}>
              ×
            </button>
          </div>
        ))}

        <p className="alocacoes-summary">
          Alocado: €{alocado.toFixed(2)} · Sem categoria: €{restante.toFixed(2)}
          {Math.abs(alocado) > Math.abs(totalEuros) && (
            <span className="error-text"> — soma maior que o total do câmbio</span>
          )}
        </p>
      </div>

      <div className="form-actions">
        <button type="submit">{initial ? 'Salvar' : 'Lançar câmbio'}</button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
