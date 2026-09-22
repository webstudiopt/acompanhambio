import { useState } from 'react'

export default function AllocateForm({ onAllocate, onRemove }) {
  const [valor, setValor] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function executar(acao) {
    const v = Number(valor)
    if (!v || v <= 0) return
    setSubmitting(true)
    await acao(v)
    setValor('')
    setSubmitting(false)
  }

  return (
    <form
      className="allocate-form"
      onSubmit={(e) => {
        e.preventDefault()
        executar(onAllocate)
      }}
    >
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="€ valor"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <button type="submit" disabled={submitting}>
        Alocar
      </button>
      <button type="button" className="danger" disabled={submitting} onClick={() => executar(onRemove)}>
        Remover
      </button>
    </form>
  )
}
