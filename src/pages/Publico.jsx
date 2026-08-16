import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Publico() {
  const [sesion, setSesion] = useState(null)
  const [agenda, setAgenda] = useState([])
  const [cola, setCola] = useState([])
  const [votaciones, setVotaciones] = useState([])
  const [presentes, setPresentes] = useState(0)

  useEffect(() => {
    cargar()
    const canal = supabase.channel('publico-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cola_palabra' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votaciones' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  async function cargar() {
    const { data: ses } = await supabase.from('sesiones').select('*').eq('activa', true).single()
    setSesion(ses)
    if (ses) {
      const { data: ag } = await supabase.from('agenda').select('*').eq('sesion_id', ses.id).order('orden')
      setAgenda(ag || [])
      const { data: c } = await supabase.from('cola_palabra').select('*, perfiles(nombre)').eq('sesion_id', ses.id).eq('atendido', false).order('created_at')
      setCola(c || [])
      const { data: v } = await supabase.from('votaciones').select('*').eq('sesion_id', ses.id).order('created_at', { ascending: false })
      setVotaciones(v || [])
      const { count } = await supabase.from('asistencia').select('*', { count: 'exact', head: true }).eq('sesion_id', ses.id).eq('presente', true)
      setPresentes(count || 0)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>🏛️</div>
        <div>
          <div style={s.title}>Consejo Municipal de Juventud</div>
          <div style={s.subtitle}>Vista pública en tiempo real</div>
        </div>
        <a href="/login" style={s.loginLink}>Iniciar sesión →</a>
      </div>

      {!sesion ? (
        <div style={s.noSesion}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Sin sesión activa</div>
          <div style={{ color: '#6b7280', fontSize: 14 }}>No hay ninguna sesión en curso en este momento</div>
        </div>
      ) : (
        <div style={s.content}>
          <div style={s.sesionCard}>
            <div style={s.sesionTitulo}>Sesión {sesion.tipo} N° {sesion.numero}</div>
            <div style={s.sesionSub}>EN CURSO · {presentes} consejeros presentes</div>
          </div>

          {agenda.length > 0 && (
            <div style={s.card}>
              <div style={s.cardTitle}>📄 Orden del Día</div>
              {agenda.map((item, i) => (
                <div key={item.id} style={s.agendaRow}>
                  <span style={s.agendaNum}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.titulo}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{item.tipo}</div>
                  </div>
                  <span style={{ ...s.badge, ...estadoColor(item.estado) }}>{item.estado}</span>
                </div>
              ))}
            </div>
          )}

          {cola.length > 0 && (
            <div style={s.card}>
              <div style={s.cardTitle}>✋ Cola de palabra</div>
              {cola.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < cola.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <span style={{ fontWeight: 800, fontSize: 20, color: i === 0 ? '#2563eb' : '#d1d5db', minWidth: 24 }}>{i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: i === 0 ? 700 : 400 }}>{c.perfiles?.nombre}</span>
                  {i === 0 && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 20 }}>Turno actual</span>}
                </div>
              ))}
            </div>
          )}

          {votaciones.length > 0 && (
            <div style={s.card}>
              <div style={s.cardTitle}>🗳️ Votaciones</div>
              {votaciones.map(v => {
                const total = v.si + v.no + v.abstencion
                return (
                  <div key={v.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{v.titulo}</div>
                      <span style={{ ...s.badge, ...estadoColor(v.estado) }}>{v.estado}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div style={{ textAlign: 'center', background: '#d1fae5', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#059669' }}>{v.si}</div>
                        <div style={{ fontSize: 11, color: '#059669' }}>A favor</div>
                      </div>
                      <div style={{ textAlign: 'center', background: '#fee2e2', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{v.no}</div>
                        <div style={{ fontSize: 11, color: '#dc2626' }}>En contra</div>
                      </div>
                      <div style={{ textAlign: 'center', background: '#f3f4f6', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#6b7280' }}>{v.abstencion}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Abstención</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function estadoColor(estado) {
  const m = {
    pendiente: { background: '#fef3c7', color: '#92400e' },
    en_curso: { background: '#dbeafe', color: '#1e40af' },
    aprobado: { background: '#d1fae5', color: '#065f46' },
    rechazado: { background: '#fee2e2', color: '#991b1b' },
    abierta: { background: '#dbeafe', color: '#1e40af' },
  }
  return m[estado] || {}
}

const s = {
  page: { minHeight: '100vh', background: '#f9fafb' },
  header: { background: '#1D9E75', color: '#fff', padding: '16px', display: 'flex', alignItems: 'center', gap: 12 },
  logo: { fontSize: 32 },
  title: { fontWeight: 700, fontSize: 16 },
  subtitle: { fontSize: 12, opacity: 0.8 },
  loginLink: { marginLeft: 'auto', color: '#fff', fontSize: 13, textDecoration: 'none', background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 8 },
  noSesion: { textAlign: 'center', padding: '60px 20px', color: '#374151' },
  content: { padding: 16, display: 'flex', flexDirection: 'column', gap: 14 },
  sesionCard: { background: '#1D9E75', borderRadius: 14, padding: '20px 16px', textAlign: 'center', color: '#fff' },
  sesionTitulo: { fontWeight: 800, fontSize: 20, marginBottom: 4 },
  sesionSub: { fontSize: 13, opacity: 0.85 },
  card: { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { fontWeight: 700, fontSize: 15, marginBottom: 12 },
  agendaRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6' },
  agendaNum: { width: 26, height: 26, background: '#1D9E75', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
}
