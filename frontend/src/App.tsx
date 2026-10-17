import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity, ArrowLeftRight, ArrowRight, CheckCircle2, ChevronDown, CircleAlert,
  CircleDot, Clock3, Goal, LayoutDashboard, PlusCircle, Radio, RefreshCw,
  Send, Settings2, ShieldCheck, Signal, Trophy, Users, WifiOff,
} from 'lucide-react';
import { api } from './api';
import type { EventForm, EventType, Match, MatchDetail, MatchEvent, TeamSide } from './types';

type View = 'public' | 'admin';
type Connection = 'conectado' | 'reconectando' | 'desconectado';
type Incoming = { match: Match; event: MatchEvent };

const startForm: EventForm = {
  type: 'GOAL', team: 'HOME', minute: 12, player: '', description: '',
};

const info: Record<EventType, { label: string; icon: typeof Goal; style: string }> = {
  GOAL: { label: 'Gol', icon: Goal, style: 'goal' },
  FOUL: { label: 'Falta', icon: CircleAlert, style: 'foul' },
  SUBSTITUTION: { label: 'Cambio', icon: ArrowLeftRight, style: 'sub' },
};

function orderEvents(a: MatchEvent, b: MatchEvent): number {
  return a.minute - b.minute || a.createdAt.localeCompare(b.createdAt) || a.id - b.id;
}

function abbreviate(team: string) {
  const names: Record<string, string> = {
    Municipal: 'MUN', Comunicaciones: 'COM', Guatemala: 'GUA',
    'Costa Rica': 'CRC', Barcelona: 'FCB', 'Real Madrid': 'RMA',
  };
  return names[team] ?? team.slice(0, 3).toUpperCase();
}

function TeamBadge({ team, large = false }: { team: string; large?: boolean }) {
  const slug = team.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '-');
  return <span className={`team-badge ${large ? 'big' : ''} badge-${slug}`} aria-hidden="true">{abbreviate(team).slice(0, 2)}</span>;
}

function ConnectionPill({ state }: { state: Connection }) {
  const Icon = state === 'conectado' ? Signal : state === 'reconectando' ? RefreshCw : WifiOff;
  return <span className={`connection ${state}`}><Icon size={14} /> {state}</span>;
}

function MatchCard({ match, selected, onClick }: { match: Match; selected: boolean; onClick: () => void }) {
  return (
    <button className={`match-card ${selected ? 'selected' : ''}`} type="button" onClick={onClick}>
      <div className="match-card-top">
        <span className="league"><CircleDot size={11} /> PARTIDO #{String(match.id).padStart(2, '0')}</span>
        <span className="live-dot">{match.status === 'EN_JUEGO' ? 'EN VIVO' : match.status}</span>
      </div>
      <div className="match-card-body">
        <div className="small-team"><TeamBadge team={match.homeTeam} /><span>{match.homeTeam}</span></div>
        <div className="small-score"><b>{match.homeScore}</b><span>:</span><b>{match.awayScore}</b></div>
        <div className="small-team away"><TeamBadge team={match.awayTeam} /><span>{match.awayTeam}</span></div>
      </div>
      <div className="match-card-bottom"><span>Ver seguimiento del partido</span><ArrowRight size={15} /></div>
    </button>
  );
}

