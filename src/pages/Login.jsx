import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setCargando(true)
    setError('')
    const { error } = await login(email, password)
    if (error) {
      setError('Correo o contraseña incorrectos')
      setCargando(false)
    } else {
      navigate('/sesion')
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>🏛️</div>
        <h1 style={s.title}>Consejo de Juventud</h1>
        <p style={s.subtitle}>Inicia sesión con tu cuenta</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tucorreo@email.com"
              required
              style={s.input}
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={s.input}
            />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" disabled={cargando} style={s.btn}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div style={s.publicLink}>
          <a href="/publico" style={s.link}>Ver sesión como visitante →</a>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E1F5EE 0%, #f0fdf4 100%)', padding: 16 },
  card: { background: '#fff', borderRadius: 16, padding: '40px 32px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 700, textAlign: 'center', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 28 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151' },
  input: { padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', transition: 'border-color 0.2s' },
  error: { background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13 },
  btn: { padding: '12px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  publicLink: { textAlign: 'center', marginTop: 20 },
  link: { fontSize: 13, color: '#1D9E75', textDecoration: 'none' },
}
