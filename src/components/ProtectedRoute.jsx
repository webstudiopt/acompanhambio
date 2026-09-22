import { Navigate, Outlet } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'

export default function ProtectedRoute() {
  const { session, loading } = useAuthContext()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