function EventItem({ item, match }: { item: MatchEvent; match: Match }) {
  const entry = info[item.type];
  const Icon = entry.icon;
  const teamName = item.team === 'HOME' ? match.homeTeam : match.awayTeam;
  return (
    <article className="event-item">
      <span className="event-minute">{item.minute}<small>′</small></span>
      <span className={`event-glyph ${entry.style}`}><Icon size={18} /></span>
      <div className="event-copy">
        <div className="event-title"><strong>{entry.label}</strong><span className="event-team">{teamName}</span></div>
        <p>{item.description}</p>
        {item.player && <span className="event-player">Jugador: {item.player}</span>}
      </div>
      <span className="event-time" title={new Date(item.createdAt).toLocaleString('es-GT')}>
        {new Date(item.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </article>
  );
}

function Scoreboard({ detail, connection }: { detail: MatchDetail; connection: Connection }) {
  const { match, events } = detail;
  return (
    <div className="scoreboard">
      <div className="scoreboard-head"><span className="mini-label">EL ENCUENTRO</span><ConnectionPill state={connection} /></div>
      <div className="scoreboard-main">
        <div className="score-team"><TeamBadge team={match.homeTeam} large /><h2>{match.homeTeam}</h2><span>LOCAL</span></div>
        <div className="main-result"><span className="match-status"><i /> {match.status === 'EN_JUEGO' ? 'EN DIRECTO' : match.status.replace('_', ' ')}</span>
          <div className="numbers"><span>{match.homeScore}</span><em>:</em><span>{match.awayScore}</span></div><p>Marcador actualizado en tiempo real</p>
        </div>
        <div className="score-team"><TeamBadge team={match.awayTeam} large /><h2>{match.awayTeam}</h2><span>VISITANTE</span></div>
      </div>
      <div className="scoreboard-foot">
        <div><Goal size={16}/><b>{events.filter(e => e.type === 'GOAL').length}</b> goles</div>
        <div><CircleAlert size={16}/><b>{events.filter(e => e.type === 'FOUL').length}</b> faltas</div>
        <div><ArrowLeftRight size={16}/><b>{events.filter(e => e.type === 'SUBSTITUTION').length}</b> cambios</div>
      </div>
    </div>
  );
}

function AdminPanel({ selectedId, detail, afterSave }: {
  selectedId: number; detail: MatchDetail | null; afterSave: (update: Incoming) => void;
}) {
  const [form, setForm] = useState<EventForm>(startForm);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(startForm);
    setNotice('');
    setError('');
  }, [selectedId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    if (form.description.trim().length < 3) {
      setError('La descripción necesita al menos 3 caracteres.'); return;
    }
    if (!Number.isInteger(Number(form.minute)) || form.minute < 0 || form.minute > 130) {
      setError('El minuto debe estar entre 0 y 130.'); return;
    }
    setBusy(true);
    try {
      const update = await api.addEvent(selectedId, form);
      afterSave(update);
      setNotice(`${info[form.type].label} registrado y transmitido correctamente.`);
      setForm(previous => ({ ...previous, minute: Math.min(previous.minute + 1, 130), player: '', description: '' }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al guardar el evento.');
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(detail?.match.id === selectedId);
  return (
    <section className="admin-card" aria-label="Administración de eventos">
      <div className="section-head"><div className="section-icon admin"><Settings2 size={18}/></div><div><h3>Panel de administración</h3><p>Registra un evento en el partido seleccionado</p></div></div>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="eventType">Tipo de evento</label>
        <div className="event-options" role="group" aria-label="Tipo de evento">
          {(Object.keys(info) as EventType[]).map(type => {
            const Icon = info[type].icon;
            return <button key={type} type="button" className={`type-option ${form.type === type ? 'chosen' : ''}`} onClick={() => setForm({ ...form, type })}><Icon size={18} />{info[type].label}</button>;
          })}
        </div>
        <div className="form-row">
          <div><label className="field-label" htmlFor="minute">Minuto</label><input id="minute" type="number" min={0} max={130} required value={form.minute} onChange={event => setForm({ ...form, minute: Number(event.target.value) })} /></div>
          <div><label className="field-label" htmlFor="side">Equipo</label><div className="select-wrap"><select id="side" value={form.team} onChange={event => setForm({ ...form, team: event.target.value as TeamSide })}>
            <option value="HOME">{detail?.match.homeTeam ?? 'Local'}</option><option value="AWAY">{detail?.match.awayTeam ?? 'Visitante'}</option>
          </select><ChevronDown size={15} /></div></div>
        </div>
        <label className="field-label" htmlFor="player">Jugador <span>(opcional)</span></label>
        <input id="player" maxLength={70} placeholder="Ej. Carlos Pérez" value={form.player} onChange={event => setForm({ ...form, player: event.target.value })} />
        <label className="field-label" htmlFor="description">Descripción del evento</label>
        <textarea id="description" minLength={3} maxLength={240} required rows={3} placeholder="Ej. Remate de cabeza tras un centro al área." value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
        {error && <div role="alert" className="form-message error"><CircleAlert size={16}/>{error}</div>}
        {notice && <div role="status" className="form-message success"><CheckCircle2 size={16}/>{notice}</div>}
        <button className="submit-button" type="submit" disabled={!ready || busy || detail?.match.status === 'FINALIZADO'}><Send size={17}/>{busy ? 'Guardando...' : 'Publicar evento'}<ArrowRight size={16}/></button>
        <p className="admin-tip"><ShieldCheck size={14}/> Primero se guarda en SQLite; después se transmite por SSE.</p>
      </form>
    </section>
  );
}

function App() {
  const [view, setView] = useState<View>('public');
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [connection, setConnection] = useState<Connection>('desconectado');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const receive = useCallback((update: Incoming) => {
    setMatches(current => current.map(match => match.id === update.match.id ? update.match : match));
    setDetail(current => {
      if (current?.match.id !== update.match.id) return current;
      // El mismo ID puede llegar por POST, SSE o una reconexión: no se duplica.
      if (current.events.some(event => event.id === update.event.id)) {
        return { ...current, match: update.match };
      }
      return { match: update.match, events: [...current.events, update.event].sort(orderEvents) };
    });
  }, []);

  useEffect(() => {
    api.matches().then(data => {
      setMatches(data);
      setSelectedId(current => current ?? data[0]?.id ?? null);
      if (data.length === 0) setError('No hay partidos. Ejecuta npm run db:seed.');
    }).catch(cause => {
      setError(cause instanceof Error ? cause.message : 'No se pudo conectar con la API.');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let alive = true;
    const controller = new AbortController();
    let source: EventSource | undefined;
    setDetail(null);
    setConnection('desconectado');
    setError('');
    setLoading(true);

    // 1) GET HTTP recupera estado + historial almacenado.
    api.details(selectedId, controller.signal).then(data => {
      if (!alive) return;
      setDetail(data);
      setLoading(false);
      // 2) SSE comienza DESPUÉS de cargar los datos de la base.
      const lastId = Math.max(0, ...data.events.map(event => event.id));
      source = new EventSource(`/api/matches/${selectedId}/events/stream?after=${lastId}`);
      setConnection('reconectando');
      source.onopen = () => { if (alive) setConnection('conectado'); };
      source.onerror = () => { if (alive) setConnection('reconectando'); };
      source.addEventListener('match-event', (message: MessageEvent) => {
        if (!alive) return;
        try { receive(JSON.parse(message.data) as Incoming); }
        catch (cause) { console.error('SSE inválido:', cause); }
      });
    }).catch(cause => {
      if (!alive || controller.signal.aborted) return;
      setLoading(false);
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el partido.');
    });

    // 3) Al cambiar de partido o cerrar la vista, limpiar por completo.
    return () => {
      alive = false;
      controller.abort();
      source?.close();
    };
  }, [selectedId, receive]);

  const current = detail?.match;
  const events = detail?.events ?? [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Marcador Live"><span className="brand-icon"><Activity size={24} strokeWidth={2.6}/></span><span><strong>MARCADOR<span>LIVE</span></strong><small>EL FÚTBOL AL INSTANTE</small></span></a>
        <div className="header-right"><span className="top-live"><span/> TRANSMISIÓN EN TIEMPO REAL</span><div className="avatar">ML</div></div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-label">NAVEGACIÓN</div>
          <button className={`nav-item ${view === 'public' ? 'active' : ''}`} onClick={() => setView('public')}><LayoutDashboard size={19}/>Vista pública</button>
          <button className={`nav-item ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}><Settings2 size={19}/>Administración</button>
          <div className="sidebar-label leagues-label">TU LIGA EN VIVO</div>
          <div className="sidebar-info"><Trophy size={17}/><span>Centro de partidos <small>Edición demostrativa</small></span></div>
          <div className="sidebar-bottom"><div className="sidebar-help"><Radio size={19}/><strong>Actualizaciones SSE</strong><p>Sin refrescar la página. Los eventos llegan al instante.</p></div><span className="side-version">v1.0 · React + TypeScript</span></div>
        </aside>
        <main className="main-content">
          <div className="eyebrow"><span /> CENTRO DE PARTIDOS <span className="slash">/</span> {view === 'public' ? 'EN VIVO' : 'CONTROL DE PARTIDOS'}</div>
          <div className="page-heading"><div><h1>{view === 'public' ? 'Fútbol en vivo' : 'Centro de control'}<span className="heading-period">.</span></h1><p>{view === 'public' ? 'Cada jugada cuenta. Sigue los encuentros segundo a segundo.' : 'Gestiona las jugadas y publícalas en tiempo real para todos.'}</p></div><span className="date-chip"><Clock3 size={15}/> ACTUALIZACIÓN AUTOMÁTICA</span></div>
          <div className="section-header"><div className="section-name"><span className="red-mark"/>PARTIDOS DESTACADOS <span className="count">{matches.length}</span></div><span className="section-note"><Radio size={14}/> Datos de demostración</span></div>
          <div className="matches-grid">
            {matches.map(match => <MatchCard key={match.id} match={match} selected={selectedId === match.id} onClick={() => setSelectedId(match.id)} />)}
          </div>
          {error && <div className="main-error" role="alert"><CircleAlert size={19}/><div><b>Atención</b><p>{error}</p></div></div>}
          {loading && <div className="loading"><RefreshCw size={19} className="spin"/> Cargando información del partido...</div>}
          {current && <div className="detail-grid">
            <div className="detail-primary">
              <Scoreboard detail={detail!} connection={connection}/>
              <section className="timeline-panel">
                <div className="section-head"><div className="section-icon"><Activity size={18}/></div><div><h3>Línea de tiempo</h3><p>Jugadas ordenadas por minuto y fecha de registro</p></div><span className="event-count">{events.length} EVENTOS</span></div>
                <div className="timeline-items">
                  {events.length ? events.map(event => <EventItem key={event.id} item={event} match={current}/>) : <div className="empty-state"><div><PlusCircle size={30}/></div><h4>El partido acaba de comenzar</h4><p>Aún no hay jugadas registradas. Entra a Administración para publicar la primera.</p></div>}
                </div>
              </section>
            </div>
            <div className="detail-aside">
              {view === 'admin' && selectedId !== null ? <AdminPanel selectedId={selectedId} detail={detail} afterSave={receive}/> : <section className="side-card"><span className="side-card-kicker"><Radio size={15}/> PARTIDO EN DIRECTO</span><h3>No te pierdas<br/>ninguna jugada.</h3><p>Cambia de partido para ver su propio marcador y su historial. Cada transmisión funciona de forma independiente.</p><div className="side-feature"><Signal size={18}/><span>Conexión SSE activa</span><ConnectionPill state={connection}/></div><div className="side-feature"><ShieldCheck size={18}/><span>Datos persistentes en SQLite</span><CheckCircle2 size={17} className="ok-icon"/></div><button className="outline-button" onClick={() => setView('admin')}><Settings2 size={16}/> Ir a administración <ArrowRight size={16}/></button></section>}
              <div className="stats-card"><div className="stats-title"><Users size={16}/> RESUMEN DEL PARTIDO</div><div className="stat"><span>Eventos registrados</span><strong>{events.length}</strong></div><div className="stat"><span>Último minuto registrado</span><strong>{events.length ? Math.max(...events.map(e => e.minute)) : '—'}{events.length ? '′' : ''}</strong></div><div className="stat"><span>Actualización</span><strong className="stat-live">LIVE</strong></div></div>
            </div>
          </div>}
          {!loading && !current && !error && <div className="empty-state"><h3>Selecciona un partido para empezar.</h3></div>}
          <footer className="footer"><span>© Marcador Live · Proyecto académico</span><span><ShieldCheck size={14}/> TypeScript · Express · Drizzle · SSE</span></footer>
        </main>
      </div>
    </div>
  );
}

export default App;
