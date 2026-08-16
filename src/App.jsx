import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Sesion from './pages/Sesion'
import Admin from './pages/Admin'
import Publico from './pages/Publico'

function RutaProtegida({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Cargando />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RutaAdmin({ children }) {
  const { perfil, loading } = useAuth()
  if (loading) return <Cargando />
  if (!perfil) return <Navigate to="/sesion" replace />
  if (perfil.rol !== 'mesa_directiva' && perfil.rol !== 'secretaria') return <Navigate to="/sesion" replace />
  return children
}

function Cargando() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#1D9E75', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <span style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</span>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/publico" element={<Publico />} />
      <Route path="/sesion" element={<RutaProtegida><Sesion /></RutaProtegida>} />
      <Route path="/admin" element={<RutaAdmin><Admin /></RutaAdmin>} />
      <Route path="*" element={<Navigate to="/sesion" replace />} />
    </Routes>
  )
}
