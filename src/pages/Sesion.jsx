import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Sesion() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const [sesion, setSesion] = useState(null)
  const [asistencia, setAsistencia] = useState(null)
  const [colaPalabra, setColaPalabra] = useState([])
  const [mociones, setMociones] = useState([])
  const [agenda, setAgenda] = useState([])
  const [votaciones, setVotaciones] = useState([])
  const [misVotos, setMisVotos] = useState({})
  const [tab, setTab] = useState('inicio')
  const [tipoMocion, setTipoMocion] = useState('orden_dia')
  const [textoMocion, setTextoMocion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [votando, setVotando] = useState(null)
  const [msg, setMsg] = useState('')

  const cargarDatos = useCallback(async () => {
    const { data: ses } = await supabase.from('sesiones').select('*').eq('activa', true).maybeSingle()
    setSesion(ses)
    if (ses && perfil) {
      const { data: asis } = await supabase.from('asistencia').select('*').eq('sesion_id', ses.id).eq('consejero_id', perfil.id).maybeSingle()
      setAsistencia(asis)
      const { data: cola } = await supabase.from('cola_palabra').select('*, perfiles(nombre, cargo)').eq('sesion_id', ses.id).eq('atendido', false).order('created_at')
      setColaPalabra(cola || [])
      const { data: moc } = await supabase.from('mociones').select('*, perfiles(nombre)').eq('sesion_id', ses.id).order('created_at', { ascending: false })
      setMociones(moc || [])
      const { data: ag } = await supabase.from('agenda').select('*').eq('sesion_id', ses.id).order('orden')
      setAgenda(ag || [])
      const { data: vot } = await supabase.from('votaciones').select('*').eq('sesion_id', ses.id).order('created_at', { ascending: false })
      setVotaciones(vot || [])
      if (vot && vot.length > 0) {
        const ids = vot.map(v => v.id)
        const { data: myVotes } = await supabase.from('votos').select('*').eq('consejero_id', perfil.id).in('votacion_id', ids)
        const votosMap = {}
        myVotes?.forEach(v => { votosMap[v.votacion_id] = v.voto })
        setMisVotos(votosMap)
      }
    } else {
      setAsistencia(null); setColaPalabra([]); setMociones([]); setAgenda([]); setVotaciones([]); setMisVotos({})
    }
  }, [perfil])

  useEffect(() => {
    if (perfil) cargarDatos()
  }, [perfil, cargarDatos])

  useEffect(() => {
    const canal = supabase.channel('sesion-live-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, cargarDatos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cola_palabra' }, cargarDatos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mociones' }, cargarDatos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, cargarDatos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda' }, cargarDatos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votaciones' }, cargarDatos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votos' }, cargarDatos)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [cargarDatos])

  async function registrarAsistencia() {
    if (!sesion || !perfil) return
    setEnviando(true)
    await supabase.from('asistencia').upsert({ sesion_id: sesion.id, consejero_id: perfil.id, presente: true })
    await cargarDatos()
    mostrarMsg('✓ Asistencia registrada')
    setEnviando(false)
  }

  async function pedirPalabra() {
    if (!sesion || !perfil) return
    const yaEnCola = colaPalabra.find(c => c.consejero_id === perfil.id)
    if (yaEnCola) { mostrarMsg('Ya estás en la cola'); return }
    setEnviando(true)
    await supabase.from('cola_palabra').insert({ sesion_id: sesion.id, consejero_id: perfil.id })
    await cargarDatos()
    mostrarMsg('✋ Solicitaste la palabra')
    setEnviando(false)
  }

  async function retirarPalabra() {
    if (!sesion || !perfil) return
    await supabase.from('cola_palabra').delete().eq('sesion_id', sesion.id).eq('consejero_id', perfil.id).eq('atendido', false)
    await cargarDatos()
    mostrarMsg('Retirado de la cola')
  }

  async function enviarMocion() {
    if (!sesion || !perfil || !textoMocion.trim()) return
    setEnviando(true)
    await supabase.from('mociones').insert({ sesion_id: sesion.id, consejero_id: perfil.id, tipo: tipoMocion, texto: textoMocion.trim(), estado: 'pendiente' })
    await cargarDatos()
    mostrarMsg('📋 Moción enviada')
    setTextoMocion('')
    setEnviando(false)
  }

  async function registrarVoto(votacionId, tipoVoto) {
    if (!perfil || votando) return
    setVotando(votacionId)
    const { error } = await supabase.from('votos').upsert({ votacion_id: votacionId, consejero_id: perfil.id, voto: tipoVoto })
    if (!error) {
      await supabase.rpc('actualizar_conteo_votos', { p_votacion_id: votacionId }).catch(() => {})
      await cargarDatos()
      mostrarMsg('✓ Voto registrado')
    } else {
      mostrarMsg('Ya votaste en esta votación')
    }
    setVotando(null)
  }

  function mostrarMsg(texto) {
    setMsg(texto)
    setTimeout(() => setMsg(''), 3000)
  }

  const enCola = colaPalabra.find(c => c.consejero_id === perfil?.id)
  const posicion = enCola ? colaPalabra.findIndex(c => c.consejero_id === perfil?.id) + 1 : null
  const esMesa = perfil?.rol === 'mesa_directiva' || perfil?.rol === 'secretaria'

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.headerTitle}>🏛️ Consejo de Juventud</div>
          <div style={s.headerSub}>{perfil?.nombre} · {rolLabel(perfil?.rol)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {esMesa && <button onClick={() => navigate('/admin')} style={s.btnAdmin}>Admin</button>}
          <button onClick={logout} style={s.btnSalir}>Salir</button>
        </div>
      </div>

      {sesion ? (
        <div style={s.sesionBadge}>
          <span style={s.dot} /> Sesión {sesion.tipo} N° {sesion.numero} en curso
        </div>
      ) : (
        <div style={{ ...s.sesionBadge, background: '#f3f4f6', color: '#6b7280' }}>
          Sin sesión activa por el momento
        </div>
      )}

      <div style={s.tabs}>
        {[['inicio', '🏠 Inicio'], ['agenda', '📄 Agenda'], ['mociones', '📋 Mociones'], ['votaciones', '🗳️ Votaciones']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }}>{label}</button>
        ))}
      </div>

      {msg && <div style={s.toast}>{msg}</div>}

      {tab === 'inicio' && (
        <div style={s.content}>
          <div style={s.card}>
            <div style={s.cardTitle}>📍 Mi asistencia</div>
            {asistencia?.presente ? (
              <div style={s.checkRow}><span style={s.check}>✓</span> Asistencia registrada</div>
            ) : (
              <button onClick={registrarAsistencia} disabled={!sesion || enviando} style={{ ...s.bigBtn, background: sesion ? '#1D9E75' : '#d1d5db', cursor: sesion ? 'pointer' : 'not-allowed' }}>
                {enviando ? 'Registrando...' : '✓ Registrar mi asistencia'}
              </button>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>✋ Pedir la palabra</div>
            {enCola ? (
              <div style={{ textAlign: 'center' }}>
                <div style={s.posicionNum}>{posicion}</div>
                <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 12 }}>Tu posición en la cola</div>
                <button onClick={retirarPalabra} style={{ ...s.btnPeligro, cursor: 'pointer' }}>Retirar solicitud</button>
              </div>
            ) : (
              <button onClick={pedirPalabra} disabled={!sesion || enviando} style={{ ...s.bigBtn, background: sesion ? '#2563eb' : '#d1d5db', cursor: sesion ? 'pointer' : 'not-allowed' }}>
                {enviando ? 'Enviando...' : '✋ Pedir la palabra'}
              </button>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>👥 Cola de palabra ({colaPalabra.length})</div>
            {colaPalabra.length === 0 ? (
              <div style={s.empty}>Nadie ha pedido la palabra</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colaPalabra.map((c, i) => (
                  <div key={c.id} style={{ ...s.colaItem, ...(c.consejero_id === perfil?.id ? s.colaItemMio : {}) }}>
                    <span style={s.colaNum}>{i + 1}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.perfiles?.nombre}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{c.perfiles?.cargo}</div>
                    </div>
                    {c.consejero_id === perfil?.id && <span style={s.tuBadge}>tú</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'agenda' && (
        <div style={s.content}>
          <div style={s.card}>
            <div style={s.cardTitle}>📄 Orden del Día</div>
            {!sesion ? (
              <div style={s.empty}>No hay sesión activa</div>
            ) : agenda.length === 0 ? (
              <div style={s.empty}>La mesa directiva aún no ha publicado el orden del día</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {agenda.map((item, i) => (
                  <div key={item.id} style={s.agendaItem}>
                    <div style={s.agendaNum}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.titulo}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{item.tipo}</div>
                    </div>
                    <span style={{ ...s.estadoBadge, ...estadoColor(item.estado) }}>{item.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'mociones' && (
        <div style={s.content}>
          {sesion && (
            <div style={s.card}>
              <div style={s.cardTitle}>➕ Nueva moción</div>
              <label style={s.label}>Tipo de moción</label>
              <select value={tipoMocion} onChange={e => setTipoMocion(e.target.value)} style={s.select}>
                <option value="orden_dia">Moción de orden del día</option>
                <option value="proposicion">Proposición</option>
                <option value="proyecto_acuerdo">Proyecto de acuerdo</option>
                <option value="receso">Solicitud de receso</option>
                <option value="otro">Otro</option>
              </select>
              <label style={s.label}>Descripción</label>
              <textarea value={textoMocion} onChange={e => setTextoMocion(e.target.value)} placeholder="Describe tu moción..." style={s.textarea} rows={3} />
              <button onClick={enviarMocion} disabled={!textoMocion.trim() || enviando} style={{ ...s.bigBtn, background: textoMocion.trim() ? '#7c3aed' : '#d1d5db', cursor: textoMocion.trim() ? 'pointer' : 'not-allowed', marginTop: 8 }}>
                {enviando ? 'Enviando...' : '📋 Enviar moción'}
              </button>
            </div>
          )}
          <div style={s.card}>
            <div style={s.cardTitle}>📋 Mociones presentadas</div>
            {mociones.length === 0 ? (
              <div style={s.empty}>No hay mociones aún</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mociones.map(m => (
                  <div key={m.id} style={s.mocionCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed' }}>{tipoMocionLabel(m.tipo)}</span>
                      <span style={{ ...s.estadoBadge, ...estadoColor(m.estado) }}>{m.estado}</span>
                    </div>
                    <div style={{ fontSize: 14, marginBottom: 4 }}>{m.texto}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>por {m.perfiles?.nombre}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'votaciones' && (
        <div style={s.content}>
          {!sesion ? (
            <div style={s.card}><div style={s.empty}>No hay sesión activa</div></div>
          ) : votaciones.length === 0 ? (
            <div style={s.card}><div style={s.empty}>No hay votaciones abiertas aún</div></div>
          ) : (
            votaciones.map(v => {
              const miVoto = misVotos[v.id]
              const total = v.si + v.no + v.abstencion
              const pct = n => total ? Math.round((n / total) * 100) : 0
              return (
                <div key={v.id} style={s.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{v.titulo}</div>
                    <span style={{ ...s.estadoBadge, ...estadoColor(v.estado) }}>{v.estado}</span>
                  </div>

                  {v.estado === 'abierta' && !miVoto && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, textAlign: 'center' }}>Emite tu voto</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => registrarVoto(v.id, 'si')} disabled={votando === v.id} style={{ flex: 1, padding: '14px 8px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                          ✓ A favor
                        </button>
                        <button onClick={() => registrarVoto(v.id, 'no')} disabled={votando === v.id} style={{ flex: 1, padding: '14px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                          ✗ En contra
                        </button>
                        <button onClick={() => registrarVoto(v.id, 'abstencion')} disabled={votando === v.id} style={{ flex: 1, padding: '14px 8px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                          — Abs.
                        </button>
                      </div>
                    </div>
                  )}

                  {miVoto && v.estado === 'abierta' && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 10, padding: '10px 14px', marginBottom: 12, textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#065f46' }}>✓ Votaste: {miVoto === 'si' ? 'A favor' : miVoto === 'no' ? 'En contra' : 'Abstención'}</span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ textAlign: 'center', background: '#d1fae5', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{v.si}</div>
                      <div style={{ fontSize: 11, color: '#059669' }}>A favor ({pct(v.si)}%)</div>
                    </div>
                    <div style={{ textAlign: 'center', background: '#fee2e2', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{v.no}</div>
                      <div style={{ fontSize: 11, color: '#dc2626' }}>En contra ({pct(v.no)}%)</div>
                    </div>
                    <div style={{ textAlign: 'center', background: '#f3f4f6', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#6b7280' }}>{v.abstencion}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>Abstención</div>
                    </div>
                  </div>

                  {v.estado !== 'abierta' && (
                    <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: v.estado === 'aprobado' ? '#059669' : '#dc2626', marginTop: 10 }}>
                      {v.estado === 'aprobado' ? '✓ APROBADO' : '✗ RECHAZADO'}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
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
  }
  return m[estado] || {}
}
const s = {
  page: { minHeight: '100vh', background: '#f9fafb', paddingBottom: 24 },
  header: { background: '#1D9E75', color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontWeight: 700, fontSize: 16 },
  headerSub: { fontSize: 12, opacity: 0.85, marginTop: 2 },
  btnAdmin: { padding: '6px 12px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
  btnSalir: { padding: '6px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
  sesionBadge: { background: '#d1fae5', color: '#065f46', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 },
  dot: { display: 'inline-block', width: 8, height: 8, background: '#10b981', borderRadius: '50%' },
  tabs: { display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb' },
  tab: { flex: 1, padding: '12px 4px', fontSize: 12, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', borderBottom: '2px solid transparent' },
  tabActive: { color: '#1D9E75', borderBottom: '2px solid #1D9E75' },
  content: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 },
  card: { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTitle: { fontWeight: 700, fontSize: 15, marginBottom: 12, color: '#111827' },
  bigBtn: { width: '100%', padding: '14px', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700 },
  btnPeligro: { padding: '10px 20px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, color: '#065f46', fontWeight: 600, fontSize: 15 },
  check: { fontSize: 20, color: '#10b981' },
  posicionNum: { fontSize: 56, fontWeight: 800, color: '#2563eb', textAlign: 'center' },
  colaItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' },
  colaItemMio: { background: '#eff6ff', border: '1px solid #bfdbfe' },
  colaNum: { width: 28, height: 28, background: '#e5e7eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  tuBadge: { marginLeft: 'auto', background: '#dbeafe', color: '#1e40af', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  agendaItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10 },
  agendaNum: { width: 28, height: 28, background: '#1D9E75', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  estadoBadge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  mocionCard: { padding: '12px', border: '1px solid #e5e7eb', borderRadius: 10 },
  label: { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4, marginTop: 8 },
  select: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, marginBottom: 8 },
  textarea: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, resize: 'vertical' },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: '20px 0' },
  toast: { position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 24, fontSize: 14, fontWeight: 500, zIndex: 999 },
}
