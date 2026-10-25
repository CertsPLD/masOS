import { useEffect, useState } from 'react';

const sections = [
  { id: 'home', label: 'Inicio', icon: '◫' },
  { id: 'store', label: 'App Store', icon: '▦' },
  { id: 'updates', label: 'Instalaciones OTA', icon: '↥' },
  { id: 'reports', label: 'Comentarios', icon: '◌' },
  { id: 'settings', label: 'Ajustes', icon: '⚙' },
];
const apps = [
  { name: 'Finder', icon: '⌘', color: 'violet', detail: 'Archivos y espacios' },
  { name: 'Safari', icon: '◉', color: 'blue', detail: 'Navegación web' },
  { name: 'Notas', icon: '▤', color: 'yellow', detail: 'Ideas y apuntes' },
  { name: 'Música', icon: '♫', color: 'pink', detail: 'Tu biblioteca musical' },
  { name: 'Fotos', icon: '✿', color: 'orange', detail: 'Recuerdos y álbumes' },
  { name: 'Terminal', icon: '>_', color: 'green', detail: 'Herramientas avanzadas' },
];
export default function App() {
  const [page, setPage] = useState('home');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [account, setAccount] = useState(null);
  const [reports, setReports] = useState([]);
  const [category, setCategory] = useState('sugerencia');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState([]);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const onInstall = (event) => { event.preventDefault(); setDeferred(event); };
    window.addEventListener('beforeinstallprompt', onInstall);
    const saved = localStorage.getItem('masos-installed');
    if (saved) setInstalled(JSON.parse(saved));
    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);
  const pineApi = 'https://accounts.pine.com';
  const pineRequest = async (path, options = {}) => {
    const response = await fetch(pineApi + path, {
      ...options,
      credentials: 'include',
      headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || (response.status === 401 ? 'inicia sesión en PineAccounts' : 'PineAccounts no ha aceptado la solicitud'));
    return data;
  };
  const refreshAccount = async () => {
    try {
      const data = await pineRequest('/api/auth/me');
      setAccount(data.user || null);
      if (data.user) {
        try {
          const accountData = await pineRequest('/api/data?scope=account');
          setAccount(accountData.account || data.user);
        } catch { /* /me sigue siendo la fuente mínima de identidad */ }
      }
    } catch { setAccount(null); }
  };
  useEffect(() => { refreshAccount(); }, []);
  useEffect(() => {
    if (page !== 'reports') return;
    fetch('/api/reports').then(r => r.json()).then(d => setReports(d.reports || [])).catch(() => setReports([]));
  }, [page]);
  const notify = (text) => { setToast(text); window.setTimeout(() => setToast(''), 2600); };
  const accountUrl = 'https://pineaccounts.pages.dev';
  const filteredApps = apps.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));
  const installApp = (name) => {
    const next = [...new Set([...installed, name])];
    setInstalled(next); localStorage.setItem('masos-installed', JSON.stringify(next));
    notify(name + ' añadido a tu biblioteca');
  };
  const submitReport = async (e) => {
    e.preventDefault(); if (message.trim().length < 3) return notify('escribe un comentario un poco más largo');
    setBusy(true);
    try {
      const res = await fetch('/api/reports', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({category, message}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.hint || data.error || 'No se pudo guardar');
      setMessage(''); notify('comentario enviado · gracias');
      const list = await fetch('/api/reports').then(r => r.json()); setReports(list.reports || []);
    } catch (err) { notify(err.message || 'No se pudo conectar con D1'); }
    finally { setBusy(false); }
  };
  const startInstall = async () => {
    if (!deferred) return notify('usa el menú compartir del navegador y elige “añadir a pantalla de inicio”');
    deferred.prompt(); await deferred.userChoice; setDeferred(null);
  };
  return <div className={dark ? 'app' : 'app light'}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">m</div><div><strong>masOS</strong><small>workspace</small></div></div>
      <div className="side-caption">ESPACIO PERSONAL</div>
      <nav>{sections.map(s => <button key={s.id} className={page === s.id ? 'nav-item active' : 'nav-item'} onClick={() => setPage(s.id)}><span className="nav-icon">{s.icon}</span>{s.label}{s.id === 'updates' && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="cloud-status"><span className="online-dot" /><span><b>servicios</b><small>interfaz local activa</small></span></div><button className="account-mini" onClick={() => window.open(accountUrl, '_blank', 'noopener,noreferrer')}><div className="avatar">P</div><span><b>PineAccounts</b><small>gestionar cuenta ↗</small></span></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumbs">masOS <span>/</span> {sections.find(s => s.id === page)?.label}</div><div className="top-actions"><span className="date-label">{new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'}).format(new Date())}</span><button className="icon-button" title="Cambiar apariencia" onClick={() => setDark(!dark)}>{dark ? '☼' : '☾'}</button><button className="profile-button" onClick={() => window.open(accountUrl, '_blank', 'noopener,noreferrer')}><span className="avatar small">P</span><span>{account?.name || account?.email || 'Mi cuenta'}</span><span>↗</span></button></div></header>
      <div className="content">
        {page === 'home' && <>
          <section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="online-dot"/> TU ESPACIO DIGITAL</span><h1>todo en su sitio<span className="accent">.</span></h1><p>tus aplicaciones, actualizaciones y cuenta en un solo lugar</p><div className="hero-actions"><button className="primary" onClick={() => setPage('store')}>Explorar App Store <span>↗</span></button><button className="secondary" onClick={() => setPage('updates')}>Ver instalaciones OTA</button></div></div><div className="orb-wrap"><div className="orb"><div className="orb-core">m</div><span className="orb-ring ring-one"/><span className="orb-ring ring-two"/></div><span className="orb-chip chip-one">✦ sincronizado</span><span className="orb-chip chip-two">◈ masOS</span></div></section>
          <div className="section-heading"><div><span className="eyebrow">LANZADOR</span><h2>tus aplicaciones</h2></div><button className="text-button" onClick={() => setPage('store')}>ver tienda <span>→</span></button></div>
          <div className="app-grid">{apps.slice(0,4).map(a => <AppTile key={a.name} app={a} onClick={() => notify(a.name + ' · módulo de demostración')} />)}<button className="app-tile add-tile" onClick={() => setPage('store')}><span className="add-icon">＋</span><b>Descubrir más</b><small>App Store</small></button></div>
          <div className="bottom-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">CUENTA</span><h3>{account?.name || 'PineAccounts'}</h3></div><span className={account ? 'pill good' : 'pill neutral'}>{account ? 'conectada' : 'sin sesión'}</span></div><p>{account ? `sesión detectada${account.email ? ` · ${account.email}` : ''}` : 'conecta una sesión de PineAccounts para sincronizar tu identidad'}</p><button className="panel-link" onClick={() => { window.open(accountUrl, '_blank', 'noopener,noreferrer'); refreshAccount(); }}>Abrir PineAccounts <span>↗</span></button></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">SISTEMA</span><h3>estado de masOS</h3></div><span className="pill good">interfaz lista</span></div><div className="status-row"><span>Aplicación web instalable</span><b>disponible</b></div><div className="status-row"><span>Comentarios / D1</span><b>requiere binding</b></div></section></div>
        </>}
        {page === 'store' && <><PageTitle eyebrow="CATÁLOGO" title="App Store" subtitle="descubre aplicaciones para tu espacio masOS"/><div className="searchbox"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="buscar aplicaciones..." /></div><div className="store-grid">{filteredApps.map(a => <div className="store-card" key={a.name}><AppIcon app={a}/><div className="store-info"><b>{a.name}</b><small>{a.detail}</small><span className="muted">masOS · aplicación</span></div><button className={installed.includes(a.name) ? 'installed-btn' : 'get-btn'} onClick={() => installApp(a.name)}>{installed.includes(a.name) ? 'Añadida ✓' : 'Obtener'}</button></div>)}</div><p className="notice">estas instalaciones son entradas de biblioteca de demostración; para distribuir binarios reales hacen falta paquetes firmados y un manifiesto OTA válido</p></>}
        {page === 'updates' && <><PageTitle eyebrow="DISTRIBUCIÓN" title="Instalaciones OTA" subtitle="gestiona la instalación web y consulta el estado de tus aplicaciones"/><div className="ota-hero"><div className="ota-symbol">↥</div><div><h3>instalar masOS en tu dispositivo</h3><p>instala la experiencia como aplicación web cuando tu navegador lo permita</p><button className="primary" onClick={startInstall}>Instalar masOS <span>↗</span></button></div></div><div className="section-heading"><div><span className="eyebrow">BIBLIOTECA</span><h2>aplicaciones añadidas</h2></div><span className="pill neutral">{installed.length} apps</span></div>{installed.length ? <div className="installed-list">{installed.map(n => <div className="installed-row" key={n}><span className="installed-check">✓</span><b>{n}</b><span className="muted">añadida a la biblioteca</span><span className="pill good">lista</span></div>)}</div> : <div className="empty-state"><div>↥</div><b>todavía no hay aplicaciones</b><p>explora la tienda para añadir aplicaciones a tu biblioteca</p><button className="secondary" onClick={() => setPage('store')}>abrir App Store</button></div>}<div className="notice">OTA para sistemas nativos (iOS, Android o escritorio) necesita un manifiesto de distribución, paquetes firmados y un servidor de releases; la web no puede instalar silenciosamente software nativo</div></>}
        {page === 'reports' && <><PageTitle eyebrow="COMUNIDAD" title="Comentarios" subtitle="comparte ideas, problemas o mejoras para masOS"/><div className="report-layout"><form className="panel report-form" onSubmit={submitReport}><label>tipo de comentario<select value={category} onChange={e => setCategory(e.target.value)}><option value="sugerencia">sugerencia</option><option value="error">informar de un error</option><option value="interfaz">interfaz y diseño</option><option value="otro">otro</option></select></label><label>tu comentario<textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={5} placeholder="cuéntanos qué mejorarías..." required /></label><div className="form-footer"><small>{message.length}/2000 · se guarda en D1</small><button className="primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar comentario ↗'}</button></div></form><section className="panel report-list"><div className="panel-head"><div><span className="eyebrow">ENTRADAS</span><h3>últimos comentarios</h3></div><span className="pill neutral">{reports.length}</span></div>{reports.length ? reports.map(r => <article className="report-item" key={r.id}><div className="report-meta"><span>{r.category}</span><small>{r.created_at}</small></div><p>{r.message}</p></article>) : <div className="empty-state compact"><div>◌</div><b>sin comentarios todavía</b><p>sé la primera persona en dejar una idea</p></div>}</section></div></>}
        {page === 'settings' && <><PageTitle eyebrow="PREFERENCIAS" title="Ajustes" subtitle="personaliza tu espacio y administra tu cuenta"/><div className="settings-layout"><section className="panel settings-card"><span className="eyebrow">CUENTA COMPARTIDA</span><div className="settings-profile"><div className="avatar large">P</div><div><h3>{account?.name || 'PineAccounts'}</h3><p>{account?.email || (account ? 'sesión detectada' : 'no se ha detectado una sesión activa')}</p></div></div><div className="settings-row"><div><b>Inicio de sesión y perfil</b><small>gestiona los datos en el proveedor de cuenta</small></div><button className="secondary" onClick={() => { window.open(accountUrl, '_blank', 'noopener,noreferrer'); }}>Abrir cuenta ↗</button></div><div className="settings-row"><div><b>App Store</b><small>la cuenta se comparte solo si el servicio admite integración</small></div><button className="secondary" onClick={() => setPage('store')}>Abrir tienda</button></div></section><section className="panel settings-card"><span className="eyebrow">APARIENCIA</span><h3>preferencias visuales</h3><div className="settings-row"><div><b>Modo oscuro</b><small>cambia el tema de la interfaz</small></div><button className={dark ? 'toggle on' : 'toggle'} onClick={() => setDark(!dark)} aria-pressed={dark}><span/></button></div><div className="settings-row"><div><b>Aplicación instalable</b><small>añade masOS a tu pantalla de inicio</small></div><button className="secondary" onClick={startInstall}>Instalar</button></div></section></div><div className="notice">masOS consulta /api/auth/me y /api/data en accounts.pine.com usando la sesión del navegador. Para que funcione entre dominios, Pine debe permitir CORS con credenciales y la política de cookies debe admitir ese contexto; masOS nunca guarda contraseñas ni copia cookies.</div></>}
      </div>
      <footer className="footer"><span>masOS <span className="muted">· workspace</span></span><span>hecho para tu espacio digital</span></footer>
    </main>
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
function PageTitle({eyebrow,title,subtitle}) { return <div className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}<span className="accent">.</span></h1><p>{subtitle}</p></div>; }
function AppIcon({app}) { return <div className={'app-icon '+app.color}>{app.icon}</div>; }
function AppTile({app,onClick}) { return <button className="app-tile" onClick={onClick}><AppIcon app={app}/><b>{app.name}</b><small>{app.detail}</small></button>; }
