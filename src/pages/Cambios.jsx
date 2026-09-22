import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import CambioForm from '../components/CambioForm'
import CambioTable from '../components/CambioTable'

export default function Cambios() {
  const location = useLocation()
  const prefill = location.state?.prefill
  const [cambios, setCambios] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    const [cambiosRes, categoriasRes] = await Promise.all([
      supabase
        .from('cambios')
        .select('*, cambio_alocacoes(id, categoria_id, valor_euros)')
        .order('data', { ascending: false }),
      supabase.from('categorias').select('*').order('nome', { ascending: true }),
    ])
    if (cambiosRes.error) setError(cambiosRes.error.message)
    else setCambios(cambiosRes.data)
    if (categoriasRes.error) setError(categoriasRes.error.message)
    else setCategorias(categoriasRes.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function saveAlocacoes(cambioId, alocacoes) {
    if (alocacoes.length === 0) return null
    const { error } = await supabase
      .from('cambio_alocacoes')
      .insert(alocacoes.map((a) => ({ cambio_id: cambioId, ...a })))
    return error
  }

  async function handleCreate(values, alocacoes) {
    const { data, error } = await supabase.from('cambios').insert(values).select().single()
    if (error) return setError(error.message)
    const alocError = await saveAlocacoes(data.id, alocacoes)
    if (alocError) setError(alocError.message)
    else load()
  }

  async function handleUpdate(id, values, alocacoes) {
    const { error } = await supabase.from('cambios').update(values).eq('id', id)
    if (error) return setError(error.message)

    const { error: deleteError } = await supabase.from('cambio_alocacoes').delete().eq('cambio_id', id)
    if (deleteError) return setError(deleteError.message)

    const alocError = await saveAlocacoes(id, alocacoes)
    if (alocError) setError(alocError.message)
    else load()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('cambios').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div className="page page-cambios">
      <h1>Câmbios</h1>
      {error && <p className="error-text">{error}</p>}
      <CambioForm categorias={categorias} onSubmit={handleCreate} prefill={prefill} />
      {loading ? (
        <p>Carregando...</p>
      ) : (
        <CambioTable cambios={cambios} categorias={categorias} onUpdate={handleUpdate} onDelete={handleDelete} />
      )}
    </div>
  )
}
