import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Admin() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('sesion')
  const [sesion, setSesion] = useState(null)
  const [asistencia, setAsistencia] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [cola, setCola] = useState([])
  const [mociones, setMociones] = useState([])
  const [agenda, setAgenda] = useState([])
  const [votaciones, setVotaciones] = useState([])
  const [msg, setMsg] = useState('')

  // Formularios
  const [numSesion, setNumSesion] = useState('')
  const [tipoSesion, setTipoSesion] = useState('ordinaria')
  const [tituloAgenda, setTituloAgenda] = useState('')
  const [tipoAgenda, setTipoAgenda] = useState('Verificación de quórum')
  const [tituloVot, setTituloVot] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    cargarTodo()
    const canal = supabase.channel('admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, cargarTodo)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cola_palabra' }, cargarTodo)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mociones' }, cargarTodo)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, cargarTodo)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votaciones' }, cargarTodo)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  async function cargarTodo() {
    const { data: ses } = await supabase.from('sesiones').select('*').eq('activa', true).single()
    setSesion(ses)
    const { data: profs } = await supabase.from('perfiles').select('*').order('nombre')
    setPerfiles(profs || [])
    if (ses) {
      const { data: asis } = await supabase.from('asistencia').select('*, perfiles(nombre, cargo)').eq('sesion_id', ses.id)
      setAsistencia(asis || [])
      const { data: c } = await supabase.from('cola_palabra').select('*, perfiles(nombre, cargo)').eq('sesion_id', ses.id).eq('atendido', false).order('created_at')
      setCola(c || [])
      const { data: m } = await supabase.from('mociones').select('*, perfiles(nombre)').eq('sesion_id', ses.id).order('created_at', { ascending: false })
      setMociones(m || [])
      const { data: ag } = await supabase.from('agenda').select('*').eq('sesion_id', ses.id).order('orden')
      setAgenda(ag || [])
      const { data: v } = await supabase.from('votaciones').select('*').eq('sesion_id', ses.id).order('created_at', { ascending: false })
      setVotaciones(v || [])
    } else {
      setAsistencia([]); setCola([]); setMociones([]); setAgenda([]); setVotaciones([])
    }
  }

  async function abrirSesion() {
    if (!numSesion.trim()) { mostrarMsg('Ingresa el número de sesión'); return }
    setEnviando(true)
    await supabase.from('sesiones').update({ activa: false }).eq('activa', true)
    await supabase.from('sesiones').insert({ numero: numSesion, tipo: tipoSesion, activa: true })
    mostrarMsg('✓ Sesión abierta')
    setNumSesion('')
    setEnviando(false)
  }

  async function cerrarSesion() {
    if (!sesion) return
    if (!confirm('¿Cerrar la sesión actual?')) return
    await supabase.from('sesiones').update({ activa: false, cerrada_at: new Date() }).eq('id', sesion.id)
    mostrarMsg('Sesión cerrada')
  }

  async function atenderCola(id) {
    await supabase.from('cola_palabra').update({ atendido: true }).eq('id', id)
  }

  async function resolverMocion(id, estado) {
    await supabase.from('mociones').update({ estado }).eq('id', id)
  }

  async function agregarAgenda() {
    if (!sesion || !tituloAgenda.trim()) return
    const orden = agenda.length + 1
    await supabase.from('agenda').insert({ sesion_id: sesion.id, titulo: tituloAgenda, tipo: tipoAgenda, orden, estado: 'pendiente' })
    setTituloAgenda('')
    mostrarMsg('Punto agregado')
  }

  async function cambiarEstadoAgenda(id, estado) {
    await supabase.from('agenda').update({ estado }).eq('id', id)
  }

  async function crearVotacion() {
    if (!sesion || !tituloVot.trim()) return
    await supabase.from('votaciones').insert({ sesion_id: sesion.id, titulo: tituloVot, si: 0, no: 0, abstencion: 0, estado: 'abierta' })
    setTituloVot('')
    mostrarMsg('Votación creada')
  }

  async function votar(id, tipo) {
    const v = votaciones.find(x => x.id === id)
    if (!v || v.estado !== 'abierta') return
    const update = {}
    update[tipo] = (v[tipo] || 0) + 1
    await supabase.from('votaciones').update(update).eq('id', id)
  }

  async function cerrarVotacion(id) {
    const v = votaciones.find(x => x.id === id)
    if (!v) return
    const resultado = v.si > v.no ? 'aprobado' : 'rechazado'
    await supabase.from('votaciones').update({ estado: resultado }).eq('id', id)
    mostrarMsg(`Votación ${resultado}`)
  }

  const presentes = asistencia.filter(a => a.presente).length
  const total = perfiles.filter(p => p.rol === 'consejero').length
  const quorumMin = Math.floor(total / 2) + 1
  const tieneQuorum = presentes >= quorumMin

  function mostrarMsg(texto) {
    setMsg(texto)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.headerTitle}>⚙️ Panel de Administración</div>
          <div style={s.headerSub}>{perfil?.nombre} · {rolLabel(perfil?.rol)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/sesion')} style={s.btnBack}>← Volver</button>
          <button onClick={logout} style={s.btnSalir}>Salir</button>
        </div>
      </div>

      <div style={s.tabs}>
        {[['sesion', '🏛️ Sesión'], ['asistencia', '📋 Asistencia'], ['cola', '✋ Cola'], ['mociones', '📋 Mociones'], ['agenda', '📄 Agenda'], ['votaciones', '🗳️ Votaciones']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }}>{label}</button>
        ))}
      </div>

      {msg && <div style={s.toast}>{msg}</div>}

      <div style={s.content}>

        {/* SESIÓN */}
        {tab === 'sesion' && (
          <>
            <div style={s.card}>
              <div style={s.cardTitle}>Estado actual</div>
              {sesion ? (
                <div>
                  <div style={s.sesionActiva}>Sesión {sesion.tipo} N°{sesion.numero} — ACTIVA</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '14px 0' }}>
                    <div style={s.metric}><div style={s.metricVal}>{presentes}</div><div style={s.metricLbl}>Presentes</div></div>
                    <div style={s.metric}><div style={s.metricVal}>{total}</div><div style={s.metricLbl}>Consejeros</div></div>
                    <div style={s.metric}><div style={{ ...s.metricVal, color: tieneQuorum ? '#059669' : '#dc2626' }}>{tieneQuorum ? 'Sí' : 'No'}</div><div style={s.metricLbl}>Quórum ({quorumMin}+)</div></div>
                    <div style={s.metric}><div style={s.metricVal}>{cola.length}</div><div style={s.metricLbl}>En cola</div></div>
                  </div>
                  <button onClick={cerrarSesion} style={{ ...s.bigBtn, background: '#dc2626' }}>Cerrar sesión</button>
                </div>
              ) : (
                <div style={s.noSesion}>No hay sesión activa</div>
              )}
            </div>

            {!sesion && (
              <div style={s.card}>
                <div style={s.cardTitle}>Abrir nueva sesión</div>
                <label style={s.label}>Número de sesión</label>
                <input value={numSesion} onChange={e => setNumSesion(e.target.value)} placeholder="Ej: 001-2025" style={s.input} />
                <label style={s.label}>Tipo</label>
                <select value={tipoSesion} onChange={e => setTipoSesion(e.target.value)} style={s.select}>
                  <option value="ordinaria">Ordinaria</option>
                  <option value="extraordinaria">Extraordinaria</option>
                  <option value="especial">Especial</option>
                </select>
                <button onClick={abrirSesion} disabled={enviando} style={{ ...s.bigBtn, background: '#1D9E75', marginTop: 8 }}>
                  {enviando ? 'Abriendo...' : '✓ Abrir sesión'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ASISTENCIA */}
        {tab === 'asistencia' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Lista de asistencia — {presentes}/{total} presentes</div>
            {!sesion ? <div style={s.empty}>No hay sesión activa</div> :
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {perfiles.filter(p => p.rol === 'consejero').map(p => {
                  const a = asistencia.find(x => x.consejero_id === p.id)
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: a?.presente ? '#d1fae5' : '#f9fafb', borderRadius: 10, border: '1px solid ' + (a?.presente ? '#6ee7b7' : '#e5e7eb') }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: a?.presente ? '#1D9E75' : '#d1d5db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {p.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{p.cargo}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: a?.presente ? '#059669' : '#9ca3af' }}>
                        {a?.presente ? '✓ Presente' : 'Ausente'}
                      </span>
                    </div>
                  )
                })}
              </div>
            }
          </div>
        )}

        {/* COLA */}
        {tab === 'cola' && (
          <div style={s.card}>
            <div style={s.cardTitle}>✋ Cola de palabra ({cola.length})</div>
            {!sesion ? <div style={s.empty}>No hay sesión activa</div> :
              cola.length === 0 ? <div style={s.empty}>Nadie ha pedido la palabra</div> :
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cola.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: i === 0 ? '#eff6ff' : '#f9fafb', borderRadius: 10, border: '1px solid ' + (i === 0 ? '#bfdbfe' : '#e5e7eb') }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: i === 0 ? '#2563eb' : '#9ca3af', minWidth: 28 }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{c.perfiles?.nombre}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{c.perfiles?.cargo}</div>
                      </div>
                      <button onClick={() => atenderCola(c.id)} style={{ padding: '8px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        ✓ Atendido
                      </button>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* MOCIONES */}
        {tab === 'mociones' && (
          <div style={s.card}>
            <div style={s.cardTitle}>📋 Mociones ({mociones.filter(m => m.estado === 'pendiente').length} pendientes)</div>
            {!sesion ? <div style={s.empty}>No hay sesión activa</div> :
              mociones.length === 0 ? <div style={s.empty}>No hay mociones</div> :
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {mociones.map(m => (
                    <div key={m.id} style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f3e8ff', padding: '2px 8px', borderRadius: 20 }}>{tipoMocionLabel(m.tipo)}</span>
                        <span style={{ ...s.estadoBadge, ...estadoColor(m.estado) }}>{m.estado}</span>
                      </div>
                      <div style={{ fontSize: 14, marginBottom: 6 }}>{m.texto}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: m.estado === 'pendiente' ? 10 : 0 }}>por {m.perfiles?.nombre}</div>
                      {m.estado === 'pendiente' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => resolverMocion(m.id, 'aprobado')} style={{ flex: 1, padding: '8px', background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Aprobar</button>
                          <button onClick={() => resolverMocion(m.id, 'rechazado')} style={{ flex: 1, padding: '8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✗ Rechazar</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* AGENDA */}
        {tab === 'agenda' && (
          <>
            {sesion && (
              <div style={s.card}>
                <div style={s.cardTitle}>➕ Agregar punto</div>
                <label style={s.label}>Tipo</label>
                <select value={tipoAgenda} onChange={e => setTipoAgenda(e.target.value)} style={s.select}>
                  {['Verificación de quórum', 'Instalación de sesión', 'Aprobación del orden del día', 'Proposición', 'Proyecto de acuerdo', 'Informe', 'Debate', 'Varios'].map(t => <option key={t}>{t}</option>)}
                </select>
                <label style={s.label}>Título</label>
                <input value={tituloAgenda} onChange={e => setTituloAgenda(e.target.value)} placeholder="Descripción del punto..." style={s.input} />
                <button onClick={agregarAgenda} style={{ ...s.bigBtn, background: '#1D9E75', marginTop: 8 }}>+ Agregar</button>
              </div>
            )}
            <div style={s.card}>
              <div style={s.cardTitle}>📄 Orden del Día</div>
              {agenda.length === 0 ? <div style={s.empty}>Sin puntos agregados</div> :
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {agenda.map((item, i) => (
                    <div key={item.id} style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ width: 26, height: 26, background: '#1D9E75', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{item.titulo}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{item.tipo}</div>
                        </div>
                        <span style={{ ...s.estadoBadge, ...estadoColor(item.estado) }}>{item.estado}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        {['pendiente', 'en_curso', 'aprobado', 'rechazado'].map(e => (
                          <button key={e} onClick={() => cambiarEstadoAgenda(item.id, e)} style={{ flex: 1, padding: '6px 4px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', background: item.estado === e ? '#1D9E75' : '#f3f4f6', color: item.estado === e ? '#fff' : '#6b7280' }}>{e}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          </>
        )}

        {/* VOTACIONES */}
        {tab === 'votaciones' && (
          <>
            {sesion && (
              <div style={s.card}>
                <div style={s.cardTitle}>➕ Nueva votación</div>
                <label style={s.label}>Asunto a votar</label>
                <input value={tituloVot} onChange={e => setTituloVot(e.target.value)} placeholder="Ej: Aprobación del orden del día" style={s.input} />
                <button onClick={crearVotacion} style={{ ...s.bigBtn, background: '#7c3aed', marginTop: 8 }}>Crear votación</button>
              </div>
            )}
            {votaciones.map(v => (
              <div key={v.id} style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{v.titulo}</div>
                  <span style={{ ...s.estadoBadge, ...estadoColor(v.estado) }}>{v.estado}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ ...s.metric, background: '#d1fae5' }}><div style={{ ...s.metricVal, color: '#059669' }}>{v.si}</div><div style={s.metricLbl}>A favor</div></div>
                  <div style={{ ...s.metric, background: '#fee2e2' }}><div style={{ ...s.metricVal, color: '#dc2626' }}>{v.no}</div><div style={s.metricLbl}>En contra</div></div>
                  <div style={{ ...s.metric, background: '#f3f4f6' }}><div style={s.metricVal}>{v.abstencion}</div><div style={s.metricLbl}>Abstención</div></div>
                </div>
                {v.estado === 'abierta' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => votar(v.id, 'si')} style={{ flex: 1, padding: 10, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ A favor</button>
                      <button onClick={() => votar(v.id, 'no')} style={{ flex: 1, padding: 10, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ En contra</button>
                      <button onClick={() => votar(v.id, 'abstencion')} style={{ flex: 1, padding: 10, background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Abs.</button>
                    </div>
                    <button onClick={() => cerrarVotacion(v.id)} style={{ padding: 10, background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cerrar y declarar resultado</button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function rolLabel(rol) {
  const m = { consejero: 'Consejero(a)', mesa_directiva: 'Mesa Directiva', secretaria: 'Secretaría' }
  return m[rol] || rol
}

function tipoMocionLabel(tipo) {
  const m = { orden_dia: 'Orden del día', proposicion: 'Proposición', proyecto_acuerdo: 'Proyecto de acuerdo', receso: 'Receso', otro: 'Otro' }
  return m[tipo] || tipo
}

function estadoColor(estado) {
  const m = {
    pendiente: { background: '#fef3c7', color: '#92400e' },
    en_curso: { background: '#dbeafe', color: '#1e40af' },
    aprobado: { background: '#d1fae5', color: '#065f46' },
    rechazado: { background: '#fee2e2', color: '#991b1b' },
    abierta: { background: '#dbeafe', color: '#1e40af' },
    atendido: { background: '#e5e7eb', color: '#374151' },
  }
  return m[estado] || {}
}

const s = {
  page: { minHeight: '100vh', background: '#f9fafb', paddingBottom: 24 },
  header: { background: '#111827', color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontWeight: 700, fontSize: 16 },
  headerSub: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  btnBack: { padding: '6px 12px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
  btnSalir: { padding: '6px 12px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
  tabs: { display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' },
  tab: { flexShrink: 0, padding: '12px 14px', fontSize: 12, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', borderBottom: '2px solid transparent', whiteSpace: 'nowrap' },
  tabActive: { color: '#111827', borderBottom: '2px solid #111827' },
  content: { padding: 16, display: 'flex', flexDirection: 'column', gap: 14 },
  card: { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { fontWeight: 700, fontSize: 15, marginBottom: 12, color: '#111827' },
  sesionActiva: { background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 10, fontWeight: 600, fontSize: 14 },
  noSesion: { color: '#9ca3af', textAlign: 'center', padding: 20, fontSize: 14 },
  metric: { background: '#f9fafb', borderRadius: 10, padding: '12px 8px', textAlign: 'center' },
  metricVal: { fontSize: 28, fontWeight: 800, color: '#111827' },
  metricLbl: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  bigBtn: { width: '100%', padding: '13px', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  label: { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4, marginTop: 8 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14 },
  select: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14 },
  estadoBadge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: '20px 0' },
  toast: { position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 24, fontSize: 14, fontWeight: 500, zIndex: 999 },
}
