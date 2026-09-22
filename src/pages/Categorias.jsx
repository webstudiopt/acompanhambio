import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import CategoriaForm from '../components/CategoriaForm'
import CategoriaList from '../components/CategoriaList'

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [alocacoes, setAlocacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    const [categoriasRes, alocacoesRes] = await Promise.all([
      supabase.from('categorias').select('*').order('criado_em', { ascending: true }),
      supabase.from('cambio_alocacoes').select('categoria_id, valor_euros'),
    ])
    if (categoriasRes.error) setError(categoriasRes.error.message)
    else setCategorias(categoriasRes.data)
    if (alocacoesRes.error) setError(alocacoesRes.error.message)
    else setAlocacoes(alocacoesRes.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(values) {
    const { error } = await supabase.from('categorias').insert(values)
    if (error) setError(error.message)
    else load()
  }

  async function handleUpdate(id, values) {
    const { error } = await supabase.from('categorias').update(values).eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const categoriasComTotal = categorias
    .map((c) => {
      const valor_acumulado = alocacoes
        .filter((a) => a.categoria_id === c.id)
        .reduce((sum, a) => sum + Number(a.valor_euros), 0)
      const meta = Number(c.valor_meta)
      // Meta positiva = economia (completa ao atingir); meta negativa = despesa
      // a pagar (completa ao acumulado chegar tão negativo quanto a meta).
      const completa = meta !== 0 && (meta > 0 ? valor_acumulado >= meta : valor_acumulado <= meta)
      return { ...c, valor_acumulado, completa }
    })
    // Completas vão pro fim; entre as demais, da maior magnitude de meta pra menor.
    .sort((a, b) => {
      if (a.completa !== b.completa) return a.completa ? 1 : -1
      return Math.abs(Number(b.valor_meta)) - Math.abs(Number(a.valor_meta))
    })

  return (
    <div className="page">
      <h1>Categorias</h1>
      {error && <p className="error-text">{error}</p>}
      <CategoriaForm onSubmit={handleCreate} />
      {loading ? (
        <p>Carregando...</p>
      ) : (
        <CategoriaList categorias={categoriasComTotal} onUpdate={handleUpdate} onDelete={handleDelete} />
      )}
    </div>
  )
}
