import { NavLink } from 'react-router-dom'
import { useAuthContext } from '../hooks/AuthContext'
import { useTheme } from '../hooks/useTheme'

export default function NavBar() {
  const { signOut } = useAuthContext()
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="navbar">
      <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
        Dashboard
      </NavLink>
      <NavLink to="/categorias" className={({ isActive }) => (isActive ? 'active' : '')}>
        Categorias
      </NavLink>
      <NavLink to="/cambios" className={({ isActive }) => (isActive ? 'active' : '')}>
        Câmbios
      </NavLink>
      <NavLink to="/estimativa" className={({ isActive }) => (isActive ? 'active' : '')}>
        Estimativa
      </NavLink>
      <button
        type="button"
        className="navbar-theme"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      >
        {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
      </button>
      <button className="navbar-logout" onClick={signOut}>
        Sair
      </button>
    </nav>
  )
}
