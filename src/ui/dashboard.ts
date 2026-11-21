export function buildOpenApiSpec(baseUrl: string) {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return {
    openapi: '3.1.0',
    info: {
      title: 'API PRO PIVO - Football Live & Data Engine',
      version: '1.0.0',
      description:
        'API unificada de fútbol en tiempo real fusionando Promiedos + ESPN Argentina, optimizada para Cloudflare Workers (Plan Gratuito) y apps Flutter.',
    },
    servers: [{ url: cleanBase, description: 'Worker Endpoint' }],
    paths: {
      '/api/v1/health': {
        get: {
          summary: 'Estado del servicio y estadísticas de caché',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/v1/live': {
        get: {
          summary: 'Partidos actualmente en vivo',
          parameters: [
            { name: 'league', in: 'query', schema: { type: 'string' } },
            { name: 'team', in: 'query', schema: { type: 'string' } },
            { name: 'refresh', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: { '200': { description: 'Lista y agrupación por liga en vivo' } },
        },
      },
      '/api/v1/matches': {
        get: {
          summary: 'Scoreboard completo por fecha',
          parameters: [
            {
              name: 'date',
              in: 'query',
              description: 'today, yesterday, tomorrow, YYYY-MM-DD, DD-MM-YYYY o YYYYMMDD',
              schema: { type: 'string', default: 'today' },
            },
            { name: 'league', in: 'query', schema: { type: 'string' } },
            {
              name: 'state',
              in: 'query',
              description: 'PRE, LIVE, HT, FT, ET, PEN, POSTPONED, SUSPENDED',
              schema: { type: 'string' },
            },
            { name: 'team', in: 'query', schema: { type: 'string' } },
            { name: 'live', in: 'query', schema: { type: 'boolean' } },
            { name: 'refresh', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: { '200': { description: 'Scoreboard del día ordenado por prioridad' } },
        },
      },
      '/api/v1/matches/{id}': {
        get: {
          summary: 'Gamecenter + Summary completo fusionado de un partido',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'ID unificado (pm:eiggbcj, espn:401926286) o ID directo',
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'Alineaciones, estadísticas, eventos, relato, H2H y cuotas' } },
        },
      },
      '/api/v1/leagues': {
        get: {
          summary: 'Catálogo completo de ligas y copas (Promiedos + ESPN)',
          responses: { '200': { description: 'Categorías, ligas destacadas e IDs cruzados' } },
        },
      },
      '/api/v1/leagues/{id}': {
        get: {
          summary: 'Detalle completo de una liga (tablas, promedios, fixture, brackets y goleadores)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Slug canónico (liga-profesional, premier-league), ID Promiedos (hc, h) o slug ESPN (arg.1)',
              schema: { type: 'string' },
            },
            { name: 'round', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Detalle integral de liga' } },
        },
      },
      '/api/v1/leagues/{id}/standings': {
        get: {
          summary: 'Tablas de posiciones, promedios, anual y llaves de una liga',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Tablas y llaves' } },
        },
      },
      '/api/v1/leagues/{id}/rounds/{roundKey}': {
        get: {
          summary: 'Partidos de una fecha/ronda específica de una liga',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'roundKey', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Partidos de la jornada' } },
        },
      },
      '/api/v1/teams/{id}': {
        get: {
          summary: 'Perfil de club: plantel, estadio, estadísticas, últimos y próximos partidos',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'pm-igg, igg, espn-5 o 5',
              schema: { type: 'string' },
            },
            { name: 'league', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Perfil completo del equipo' } },
        },
      },
      '/api/v1/search': {
        get: {
          summary: 'Búsqueda unificada de clubes, ligas y partidos',
          parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Resultados coincidentes' } },
        },
      },
      '/api/v1/mappings': {
        get: {
          summary: 'Diccionario oficial de equivalencias Promiedos <-> ESPN',
          responses: { '200': { description: 'Lista de mapeos de ligas' } },
        },
      },
      '/api/v1/channels': {
        get: {
          summary: 'Diccionario oficial de canales de TV y streaming mapeados con IDs canónicos',
          parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
          responses: { '200': { description: 'Lista de canales TV con id canónico o null' } },
        },
        post: {
          summary: 'Crear o mapear un nuevo canal de TV con el ID de tu app',
          responses: { '201': { description: 'Canal guardado' }, '401': { description: 'ADMIN_TOKEN requerido' } },
        },
      },
      '/api/v1/channels/{slug}': {
        put: {
          summary: 'Editar el ID canónico, categoría o alias de un canal existente',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Canal actualizado' }, '401': { description: 'ADMIN_TOKEN requerido' } },
        },
        delete: {
          summary: 'Restaurar un canal editado a su valor por defecto o eliminar uno personalizado',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Override eliminado' } },
        },
      },
      '/api/v1/excluded-leagues': {
        get: {
          summary: 'Lista de ligas excluidas de la extracción en tu API',
          responses: { '200': { description: 'Ligas actualmente excluidas' } },
        },
        post: {
          summary: 'Excluir una liga para que no se extraiga ni aparezca en tu API',
          responses: { '201': { description: 'Liga excluida' }, '401': { description: 'ADMIN_TOKEN requerido' } },
        },
      },
      '/api/v1/excluded-leagues/{slug}': {
        delete: {
          summary: 'Volver a habilitar una liga previamente excluida',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Liga restaurada' } },
        },
      },
      '/api/v1/custom-logos': {
        get: {
          summary: 'Lista de logos personalizados (PNG/SVG) guardados en Firestore para equipos y ligas',
          responses: { '200': { description: 'Logos personalizados activos' } },
        },
        post: {
          summary: 'Guardar o actualizar un logo personalizado (PNG/SVG) por URL para un equipo o liga',
          responses: { '201': { description: 'Logo guardado' }, '401': { description: 'ADMIN_TOKEN requerido' } },
        },
      },
      '/api/v1/custom-logos/{key}': {
        delete: {
          summary: 'Eliminar un logo personalizado y restaurar el logo original de la API',
          parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Logo eliminado' } },
        },
      },
    },
  };
}

export function renderDashboardHtml(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Pivote Fútbol · Dashboard &amp; API</title>
<meta name="theme-color" content="#0B0D12">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0B0D12;--bg2:#12151D;--glass:rgba(255,255,255,.045);--line:rgba(255,255,255,.09);
  --tx:#EEF1F6;--mut:#8A93A6;--lime:#C8FF47;--red:#FF4D5E;--amber:#FFC247;--win:#35D07F;
  --r:22px;--sans:'Space Grotesk',system-ui,sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace;
  --side-w:276px;
}
*{box-sizing:border-box;margin:0}
html{background:var(--bg);color:var(--tx);font-family:var(--sans);-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:138px;overscroll-behavior-y:none}
body{min-height:100dvh;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
  background:radial-gradient(900px 420px at 85% -10%,rgba(200,255,71,.09),transparent 60%),var(--bg);-webkit-font-smoothing:antialiased}
button,input,select{font:inherit;color:inherit}
button,a,.card,.mini-card,.chip,.tab,.nav-item{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
button{cursor:pointer;background:none;border:0}
button:active,.card:active,.mini-card:active,.chip:active,.tab:active,.nav-item:active{transform:scale(0.975);transition:transform 100ms cubic-bezier(.2,0,0,1)}
a{color:inherit;text-decoration:none}
:focus-visible{outline:2px solid var(--lime);outline-offset:2px}
img{display:block}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:99px}
::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.28)}

/* Layout con Sidebar lateral (material translúcido) */
.layout{display:flex;min-height:100dvh}
.sidebar{position:fixed;inset:0 auto 0 0;width:var(--side-w);background:rgba(14,17,24,.82);
  backdrop-filter:saturate(180%) blur(22px);-webkit-backdrop-filter:saturate(180%) blur(22px);
  border-right:1px solid var(--line);display:flex;flex-direction:column;z-index:30;
  will-change:transform;transition:transform .34s cubic-bezier(.22,1,.36,1)}
.side-head{display:flex;align-items:center;justify-content:space-between;padding:20px 18px 14px;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:38px;height:38px;border-radius:12px;background:var(--lime);color:#0B0D12;display:grid;place-items:center;font-weight:700;font-size:19px;flex:none}
.brand h1{font-size:17px;font-weight:700;letter-spacing:-.025em}
.brand small{display:block;color:var(--mut);font-size:12px;margin-top:1px}
.side-scroll{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:14px 12px 28px;display:flex;flex-direction:column;gap:18px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.16) transparent}
.nav-sec-title{display:flex;align-items:center;justify-content:space-between;width:100%;padding:4px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}
.nav-sec-title svg{transition:rotate .2s;opacity:.7}
.nav-sec.shut .nav-sec-title svg{rotate:-90deg}
.nav-sec.shut .nav-items{display:none}
.nav-items{display:flex;flex-direction:column;gap:3px;margin-top:6px}
.nav-item{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:9px 11px;border-radius:13px;font-size:13.5px;color:var(--mut);text-align:left;transition:.16s}
.nav-item:hover{background:var(--glass);color:var(--tx)}
.nav-item.on{background:rgba(200,255,71,.12);color:var(--lime);font-weight:600}
.nav-left{display:flex;align-items:center;gap:9px;min-width:0}
.nav-left span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-ico{width:18px;height:18px;flex:none;object-fit:contain;color:var(--mut)}
.nav-item.on .nav-ico{color:var(--lime)}
.nav-dot{width:8px;height:8px;border-radius:50%;background:var(--red);flex:none;margin:0 5px;animation:pulse 1.4s infinite}
.ev-ico{display:inline-block;width:13px;height:13px;vertical-align:-2px;margin:0 5px;color:var(--lime)}
.ev-ico.sub{color:var(--mut)}
.tv-id{font-family:var(--mono);font-size:11px;padding:2px 6px;border-radius:6px;background:rgba(200,255,71,.14);color:var(--lime);border:1px solid rgba(200,255,71,.28)}
.tv-id.null{background:rgba(255,255,255,.05);color:var(--mut);border-color:var(--line)}
.ch-in,.ch-sel{padding:7px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--tx);font-size:12.5px}
.ch-in:focus,.ch-sel:focus{border-color:var(--lime);outline:none}
.ch-in.mono{font-family:var(--mono)}
.ch-toast{padding:10px 14px;border-radius:14px;border:1px solid rgba(200,255,71,.35);background:rgba(200,255,71,.1);color:var(--lime);font-size:13px;margin-bottom:12px}
.ch-toast.err{border-color:rgba(255,77,94,.4);background:rgba(255,77,94,.1);color:var(--red)}
.to-top{position:fixed;right:20px;bottom:calc(20px + env(safe-area-inset-bottom));z-index:20;width:42px;height:42px;border-radius:14px;
  border:1px solid var(--line);background:rgba(18,21,29,.84);backdrop-filter:saturate(180%) blur(18px);-webkit-backdrop-filter:saturate(180%) blur(18px);
  display:grid;place-items:center;color:var(--tx);opacity:0;pointer-events:none;transform:translateY(10px);transition:opacity .22s,transform .22s cubic-bezier(.22,1,.36,1)}
.to-top.show{opacity:1;pointer-events:auto;transform:translateY(0)}
.to-top:hover{border-color:var(--lime);color:var(--lime)}
.foot-tv{display:inline-flex;align-items:center;gap:5px;color:var(--tx);font-weight:500}
.foot-tv svg{width:13px;height:13px;color:var(--lime);flex:none}
.nav-badge{font-family:var(--mono);font-size:11px;padding:2px 7px;border-radius:99px;background:rgba(255,77,94,.18);color:var(--red);font-weight:700}
.nav-date-wrap{padding:6px 10px 2px}
.nav-date{width:100%;padding:8px 11px;border-radius:11px;border:1px solid var(--line);background:var(--bg);font-size:13px;color:var(--tx);color-scheme:dark}
.nav-date:focus{border-color:var(--lime);outline:none}
.side-foot{padding:12px 16px;border-top:1px solid var(--line);font-size:12px;color:var(--mut);display:flex;align-items:center;justify-content:space-between}
.side-backdrop{display:none;position:fixed;inset:0;background:rgba(5,6,9,.65);backdrop-filter:blur(4px);z-index:25}

.main-area{flex:1;margin-left:var(--side-w);min-width:0}
.wrap{max-width:1120px;margin:0 auto;padding:0 22px 84px}

/* Top bar */
header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:20px 0 8px;flex-wrap:wrap}
.head-left{display:flex;align-items:center;gap:12px}
.menu-btn{display:none;width:40px;height:40px;border-radius:13px;border:1px solid var(--line);background:var(--glass);place-items:center}
.crumb{font-size:13px;color:var(--mut)}
.crumb strong{color:var(--tx);font-weight:600}
.sync{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--mut)}
.pill{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:99px;border:1px solid var(--line);background:var(--glass);font-size:12.5px}
.pill.stale{color:var(--amber);border-color:rgba(255,194,71,.35)}
.pill.fresh{color:var(--lime);border-color:rgba(200,255,71,.3)}
.refresh{width:38px;height:38px;border-radius:13px;border:1px solid var(--line);background:var(--glass);display:grid;place-items:center;transition:transform .5s}
.refresh.spin{transform:rotate(360deg)}

/* Hero */
.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:22px 0 18px}
.hero h2{font-size:clamp(30px,5.2vw,54px);line-height:1.02;letter-spacing:-.04em;font-weight:700}
.hero h2 b{font-family:var(--mono);color:var(--lime);font-weight:700}
.hero p{color:var(--mut);margin-top:9px;font-size:15px}
.stats{display:flex;gap:10px;flex-wrap:wrap}
.stat{padding:11px 16px;border-radius:16px;border:1px solid var(--line);background:var(--glass);min-width:92px}
.stat b{display:block;font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:21px}
.stat span{font-size:12.5px;color:var(--mut)}

/* Barra sticky de filtros con material translúcido */
.bar{position:sticky;top:0;z-index:5;margin:0 -22px;padding:12px 22px;
  background:rgba(11,13,18,.76);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);
  border-bottom:1px solid rgba(255,255,255,.05);display:grid;gap:10px}
.search{position:relative}
.search input{width:100%;padding:12px 16px 12px 44px;border-radius:16px;border:1px solid var(--line);background:rgba(18,21,29,.88);outline:none;transition:border-color .16s}
.search input:focus{border-color:var(--lime)}
.search svg{position:absolute;left:15px;top:50%;translate:0 -50%;color:var(--mut)}
.chips{display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;scrollbar-width:none;padding-bottom:2px}
.chips::-webkit-scrollbar{display:none}
.chip{flex:none;scroll-snap-align:start;display:flex;align-items:center;gap:7px;padding:8px 14px;border-radius:99px;border:1px solid var(--line);background:var(--glass);font-size:13.5px;color:var(--mut);transition:background .16s,color .16s,border-color .16s,transform 100ms ease-out}
.chip img{width:18px;height:18px;object-fit:contain}
.chip.on{background:var(--lime);border-color:var(--lime);color:#0B0D12;font-weight:600}
.chip i{font-style:normal;font-family:var(--mono);font-size:12px;opacity:.75}

/* Ligas y tarjetas de partidos */
.league{margin-top:24px}
.lh{width:100%;display:flex;align-items:center;gap:12px;padding:8px 2px;text-align:left}
.lh .lg{width:30px;height:30px;object-fit:contain;flex:none}
.lh h3{font-size:17px;font-weight:600;letter-spacing:-.01em}
.lh small{color:var(--mut);font-size:13px;display:flex;align-items:center;gap:6px}
.lh small img{width:15px;height:11px;object-fit:cover;border-radius:2px}
.lh .sp{flex:1}
.lh .caret{transition:rotate .25s;color:var(--mut)}
.league.shut .caret{rotate:-90deg}
.league.shut .grid{display:none}
.open-lg{font-size:12px;padding:5px 10px;border-radius:99px;border:1px solid var(--line);background:var(--glass);color:var(--mut)}
.open-lg:hover{border-color:var(--lime);color:var(--lime)}
.badge{font-family:var(--mono);font-size:12px;padding:4px 9px;border-radius:99px;background:rgba(255,77,94,.14);color:var(--red)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;margin-top:10px}

.card{--c1:#888;--c2:#888;position:relative;text-align:left;width:100%;padding:16px 16px 14px;border-radius:var(--r);border:1px solid var(--line);
  background:radial-gradient(260px 120px at 0 0,color-mix(in srgb,var(--c1) 16%,transparent),transparent 70%),
             radial-gradient(260px 120px at 100% 0,color-mix(in srgb,var(--c2) 16%,transparent),transparent 70%),var(--glass);
  backdrop-filter:blur(12px);display:block;transition:border-color .15s,transform .15s}
.card:hover{border-color:rgba(200,255,71,.4);transform:translateY(-1px)}
.card.live{border-color:rgba(255,77,94,.35)}
.top{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--mut);margin-bottom:14px;gap:8px}
.st{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-size:12.5px;font-weight:700}
.st.live{color:var(--red)}
.st.live::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--red);animation:pulse 1.4s infinite}
.st.done{color:var(--mut)}.st.next{color:var(--lime)}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(255,77,94,.6)}100%{box-shadow:0 0 0 9px transparent}}
.match{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}
.team{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;min-width:0}
.team .nm{font-size:14.5px;font-weight:600;line-height:1.2;overflow-wrap:anywhere}
.tl,.ph{width:50px;height:50px;object-fit:contain}
.ph{display:grid;place-items:center;border-radius:15px;background:var(--bg2);border:1px solid var(--line);font-family:var(--mono);font-size:13px;font-weight:700}
.score{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:700;font-size:clamp(26px,6.5vw,36px);letter-spacing:-.04em;white-space:nowrap;text-align:center}
.score em{font-style:normal;color:var(--mut);margin:0 4px}
.score.t{font-size:24px;color:var(--lime)}
.pen-sc{display:block;font-size:12px;color:var(--amber);margin-top:2px}
.red{display:inline-block;width:9px;height:12px;border-radius:2px;background:var(--red);margin-left:5px;vertical-align:middle}
.form{display:flex;gap:4px;justify-content:center}
.form span{width:17px;height:17px;border-radius:6px;font-size:10px;font-weight:700;display:grid;place-items:center;color:#0B0D12}
.form .G,.form .W{background:var(--win)}.form .E,.form .D{background:var(--amber)}.form .P,.form .L{background:var(--red)}
.foot{display:flex;justify-content:space-between;gap:8px;margin-top:14px;padding-top:11px;border-top:1px solid var(--line);font-size:12.5px;color:var(--mut)}
.foot span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scorers{margin-top:12px;font-size:12.5px;color:var(--mut);display:grid;grid-template-columns:1fr 1fr;gap:4px 14px}
.scorers div:nth-child(even){text-align:right}

/* Paneles genéricos (Tablas, Equipos, Catálogo, Explorador) */
.panel{border-radius:var(--r);border:1px solid var(--line);background:var(--glass);backdrop-filter:blur(12px);overflow:hidden;margin-top:16px}
.panel-head{padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.panel-head h3{font-size:17px;font-weight:700}
.panel-body{padding:16px 20px}
.table-wrap{overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
table.tbl{width:100%;border-collapse:collapse;font-size:13.5px}
.tbl th{text-align:left;padding:10px 10px;color:var(--mut);font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--line);white-space:nowrap}
.tbl td{padding:10px 10px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
.tbl tr:hover td{background:rgba(255,255,255,.03)}
.tbl .num{font-family:var(--mono);font-variant-numeric:tabular-nums;text-align:center}
.tbl .pts{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:700;color:var(--lime);text-align:center}
.team-link{display:inline-flex;align-items:center;gap:10px;font-weight:600;text-align:left}
.team-link:hover{color:var(--lime)}
.team-link img{width:24px;height:24px;object-fit:contain}
.qbar{display:inline-block;width:4px;height:20px;border-radius:4px;margin-right:8px;vertical-align:middle}
.legend{display:flex;gap:14px;flex-wrap:wrap;padding:12px 16px;font-size:12.5px;color:var(--mut);border-top:1px solid var(--line)}
.legend span{display:inline-flex;align-items:center;gap:6px}
.legend i{width:10px;height:10px;border-radius:3px;display:inline-block}

.tabs{display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;scrollbar-width:none;margin-top:12px;padding-bottom:4px}
.tabs::-webkit-scrollbar{display:none}
.tab{flex:none;scroll-snap-align:start;padding:9px 15px;border-radius:99px;border:1px solid var(--line);background:var(--glass);font-size:13.5px;color:var(--mut);white-space:nowrap}
.tab.on{background:var(--lime);border-color:var(--lime);color:#0B0D12;font-weight:700}

/* Cards de catálogo / clubes / brackets */
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:12px}
.mini-card{display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:16px;border:1px solid var(--line);background:var(--glass);text-align:left;transition:border-color .16s,transform 100ms ease-out}
.mini-card:hover{border-color:var(--lime);transform:translateY(-1px)}
.mini-card img{width:32px;height:32px;object-fit:contain;flex:none}
.mini-card strong{display:block;font-size:14px}
.mini-card small{color:var(--mut);font-size:12px}

/* Modal / Sheet de detalle con arrastre 1:1 y spring */
.ov{position:fixed;inset:0;z-index:40;background:rgba(5,6,9,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:none;align-items:flex-end;justify-content:center}
.ov.open{display:flex}
.sheet{width:min(720px,100%);max-height:92dvh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
  background:rgba(18,21,29,.94);backdrop-filter:saturate(180%) blur(24px);-webkit-backdrop-filter:saturate(180%) blur(24px);
  border:1px solid var(--line);border-radius:28px 28px 0 0;padding:10px 22px calc(28px + env(safe-area-inset-bottom));
  will-change:transform;animation:up .34s cubic-bezier(.22,1,.36,1)}
.sheet-handle{width:40px;height:4.5px;border-radius:99px;background:rgba(255,255,255,.24);margin:2px auto 12px;touch-action:none;cursor:grab}
@keyframes up{from{transform:translateY(48px);opacity:0}to{transform:translateY(0);opacity:1}}
@media(min-width:680px){.ov{align-items:center;padding:16px}.sheet{border-radius:28px;padding-top:18px}.sheet-handle{display:none}}
.sheet h4{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin:20px 0 10px}
.x{float:right;width:36px;height:36px;border-radius:12px;border:1px solid var(--line);display:grid;place-items:center}
.x:hover{border-color:var(--lime);color:var(--lime)}
.ev{display:grid;grid-template-columns:1fr 56px 1fr;align-items:center;gap:8px;padding:7px 0;font-size:13.5px;border-bottom:1px solid rgba(255,255,255,.04)}
.ev .m{font-family:var(--mono);font-size:12px;color:var(--lime);text-align:center;font-weight:700}
.ev .h{text-align:right}
.ev .a{text-align:left}
.cd{display:inline-block;width:9px;height:13px;border-radius:2px;vertical-align:-2px;margin:0 6px}
.cd.yellow{background:var(--amber)}.cd.red,.cd.second_yellow{background:var(--red)}
.odds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.odds div{padding:12px;border-radius:16px;border:1px solid var(--line);text-align:center;background:var(--glass)}
.odds b{display:block;font-family:var(--mono);font-size:18px;color:var(--lime)}
.odds span{font-size:12.5px;color:var(--mut)}
.tv{display:flex;gap:8px;flex-wrap:wrap}
.tv span{display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:12px;border:1px solid var(--line);background:var(--glass);font-size:13.5px}
.tv img{width:22px;height:22px;object-fit:contain;border-radius:5px}
.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;font-size:13.5px}
.kv div{padding:11px 13px;border-radius:14px;border:1px solid var(--line);background:var(--glass)}
.kv small{display:block;color:var(--mut);font-size:12px;margin-bottom:2px}
.muted{color:var(--mut);font-size:13.5px}

/* Barras de estadísticas */
.stat-row{margin-bottom:12px}
.stat-vals{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px}
.stat-vals b{font-family:var(--mono)}
.stat-track{display:flex;height:7px;border-radius:99px;overflow:hidden;background:rgba(255,255,255,.07);gap:2px}
.stat-h{background:var(--lime)}
.stat-a{background:var(--amber)}

/* Alineaciones */
.lineups-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:600px){.lineups-grid{grid-template-columns:1fr}}
.lu-box{border:1px solid var(--line);border-radius:16px;padding:12px 14px;background:var(--glass)}
.lu-player{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px}
.lu-player:last-child{border-bottom:0}
.lu-num{font-family:var(--mono);color:var(--lime);min-width:26px;font-weight:700}

/* Código / JSON Explorer */
pre.json{margin:0;padding:16px;font-family:var(--mono);font-size:12px;overflow:auto;max-height:540px;background:#080a0f;color:#c5e4fd;border-radius:16px;border:1px solid var(--line);line-height:1.55}
.ep-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.btn-lime{padding:9px 16px;border-radius:12px;background:var(--lime);color:#0B0D12;font-weight:700;font-size:13.5px}
.btn-ghost{padding:8px 13px;border-radius:12px;border:1px solid var(--line);background:var(--glass);font-size:13px;color:var(--tx)}
.btn-ghost:hover{border-color:var(--lime);color:var(--lime)}

/* Estados */
.note{margin-top:14px;padding:12px 16px;border-radius:16px;font-size:14px;border:1px solid rgba(255,194,71,.35);background:rgba(255,194,71,.08);color:var(--amber)}
.empty{padding:56px 20px;text-align:center;color:var(--mut)}
.empty b{display:block;color:var(--tx);font-size:18px;margin-bottom:6px}
.empty button{margin-top:16px;padding:10px 18px;border-radius:14px;background:var(--lime);color:#0B0D12;font-weight:600}
.sk{height:178px;border-radius:var(--r);background:linear-gradient(100deg,var(--glass) 30%,rgba(255,255,255,.09) 50%,var(--glass) 70%) 0 0/300% 100%;animation:sh 1.3s infinite}
@keyframes sh{to{background-position:-100% 0}}
.in .card{animation:in .45s both;animation-delay:calc(var(--i)*35ms)}
@keyframes in{from{opacity:0;translate:0 12px}}

/* Responsive Sidebar & Mobile Polish */
@media(max-width:960px){
  .sidebar{transform:translateX(-100%)}
  .sidebar.open{transform:translateX(0)}
  .side-backdrop.open{display:block}
  #sideClose{display:grid!important}
  .main-area{margin-left:0}
  .menu-btn{display:grid}
}
@media(max-width:520px){
  .grid{grid-template-columns:1fr}
  .wrap{padding:0 14px 84px}
  .bar{margin:0 -14px;padding:10px 14px}
  .hero{padding:16px 0 14px;gap:14px}
  .stat{flex:1;min-width:74px;padding:10px 12px}
  .panel-head,.panel-body{padding:14px}
  .ep-row>*{min-width:0}
  .ep-row .btn-lime,.ep-row .btn-ghost{width:100%}
  .sheet{padding:10px 16px calc(24px + env(safe-area-inset-bottom))}
  .crumb{max-width:58vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
@media(max-width:380px){
  .tl,.ph{width:42px;height:42px}
  .score{font-size:clamp(22px,6.5vw,30px)}
  .team .nm{font-size:13.5px}
}
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important}
}
</style>
</head>
<body>
<div class="layout">
  <div class="side-backdrop" id="sideBg"></div>
  <aside class="sidebar" id="sidebar" aria-label="Menú lateral">
    <div class="side-head">
      <a href="#today" class="brand" data-nav="matches:today">
        <div class="logo">P</div>
        <div><h1>Pivote Fútbol</h1><small>API PRO-PIVO v1</small></div>
      </a>
      <button class="x" id="sideClose" style="display:none" aria-label="Cerrar menú">✕</button>
    </div>

    <div class="side-scroll">
      <div class="nav-sec" data-sec="partidos">
        <button class="nav-sec-title" type="button"><span>Partidos</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="nav-items">
          <button class="nav-item" data-nav="matches:live"><span class="nav-left"><span class="nav-dot"></span><span>En vivo ahora</span></span><span class="nav-badge" id="sideLiveBadge">0</span></button>
          <button class="nav-item on" data-nav="matches:today"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>Agenda de hoy</span></span></button>
          <button class="nav-item" data-nav="matches:yesterday"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/></svg><span>Resultados de ayer</span></span></button>
          <button class="nav-item" data-nav="matches:tomorrow"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m13 17 5-5-5-5M6 17l5-5-5-5"/></svg><span>Próximos (mañana)</span></span></button>
          <div class="nav-date-wrap">
            <input class="nav-date" type="date" id="sideDatePick" title="Ir a una fecha específica">
          </div>
        </div>
      </div>

      <div class="nav-sec" data-sec="ligas">
        <button class="nav-sec-title" type="button"><span>Ligas &amp; Tablas</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="nav-items">
          <button class="nav-item" data-nav="league:liga-profesional"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/hc/4" alt="" loading="lazy"><span>Liga Profesional</span></span></button>
          <button class="nav-item" data-nav="league:copa-argentina"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/gea/4" alt="" loading="lazy"><span>Copa Argentina</span></span></button>
          <button class="nav-item" data-nav="league:primera-nacional"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/ebj/4" alt="" loading="lazy"><span>Primera Nacional</span></span></button>
          <button class="nav-item" data-nav="league:copa-libertadores"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/bac/4" alt="" loading="lazy"><span>Copa Libertadores</span></span></button>
          <button class="nav-item" data-nav="league:copa-sudamericana"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/dij/4" alt="" loading="lazy"><span>Copa Sudamericana</span></span></button>
          <button class="nav-item" data-nav="league:champions-league"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/fhc/4" alt="" loading="lazy"><span>Champions League</span></span></button>
          <button class="nav-item" data-nav="league:premier-league"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/h/4" alt="" loading="lazy"><span>Premier League</span></span></button>
          <button class="nav-item" data-nav="league:laliga"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/bb/4" alt="" loading="lazy"><span>LaLiga</span></span></button>
          <button class="nav-item" data-nav="league:serie-a"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/bh/4" alt="" loading="lazy"><span>Serie A</span></span></button>
          <button class="nav-item" data-nav="league:bundesliga"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/cf/4" alt="" loading="lazy"><span>Bundesliga</span></span></button>
          <button class="nav-item" data-nav="league:brasileirao"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/league/bbd/4" alt="" loading="lazy"><span>Brasileirão</span></span></button>
          <button class="nav-item" data-nav="catalog"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg><span>Todas las ligas (190+)</span></span></button>
        </div>
      </div>

      <div class="nav-sec" data-sec="clubes">
        <button class="nav-sec-title" type="button"><span>Clubes &amp; Búsqueda</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="nav-items">
          <button class="nav-item" data-nav="search"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Buscador global</span></span></button>
          <button class="nav-item" data-nav="team:pm-igg"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/team/igg/4" alt="" loading="lazy"><span>Boca Juniors</span></span></button>
          <button class="nav-item" data-nav="team:pm-igj"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/team/igj/4" alt="" loading="lazy"><span>River Plate</span></span></button>
          <button class="nav-item" data-nav="team:pm-igh"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/team/igh/4" alt="" loading="lazy"><span>Racing Club</span></span></button>
          <button class="nav-item" data-nav="team:pm-igd"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/team/igd/4" alt="" loading="lazy"><span>Independiente</span></span></button>
          <button class="nav-item" data-nav="team:pm-igf"><span class="nav-left"><img class="nav-ico" src="https://api.promiedos.com.ar/images/team/igf/4" alt="" loading="lazy"><span>San Lorenzo</span></span></button>
        </div>
      </div>

      <div class="nav-sec" data-sec="api">
        <button class="nav-sec-title" type="button"><span>API &amp; Sistema</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="nav-items">
          <button class="nav-item" data-nav="explorer"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></svg><span>Explorador JSON</span></span></button>
          <button class="nav-item" data-nav="channels"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="m17 2-5 5-5-5"/></svg><span>Canales TV (Mapeo)</span></span></button>
          <button class="nav-item" data-nav="custom-logos"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span>Logos Personalizados</span></span><span class="nav-badge" id="sideLogosBadge" style="display:none;background:rgba(200,255,71,.16);color:var(--lime)">0</span></button>
          <button class="nav-item" data-nav="excluded-leagues"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m4.93 4.93 14.14 14.14"/></svg><span>Ligas Excluidas</span></span><span class="nav-badge" id="sideExclBadge" style="display:none">0</span></button>
          <button class="nav-item" data-nav="mappings"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>Mapeos de Ligas</span></span></button>
          <button class="nav-item" data-nav="health"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><span>Salud &amp; Caché</span></span></button>
          <a class="nav-item" href="${cleanBase}/openapi.json" target="_blank"><span class="nav-left"><svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><span>OpenAPI 3.1 JSON ↗</span></span></a>
        </div>
      </div>
    </div>

    <div class="side-foot">
      <span>Promiedos API</span>
      <span id="sideVersion">v1.0.0</span>
    </div>
  </aside>

  <div class="main-area">
    <div class="wrap">
      <header>
        <div class="head-left">
          <button class="menu-btn" id="menuBtn" aria-label="Abrir menú">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div class="crumb" id="crumb">Partidos · <strong>Agenda de hoy</strong></div>
        </div>
        <div class="sync">
          <span id="sync" class="pill">Conectando…</span>
          <button class="refresh" id="rf" aria-label="Actualizar ahora">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
          </button>
        </div>
      </header>

      <div id="viewRoot"></div>
    </div>
  </div>
</div>

<div class="ov" id="ov" role="dialog" aria-modal="true"><div class="sheet" id="sheet"></div></div>
<button class="to-top" id="toTop" aria-label="Volver arriba" title="Volver arriba"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m18 15-6-6-6 6"/></svg></button>

<script>
const REFRESH_MS = 30000;
const STATUS_ES = {'First Half':'Primer Tiempo','Second Half':'Segundo Tiempo','Halftime':'Entretiempo','Full Time':'Finalizado','En progreso':'En juego','Scheduled':'Programado'};
const ICO_GOAL = '<svg class="ev-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m12 7 3 2.5-1 3.5h-4L9 9.5Z"/></svg>';
const ICO_SUB = '<svg class="ev-ico sub" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m7 10 5-5 5 5M17 14l-5 5-5-5"/></svg>';
const ICO_TV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="m17 2-5 5-5-5"/></svg>';

const S = {
  view: 'matches', // matches | league | catalog | team | search | explorer | mappings | health
  dateMode: 'today', // live | today | yesterday | tomorrow | YYYY-MM-DD
  leagueId: 'liga-profesional',
  leagueTab: 'standings', // standings | matches | brackets | leaders
  teamId: 'pm-igg',
  teamTab: 'squad', // squad | matches | stats
  status: 'all',
  leagueFilter: 'all',
  q: '',
  shut: new Set(),
  leagues: [],
  meta: {},
  summary: null,
  leagueData: null,
  teamData: null,
  catalogData: null,
  searchData: null,
  mappingsData: null,
  healthData: null,
  explorerPath: '/api/v1/matches?date=today',
  explorerJson: '',
  first: true,
  sheetMatch: null,
  sheetDetail: null,
  sheetTab: 'summary',
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kind = (m) => m.status?.isLive ? 'live' : m.status?.isFinished ? 'done' : 'next';
const stLabel = (m) => STATUS_ES[m.status?.label] || m.status?.label || '';

function leagueName(l, ms = []) {
  let n = l?.name || 'Liga';
  if (/^[a-z0-9-]+$/.test(n)) {
    n = n.replace(/^\\d{4}-\\d{2,4}-?/, '');
    if (!n || n === 'regular-season') return ms[0]?.stageRound || 'Liga';
    n = n.split('-').map((w) => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
  }
  return n;
}
const img = (src, cls = '', alt = '') => src ? '<img class="' + cls + '" src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" onerror="this.style.visibility=\\'hidden\\'">' : '';
const logo = (t, cls = 'tl') => t?.logo
  ? '<img class="' + cls + '" src="' + esc(t.logo) + '" alt="" loading="lazy" onerror="this.outerHTML=\\'<span class=&quot;ph&quot;>' + esc(t.abbreviation || t.shortName?.slice(0,3) || '?') + '</span>\\'">'
  : '<span class="ph">' + esc(t?.abbreviation || t?.shortName?.slice(0,3) || '?') + '</span>';
const formDots = (f) => f ? '<div class="form" title="Últimos 5 partidos">' + [...f].map((c) => '<span class="' + esc(c) + '">' + esc(c) + '</span>').join('') + '</div>' : '';

async function apiGet(path) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 14000);
  try {
    const r = await fetch(path, { cache: 'no-store', signal: ctl.signal });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  } finally {
    clearTimeout(to);
  }
}

function updateSyncPill(meta) {
  const d = meta?.generatedAt ? new Date(meta.generatedAt) : new Date();
  const c = meta?.cache;
  $('#sync').className = 'pill ' + (c === 'STALE' ? 'stale' : 'fresh');
  $('#sync').textContent = (c === 'STALE' ? 'Caché SWR' : 'Al día') + ' · ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
}

function updateSidebarActive(key) {
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('on', el.dataset.nav === key);
  });
}

function toggleDrawer(forceOpen) {
  const sb = $('#sidebar');
  const bg = $('#sideBg');
  const open = typeof forceOpen === 'boolean' ? forceOpen : !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  bg.classList.toggle('open', open);
  document.body.style.overflow = open && window.innerWidth <= 960 ? 'hidden' : '';
}

/* ===== Navegación central ===== */
async function navigate(target, manual = false) {
  const [section, param] = target.split(':');
  S.view = section;
  updateSidebarActive(target);
  if (window.innerWidth <= 960) toggleDrawer(false);

  const btn = $('#rf');
  if (manual) { btn.classList.add('spin'); setTimeout(() => btn.classList.remove('spin'), 600); }

  if (section === 'matches') {
    S.dateMode = param || 'today';
    S.leagueFilter = 'all';
    const labels = { live: 'En vivo ahora', today: 'Agenda de hoy', yesterday: 'Resultados de ayer', tomorrow: 'Mañana' };
    $('#crumb').innerHTML = 'Partidos · <strong>' + esc(labels[S.dateMode] || S.dateMode) + '</strong>';
    await loadMatches(manual);
  } else if (section === 'league') {
    S.leagueId = param || 'liga-profesional';
    S.leagueTab = 'standings';
    $('#crumb').innerHTML = 'Ligas &amp; Tablas · <strong>' + esc(S.leagueId) + '</strong>';
    await loadLeague(S.leagueId, undefined, manual);
  } else if (section === 'catalog') {
    $('#crumb').innerHTML = 'Ligas &amp; Tablas · <strong>Catálogo completo</strong>';
    await loadCatalog(manual);
  } else if (section === 'team') {
    S.teamId = param || 'pm-igg';
    S.teamTab = 'squad';
    $('#crumb').innerHTML = 'Clubes · <strong>Perfil</strong>';
    await loadTeam(S.teamId, manual);
  } else if (section === 'search') {
    $('#crumb').innerHTML = 'Descubrir · <strong>Buscador global</strong>';
    renderSearchView();
  } else if (section === 'explorer') {
    $('#crumb').innerHTML = 'API &amp; Sistema · <strong>Explorador JSON</strong>';
    renderExplorerView();
    if (!S.explorerJson) runExplorer(S.explorerPath);
  } else if (section === 'mappings') {
    $('#crumb').innerHTML = 'API &amp; Sistema · <strong>Diccionario de mapeos</strong>';
    await loadMappings();
  } else if (section === 'channels') {
    $('#crumb').innerHTML = 'API &amp; Sistema · <strong>Canales TV</strong>';
    await loadChannels(param || '');
  } else if (section === 'custom-logos') {
    $('#crumb').innerHTML = 'API &amp; Sistema · <strong>Logos Personalizados</strong>';
    await loadCustomLogos();
  } else if (section === 'excluded-leagues') {
    $('#crumb').innerHTML = 'API &amp; Sistema · <strong>Ligas Excluidas</strong>';
    await loadExcludedLeagues();
  } else if (section === 'health') {
    $('#crumb').innerHTML = 'API &amp; Sistema · <strong>Salud &amp; Caché</strong>';
    await loadHealth();
  }
}

/* ===== Vista: Partidos ===== */
async function loadMatches(refresh = false) {
  const root = $('#viewRoot');
  if (S.first) {
    root.innerHTML = '<section class="hero"><div><h2>Cargando partidos</h2><p>&nbsp;</p></div></section><div class="grid">' + '<div class="sk"></div>'.repeat(6) + '</div>';
  }
  const qs = refresh ? '&refresh=true' : '';
  const path = S.dateMode === 'live'
    ? '/api/v1/live?' + qs.slice(1)
    : '/api/v1/matches?date=' + encodeURIComponent(S.dateMode) + qs;
  try {
    const j = await apiGet(path);
    S.leagues = j.data.leagues || [];
    S.summary = j.data.summary;
    S.meta = j.meta || {};
    if (S.dateMode === 'today' || S.dateMode === 'live') {
      $('#sideLiveBadge').textContent = S.summary?.liveMatches ?? 0;
    }
    updateSyncPill(S.meta);
    renderMatchesView();
  } catch (e) {
    root.innerHTML = '<div class="note">Error cargando partidos: ' + esc(e.message) + '</div>';
  }
}

function allMatches() { return S.leagues.flatMap((g) => g.matches); }

function visibleLeagues() {
  const q = S.q.trim().toLowerCase();
  return S.leagues.map((g) => {
    const nm = leagueName(g.league, g.matches);
    const ms = g.matches.filter((m) =>
      (S.status === 'all' || kind(m) === S.status) &&
      (!q || [m.home.name, m.away.name, m.home.abbreviation, m.away.abbreviation, nm].join(' ').toLowerCase().includes(q))
    );
    return { g, nm, ms };
  }).filter((x) => x.ms.length && (S.leagueFilter === 'all' || x.g.league.id === S.leagueFilter));
}

function renderMatchesView() {
  const all = allMatches();
  const live = all.filter((m) => kind(m) === 'live').length;
  const done = all.filter((m) => kind(m) === 'done').length;
  const next = all.length - live - done;
  const heroTitle = S.dateMode === 'live'
    ? (live ? '<b>' + live + '</b> ' + (live === 1 ? 'partido' : 'partidos') + ' en vivo' : 'Sin partidos en vivo')
    : (live ? '<b>' + live + '</b> en juego · ' + all.length + ' hoy' : (all.length ? '<b>' + all.length + '</b> partidos programados' : 'Sin partidos para esta fecha'));

  const sf = [['all','Todos',all.length],['live','En vivo',live],['done','Finalizados',done],['next','Próximos',next]];
  const v = visibleLeagues();
  let idx = 0;

  $('#viewRoot').innerHTML =
    '<section class="hero"><div><h2>' + heroTitle + '</h2><p>' + all.length + ' partidos en ' + S.leagues.length + ' ' + (S.leagues.length === 1 ? 'liga' : 'ligas') + ' · hora de Argentina</p></div>' +
    '<div class="stats">' + [['Total', all.length], ['En vivo', live], ['Finalizados', done], ['Próximos', next]].map(([l, n]) => '<div class="stat"><b>' + n + '</b><span>' + l + '</span></div>').join('') + '</div></section>' +
    '<div class="bar">' +
      '<label class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input id="qInput" type="search" value="' + esc(S.q) + '" placeholder="Buscar equipo o liga en esta fecha..." autocomplete="off"></label>' +
      '<div class="chips">' + sf.map(([k, l, n]) => '<button class="chip ' + (S.status === k ? 'on' : '') + '" data-s="' + k + '">' + l + ' <i>' + n + '</i></button>').join('') + '</div>' +
      '<div class="chips"><button class="chip ' + (S.leagueFilter === 'all' ? 'on' : '') + '" data-lf="all">Todas las ligas</button>' +
        S.leagues.map((g) => '<button class="chip ' + (S.leagueFilter === g.league.id ? 'on' : '') + '" data-lf="' + esc(g.league.id) + '">' + img(g.league.logo) + esc(leagueName(g.league, g.matches)) + '</button>').join('') +
      '</div>' +
    '</div>' +
    '<main id="list" class="' + (S.first ? 'in' : '') + '">' +
      (v.length ? v.map(({ g, nm, ms }) => {
        const lv = ms.filter((m) => kind(m) === 'live').length;
        const id = g.league.id;
        return '<section class="league ' + (S.shut.has(id) ? 'shut' : '') + '">' +
          '<div class="lh">' +
            '<button class="lh" style="padding:0;flex:1" data-t="' + esc(id) + '" aria-expanded="' + (!S.shut.has(id)) + '">' +
              img(g.league.logo, 'lg') +
              '<div><h3>' + esc(nm) + '</h3><small>' + (g.league.countryFlag ? img(g.league.countryFlag) : '') + esc(g.league.countryName || '') + '</small></div>' +
              '<span class="sp"></span>' +
              (lv ? '<span class="badge">' + lv + ' en vivo</span>' : '') +
              '<svg class="caret" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>' +
            '</button>' +
            '<button class="open-lg" data-nav="league:' + esc(g.league.canonicalSlug || id) + '">Ver tabla →</button>' +
          '</div>' +
          '<div class="grid">' + ms.map((m) => renderMatchCard(m, idx++)).join('') + '</div>' +
        '</section>';
      }).join('') : '<div class="empty"><b>No hay partidos con estos filtros</b>Probá cambiando la búsqueda o eligiendo otra fecha.<br><button data-reset>Limpiar filtros</button></div>') +
    '</main>';

  S.first = false;
  const qi = $('#qInput');
  if (qi) {
    qi.addEventListener('input', (e) => { S.q = e.target.value; renderMatchesView(); const el = $('#qInput'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  }
}

function renderMatchCard(m, i) {
  const k = kind(m), h = m.home, a = m.away, st = m.status || {};
  const pen = (h.penaltyScore != null && a.penaltyScore != null) ? '<span class="pen-sc">(' + h.penaltyScore + '-' + a.penaltyScore + ' pen)</span>' : '';
  const mid = k === 'next'
    ? '<div class="score t">' + esc(m.timeLocalAr || '--:--') + '</div>'
    : '<div class="score">' + (h.score ?? 0) + '<em>-</em>' + (a.score ?? 0) + pen + '</div>';
  const stx = k === 'live' ? (esc(st.minuteDisplay || '') + ' ' + esc(stLabel(m))) : k === 'done' ? (st.state === 'PEN' ? 'Penales' : 'Finalizado') : (esc(m.dateLocalAr || '') + ' ' + esc(m.timeLocalAr || ''));
  const sc = (side) => (m.goals || []).filter((g) => g.teamSide === side).map((g) => '<span>' + ICO_GOAL + esc(g.playerShortName || g.playerName) + ' ' + esc(g.minuteDisplay || (g.minute + "'")) + '</span>').join('<br>');
  const gs = (m.goals || []).length ? '<div class="scorers"><div>' + sc('home') + '</div><div>' + sc('away') + '</div></div>' : '';
  const rc = (t) => t.redCards ? '<span class="red" title="Expulsados: ' + t.redCards + '"></span>' : '';

  const tvNames = (m.broadcasts || []).map((b) => b.name).slice(0, 2).join(', ');
  return '<button class="card ' + k + '" style="--c1:' + esc(h.colors?.primary || '#888') + ';--c2:' + esc(a.colors?.primary || '#888') + ';--i:' + i + '" data-m="' + esc(m.id) + '">' +
    '<div class="top"><span class="st ' + k + '">' + stx + '</span><span>' + esc(m.stageRound || '') + '</span></div>' +
    '<div class="match">' +
      '<div class="team">' + logo(h) + '<span class="nm">' + esc(h.shortName || h.name) + rc(h) + '</span>' + formDots(h.form) + '</div>' +
      mid +
      '<div class="team">' + logo(a) + '<span class="nm">' + esc(a.shortName || a.name) + rc(a) + '</span>' + formDots(a.form) + '</div>' +
    '</div>' +
    gs +
    '<div class="foot"><span>' + esc(m.venue?.name || 'Estadio a confirmar') + '</span>' + (tvNames ? '<span class="foot-tv">' + ICO_TV + esc(tvNames) + '</span>' : '<span></span>') + '</div>' +
  '</button>';
}

/* ===== Modal / Sheet de Detalle Completo de Partido ===== */
async function openMatch(id) {
  const m = allMatches().find((x) => String(x.id) === id)
    || (S.leagueData?.matches || []).find((x) => String(x.id) === id)
    || (S.teamData?.matches?.all || []).find((x) => String(x.id) === id)
    || (S.searchData?.matches || []).find((x) => String(x.id) === id);

  S.sheetMatch = m || { id, home: { name: 'Local', shortName: 'LOC', score: null }, away: { name: 'Visitante', shortName: 'VIS', score: null }, status: {} };
  S.sheetDetail = null;
  S.sheetTab = 'summary';
  renderSheet();
  $('#ov').classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const res = await apiGet('/api/v1/matches/' + encodeURIComponent(id));
    S.sheetDetail = res.data;
    S.sheetMatch = res.data.match;
    renderSheet();
  } catch (e) {
    console.warn('Detail load:', e);
  }
}

function renderSheet() {
  const m = S.sheetMatch;
  if (!m) return;
  const det = S.sheetDetail;
  const k = kind(m), h = m.home, a = m.away;
  const loadingBadge = !det ? '<span class="pill stale" style="font-size:11px;padding:3px 9px">Cargando Gamecenter completo…</span>' : '<span class="pill fresh" style="font-size:11px;padding:3px 9px">' + esc((m.sources || []).join(' + ').toUpperCase()) + '</span>';

  const headerHtml =
    '<div class="sheet-handle" id="sheetHandle" aria-hidden="true"></div>' +
    '<button class="x" data-close aria-label="Cerrar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + loadingBadge + '<span class="muted">' + esc(leagueName(m.league || {})) + (m.stageRound ? ' · ' + esc(m.stageRound) : '') + '</span></div>' +
    '<div class="match" style="margin-top:18px">' +
      '<div class="team" style="cursor:pointer" data-nav="team:' + esc(h.id) + '" data-close-go>' + logo(h) + '<span class="nm">' + esc(h.name) + '</span>' + (h.record ? '<small class="muted">' + esc(h.record) + '</small>' : '') + formDots(h.form) + '</div>' +
      (k === 'next' ? '<div class="score t">' + esc(m.timeLocalAr || '--:--') + '</div>' : '<div class="score">' + (h.score ?? 0) + '<em>-</em>' + (a.score ?? 0) + ((h.penaltyScore != null && a.penaltyScore != null) ? '<span class="pen-sc">Pen: ' + h.penaltyScore + '-' + a.penaltyScore + '</span>' : '') + '</div>') +
      '<div class="team" style="cursor:pointer" data-nav="team:' + esc(a.id) + '" data-close-go>' + logo(a) + '<span class="nm">' + esc(a.name) + '</span>' + (a.record ? '<small class="muted">' + esc(a.record) + '</small>' : '') + formDots(a.form) + '</div>' +
    '</div>' +
    '<p class="muted" style="text-align:center;margin-top:10px">' + (k === 'live' ? '<span class="st live">' + esc(m.status?.minuteDisplay || '') + ' ' + esc(stLabel(m)) + '</span>' : k === 'done' ? 'Finalizado' : 'Empieza ' + esc(m.timeLocalAr || '') + ' (AR)') + '</p>' +
    '<div class="tabs">' +
      [['summary','Resumen'],['stats','Estadísticas'],['lineups','Alineaciones'],['relato','Relato &amp; Previa']].map(([tk, tl]) =>
        '<button class="tab ' + (S.sheetTab === tk ? 'on' : '') + '" data-stab="' + tk + '">' + tl + '</button>'
      ).join('') +
    '</div>';

  let bodyHtml = '';
  if (S.sheetTab === 'summary') {
    const events = det?.events?.length ? det.events : [
      ...(m.goals || []).map((g) => ({ type: g.isOwnGoal ? 'own_goal' : g.isPenalty ? 'penalty_goal' : 'goal', teamSide: g.teamSide, playerName: g.playerName, secondaryPlayerName: g.assistName, minute: g.minute, minuteDisplay: g.minuteDisplay })),
      ...(m.cards || []).map((c) => ({ type: c.cardType === 'yellow' ? 'yellow_card' : c.cardType === 'second_yellow' ? 'second_yellow' : 'red_card', teamSide: c.teamSide, playerName: c.playerName, minute: c.minute, minuteDisplay: c.minuteDisplay })),
    ].sort((x, y) => (x.minute || 0) - (y.minute || 0));

    const fmtEv = (e) => {
      if (e.type === 'goal' || e.type === 'penalty_goal' || e.type === 'own_goal' || e.type === 'penalty_shootout_goal') {
        return ICO_GOAL + esc(e.playerName || 'Gol') + (e.type === 'penalty_goal' ? ' (p)' : e.type === 'own_goal' ? ' (e/c)' : '') + (e.secondaryPlayerName ? ' <span class="muted">(asist. ' + esc(e.secondaryPlayerName) + ')</span>' : '');
      }
      if (e.type === 'yellow_card' || e.type === 'red_card' || e.type === 'second_yellow') {
        return '<span class="cd ' + esc(e.type.replace('_card', '')) + '"></span>' + esc(e.playerName || 'Tarjeta');
      }
      if (e.type === 'substitution') {
        return ICO_SUB + '<b>' + esc(e.playerName || '') + '</b>' + (e.secondaryPlayerName ? ' <span class="muted">por ' + esc(e.secondaryPlayerName) + '</span>' : '');
      }
      return esc(e.description || e.playerName || e.type);
    };

    const tl = events.length
      ? events.map((e) => '<div class="ev"><div class="h">' + (e.teamSide === 'home' ? fmtEv(e) : '') + '</div><div class="m">' + esc(e.minuteDisplay || (e.minute != null ? e.minute + "'" : '•')) + '</div><div class="a">' + (e.teamSide === 'away' ? fmtEv(e) : '') + '</div></div>').join('')
      : '<p class="muted">' + (k === 'next' ? 'El partido todavía no comenzó.' : 'Sin eventos registrados.') + '</p>';

    const ml = m.odds?.moneyline;
    const odds = ml ? '<h4>Cuotas 1X2</h4><div class="odds"><div><b>' + esc(ml.home ?? '-') + '</b><span>' + esc(h.shortName) + '</span></div><div><b>' + esc(ml.draw ?? '-') + '</b><span>Empate</span></div><div><b>' + esc(ml.away ?? '-') + '</b><span>' + esc(a.shortName) + '</span></div></div>' : '';
    const tv = (m.broadcasts || []).length ? '<h4>Dónde verlo</h4><div class="tv">' + m.broadcasts.map((b) => '<span>' + img(b.logo) + esc(b.name) + '<code class="tv-id ' + (b.id ? '' : 'null') + '">' + esc(b.id ?? 'null') + '</code><button type="button" class="btn-ghost" style="padding:2px 7px;font-size:11px" data-nav="channels:' + esc(b.name) + '" data-close-go title="Editar ID de este canal">Editar</button></span>').join('') + '</div>' : '';
    const infoList = det?.gameInfo?.length ? det.gameInfo : (m.venue?.name ? [{ label: 'Estadio', value: [m.venue.name, m.venue.city, m.venue.country].filter(Boolean).join(', ') }] : []);
    const infoHtml = infoList.length ? '<h4>Ficha del partido</h4><div class="kv">' + infoList.map((i) => '<div><small>' + esc(i.label) + '</small>' + esc(i.value) + '</div>').join('') + '</div>' : '';

    bodyHtml = '<h4>Cronología</h4>' + tl +
      '<h4>Tarjetas</h4><div class="kv"><div><small>' + esc(h.shortName) + '</small><span class="cd yellow"></span>' + (h.yellowCards || 0) + ' &nbsp; <span class="cd red"></span>' + (h.redCards || 0) + '</div><div><small>' + esc(a.shortName) + '</small><span class="cd yellow"></span>' + (a.yellowCards || 0) + ' &nbsp; <span class="cd red"></span>' + (a.redCards || 0) + '</div></div>' +
      odds + tv + infoHtml;
  } else if (S.sheetTab === 'stats') {
    const stats = det?.statistics || [];
    bodyHtml = stats.length
      ? '<h4>Estadísticas comparativas</h4>' + stats.map((st) => {
          const hp = st.homePct != null ? st.homePct : 50;
          const ap = st.awayPct != null ? st.awayPct : (100 - hp);
          return '<div class="stat-row"><div class="stat-vals"><b>' + esc(st.homeValue) + '</b><span class="muted">' + esc(st.label) + '</span><b>' + esc(st.awayValue) + '</b></div>' +
            '<div class="stat-track"><div class="stat-h" style="width:' + hp + '%"></div><div class="stat-a" style="width:' + ap + '%"></div></div></div>';
        }).join('')
      : '<p class="muted" style="margin-top:16px">' + (det ? 'Sin estadísticas disponibles para este encuentro.' : 'Cargando estadísticas…') + '</p>';
  } else if (S.sheetTab === 'lineups') {
    const luH = det?.lineups?.home;
    const luA = det?.lineups?.away;
    const renderTeamLu = (lu, title) => {
      if (!lu || (!lu.starters?.length && !lu.bench?.length)) return '<div class="lu-box"><strong>' + esc(title) + '</strong><p class="muted" style="margin-top:8px">Formación no confirmada</p></div>';
      const pRow = (p) => '<div class="lu-player"><div><span class="lu-num">' + (p.jerseyNumber ?? '-') + '</span> ' + esc(p.name) + (p.isCaptain ? ' ©' : '') + '</div><span class="muted">' + esc(p.position || '') + '</span></div>';
      return '<div class="lu-box"><strong>' + esc(lu.teamName) + (lu.formation ? ' · ' + esc(lu.formation) : '') + '</strong>' +
        (lu.coach?.name ? '<div class="muted" style="margin:4px 0 8px">DT: ' + esc(lu.coach.name) + '</div>' : '') +
        '<div style="margin-top:8px">' + lu.starters.map(pRow).join('') + '</div>' +
        (lu.bench?.length ? '<h4 style="margin:12px 0 6px;font-size:12px">Suplentes</h4>' + lu.bench.map(pRow).join('') : '') +
      '</div>';
    };
    const missH = det?.missingPlayers?.home || [];
    const missA = det?.missingPlayers?.away || [];
    const missHtml = (missH.length || missA.length)
      ? '<h4>Bajas / Ausentes</h4><div class="lineups-grid">' +
          '<div class="lu-box"><strong>' + esc(h.shortName) + '</strong>' + (missH.map((x) => '<div class="lu-player"><span>' + esc(x.name) + '</span><span class="muted">' + esc(x.reason) + '</span></div>').join('') || '<p class="muted">Sin bajas</p>') + '</div>' +
          '<div class="lu-box"><strong>' + esc(a.shortName) + '</strong>' + (missA.map((x) => '<div class="lu-player"><span>' + esc(x.name) + '</span><span class="muted">' + esc(x.reason) + '</span></div>').join('') || '<p class="muted">Sin bajas</p>') + '</div>' +
        '</div>'
      : '';
    bodyHtml = '<h4>Formaciones</h4><div class="lineups-grid">' + renderTeamLu(luH, h.name) + renderTeamLu(luA, a.name) + '</div>' + missHtml;
  } else if (S.sheetTab === 'relato') {
    const comm = det?.commentary || [];
    const h2h = det?.headToHead;
    const h2hHtml = h2h
      ? '<h4>Historial (H2H)</h4><div class="odds"><div><b>' + h2h.homeWins + '</b><span>' + esc(h.shortName) + '</span></div><div><b>' + h2h.draws + '</b><span>Empates</span></div><div><b>' + h2h.awayWins + '</b><span>' + esc(a.shortName) + '</span></div></div>' +
        (h2h.recentMatches?.length ? '<div style="margin-top:10px">' + h2h.recentMatches.slice(0, 6).map((x) => '<div class="ev"><div class="h">' + esc(x.homeName) + ' <b>' + (x.homeScore ?? '-') + '</b></div><div class="m">-</div><div class="a"><b>' + (x.awayScore ?? '-') + '</b> ' + esc(x.awayName) + '</div></div>').join('') + '</div>' : '')
      : '';
    const commHtml = comm.length
      ? '<h4>Minuto a minuto</h4>' + comm.slice(0, 40).map((c) => '<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13.5px"><b style="font-family:var(--mono);color:var(--lime);margin-right:8px">' + esc(c.minuteDisplay || '') + '</b>' + esc(c.text) + '</div>').join('')
      : '<p class="muted" style="margin-top:12px">Sin relato en texto disponible.</p>';
    bodyHtml = h2hHtml + commHtml;
  }

  $('#sheet').innerHTML = headerHtml + bodyHtml;
}

const closeM = () => { $('#ov').classList.remove('open'); document.body.style.overflow = ''; };

/* ===== Vista: Liga (Tablas, Promedios, Fixture, Llaves, Goleadores) ===== */
async function loadLeague(id, roundKey, refresh = false) {
  const root = $('#viewRoot');
  root.innerHTML = '<section class="hero"><div><h2>Cargando liga…</h2></div></section><div class="sk"></div>';
  try {
    const q = new URLSearchParams();
    if (roundKey) q.set('round', roundKey);
    if (refresh) q.set('refresh', 'true');
    const j = await apiGet('/api/v1/leagues/' + encodeURIComponent(id) + (q.toString() ? '?' + q.toString() : ''));
    S.leagueData = j.data;
    S.meta = j.meta || {};
    updateSyncPill(S.meta);
    renderLeagueView();
  } catch (e) {
    root.innerHTML = '<div class="note">No se pudo cargar la liga: ' + esc(e.message) + '</div>';
  }
}

function renderLeagueView() {
  const d = S.leagueData;
  if (!d) return;
  const lg = d.league;
  const roundsSelect = d.rounds?.length
    ? '<select id="roundSel" class="nav-date" style="width:auto;min-width:190px">' + d.rounds.map((r) => '<option value="' + esc(r.key) + '"' + (r.key === d.selectedRound ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select>'
    : '';

  const tabs = [
    ['standings', 'Tablas (' + (d.standingsGroups?.length || 0) + ')'],
    ['matches', 'Partidos (' + (d.matches?.length || 0) + ')'],
    ['brackets', 'Llaves (' + (d.brackets?.length || 0) + ')'],
    ['leaders', 'Goleadores (' + (d.playerLeaders?.length || 0) + ')'],
  ];

  let content = '';
  if (S.leagueTab === 'standings') {
    content = d.standingsGroups?.length
      ? d.standingsGroups.map((grp) => grp.tables.map((tbl) =>
          '<div class="panel"><div class="panel-head"><h3>' + esc((grp.name && grp.name !== tbl.name ? grp.name + ' · ' : '') + tbl.name) + '</h3><span class="pill">' + esc(tbl.type.toUpperCase()) + '</span></div>' +
          '<div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Equipo</th><th class="num">PJ</th>' +
          (tbl.type === 'promedios' ? '<th class="pts">Prom</th><th class="num">Pts</th>' : '<th class="num">G</th><th class="num">E</th><th class="num">P</th><th class="num">DG</th><th class="pts">Pts</th>') +
          '</tr></thead><tbody>' +
          tbl.rows.map((r) => '<tr><td class="num">' + (r.qualificationColor ? '<span class="qbar" style="background:' + esc(r.qualificationColor) + '"></span>' : '') + r.position + '</td>' +
            '<td><button class="team-link" data-nav="team:' + esc(r.team.id) + '">' + img(r.team.logo) + '<span>' + esc(r.team.name) + '</span></button></td>' +
            '<td class="num">' + r.played + '</td>' +
            (tbl.type === 'promedios'
              ? '<td class="pts">' + (r.average != null ? Number(r.average).toFixed(3) : '-') + '</td><td class="num">' + r.points + '</td>'
              : '<td class="num">' + r.won + '</td><td class="num">' + r.drawn + '</td><td class="num">' + r.lost + '</td><td class="num">' + (r.goalDifference > 0 ? '+' + r.goalDifference : r.goalDifference) + '</td><td class="pts">' + r.points + '</td>') +
          '</tr>').join('') +
          '</tbody></table></div>' +
          (tbl.legend?.length ? '<div class="legend">' + tbl.legend.map((l) => '<span><i style="background:' + esc(l.color) + '"></i>' + esc(l.label) + '</span>').join('') + '</div>' : '') +
          '</div>'
        ).join('')).join('')
      : '<div class="empty"><b>Esta competición no tiene tabla de posiciones</b>Revisá la pestaña Partidos o Llaves.</div>';
  } else if (S.leagueTab === 'matches') {
    content = d.matches?.length
      ? '<div class="grid" style="margin-top:16px">' + d.matches.map((m, i) => renderMatchCard(m, i)).join('') + '</div>'
      : '<div class="empty"><b>No hay partidos cargados en esta ronda</b></div>';
  } else if (S.leagueTab === 'brackets') {
    content = d.brackets?.length
      ? d.brackets.map((st) => '<div class="panel"><div class="panel-head"><h3>' + esc(st.name) + '</h3></div><div class="panel-body"><div class="cat-grid">' +
          st.matches.map((bm) => '<div class="mini-card" style="display:block"' + (bm.id ? ' data-m="' + esc(bm.id) + '"' : '') + '>' +
            (bm.teams || []).map((t) => '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0"><span style="display:flex;align-items:center;gap:8px">' + img(t.logo) + '<span style="' + (t.winner ? 'color:var(--lime);font-weight:700' : '') + '">' + esc(t.name) + '</span></span><b style="font-family:var(--mono)">' + (t.score ?? '-') + '</b></div>').join('') +
          '</div>').join('') +
        '</div></div></div>').join('')
      : '<div class="empty"><b>Sin llaves eliminatorias</b></div>';
  } else if (S.leagueTab === 'leaders') {
    content = d.playerLeaders?.length
      ? '<div class="cat-grid">' + d.playerLeaders.map((cat) => '<div class="panel"><div class="panel-head"><h3>' + esc(cat.name) + '</h3></div><div class="panel-body">' +
          cat.leaders.slice(0, 10).map((ld) => '<div class="lu-player"><div><span class="lu-num">' + ld.rank + '</span> ' + esc(ld.playerName) + '</div><b style="font-family:var(--mono);color:var(--lime)">' + esc(ld.value) + '</b></div>').join('') +
        '</div></div>').join('') + '</div>'
      : '<div class="empty"><b>Sin estadísticas de jugadores</b></div>';
  }

  $('#viewRoot').innerHTML =
    '<section class="hero"><div style="display:flex;align-items:center;gap:16px">' + (lg.logo ? '<img src="' + esc(lg.logo) + '" style="width:58px;height:58px;object-fit:contain">' : '') +
    '<div><h2>' + esc(lg.name) + '</h2><p>' + esc(lg.countryName || 'Internacional') + ' · slug: <code>' + esc(lg.canonicalSlug) + '</code></p></div></div>' +
    '<div>' + roundsSelect + '</div></section>' +
    '<div class="tabs">' + tabs.map(([tk, tl]) => '<button class="tab ' + (S.leagueTab === tk ? 'on' : '') + '" data-ltab="' + tk + '">' + tl + '</button>').join('') + '</div>' +
    content;

  const rs = $('#roundSel');
  if (rs) rs.addEventListener('change', (e) => loadLeague(S.leagueId, e.target.value));
}

/* ===== Vista: Catálogo Completo de Ligas ===== */
async function loadCatalog(refresh = false) {
  const root = $('#viewRoot');
  root.innerHTML = '<section class="hero"><div><h2>Catálogo de Ligas</h2><p>Cargando categorías de Promiedos + ESPN…</p></div></section><div class="sk"></div>';
  try {
    const j = await apiGet('/api/v1/leagues' + (refresh ? '?refresh=true' : ''));
    S.catalogData = j.data;
    updateSyncPill(j.meta);
    renderCatalogView();
  } catch (e) {
    root.innerHTML = '<div class="note">Error cargando catálogo: ' + esc(e.message) + '</div>';
  }
}

function renderCatalogView() {
  const cat = S.catalogData;
  if (!cat) return;
  $('#viewRoot').innerHTML =
    '<section class="hero"><div><h2><b>' + (cat.espnCount || 0) + '+</b> Competiciones</h2><p>' + (cat.categories?.length || 0) + ' categorías organizadas · hacé click en cualquiera para abrir su tabla y fixture</p></div></section>' +
    (cat.categories || []).map((c) =>
      '<div class="panel"><div class="panel-head"><h3 style="display:flex;align-items:center;gap:8px">' + img(c.icon) + esc(c.name) + '</h3><span class="pill">' + (c.leagues?.length || 0) + '</span></div>' +
      '<div class="panel-body"><div class="cat-grid">' +
        (c.leagues || []).slice(0, 60).map((l) =>
          '<button class="mini-card" data-nav="league:' + esc(l.externalIds?.promiedos || l.slug || l.canonicalSlug) + '">' +
            img(l.logo) + '<div><strong>' + esc(l.name) + '</strong><small>' + esc(l.canonicalSlug) + '</small></div>' +
          '</button>'
        ).join('') +
      '</div></div></div>'
    ).join('');
}

/* ===== Vista: Perfil de Club ===== */
async function loadTeam(id, refresh = false) {
  const root = $('#viewRoot');
  root.innerHTML = '<section class="hero"><div><h2>Cargando club…</h2></div></section><div class="sk"></div>';
  try {
    const j = await apiGet('/api/v1/teams/' + encodeURIComponent(id) + (refresh ? '?refresh=true' : ''));
    S.teamData = j.data;
    updateSyncPill(j.meta);
    renderTeamView();
  } catch (e) {
    root.innerHTML = '<div class="note">No se pudo cargar el equipo: ' + esc(e.message) + '</div>';
  }
}

function renderTeamView() {
  const d = S.teamData;
  if (!d) return;
  const t = d.team;
  let tabHtml = '';
  if (S.teamTab === 'squad') {
    tabHtml = (d.squad || []).map((grp) =>
      '<div class="panel"><div class="panel-head"><h3>' + esc(grp.groupName) + '</h3><span class="pill">' + grp.players.length + '</span></div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>Jugador</th><th>Posición</th><th>Edad</th><th>Altura</th></tr></thead><tbody>' +
      grp.players.map((p) => '<tr><td class="num">' + (p.jerseyNumber ?? '-') + '</td><td><div class="team-link">' + img(p.headshot || p.countryFlag) + '<span>' + esc(p.name) + '</span></div></td><td class="muted">' + esc(p.formationPosition || p.position) + '</td><td class="num">' + (p.age ?? '-') + '</td><td class="num">' + esc(p.height || '-') + '</td></tr>').join('') +
      '</tbody></table></div></div>'
    ).join('');
  } else if (S.teamTab === 'matches') {
    const list = [...(d.matches?.upcoming || []), ...(d.matches?.recent || [])];
    tabHtml = list.length
      ? '<div class="grid" style="margin-top:16px">' + list.map((m, i) => renderMatchCard(m, i)).join('') + '</div>'
      : '<div class="empty"><b>Sin partidos recientes</b></div>';
  } else if (S.teamTab === 'stats') {
    const f0 = d.playerStatsFilters?.[0];
    tabHtml = f0?.tables?.length
      ? '<div class="cat-grid">' + f0.tables.map((tbl) => '<div class="panel"><div class="panel-head"><h3>' + esc(tbl.name) + '</h3></div><div class="panel-body">' +
          tbl.leaders.map((ld) => '<div class="lu-player"><div><span class="lu-num">' + ld.rank + '</span> ' + esc(ld.playerName) + '</div><b style="font-family:var(--mono);color:var(--lime)">' + esc(ld.value) + '</b></div>').join('') +
        '</div></div>').join('') + '</div>'
      : '<div class="empty"><b>Sin estadísticas disponibles</b></div>';
  }

  $('#viewRoot').innerHTML =
    '<section class="hero"><div style="display:flex;align-items:center;gap:16px">' + (t.logo ? '<img src="' + esc(t.logo) + '" style="width:64px;height:64px;object-fit:contain">' : '') +
      '<div><h2>' + esc(t.name) + '</h2><p>' + esc(d.mainLeague?.name || '') + (t.standingSummary ? ' · ' + esc(t.standingSummary) : '') + '</p></div></div></section>' +
    '<div class="kv">' +
      (d.info || []).map((i) => '<div><small>' + esc(i.label) + '</small>' + esc(i.value) + '</div>').join('') +
      (d.stadium ? '<div><small>Estadio</small>' + esc(d.stadium.name) + (d.stadium.capacity ? ' (' + esc(d.stadium.capacity) + ')' : '') + '</div>' : '') +
    '</div>' +
    '<div class="tabs">' + [['squad','Plantel'],['matches','Partidos'],['stats','Estadísticas']].map(([tk, tl]) => '<button class="tab ' + (S.teamTab === tk ? 'on' : '') + '" data-ttab="' + tk + '">' + tl + '</button>').join('') + '</div>' +
    tabHtml;
}

/* ===== Vista: Buscador Global ===== */
function renderSearchView() {
  const res = S.searchData;
  $('#viewRoot').innerHTML =
    '<section class="hero"><div><h2>Buscador Global</h2><p>Buscá cualquier club, liga o partido en vivo</p></div></section>' +
    '<form id="searchForm" class="ep-row"><label class="search" style="flex:1;min-width:240px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
    '<input id="globalQ" type="search" value="' + esc(res?.query || '') + '" placeholder="Ej: Boca, River, Libertadores, Arsenal…"></label><button class="btn-lime" type="submit">Buscar</button></form>' +
    (res ? (
      '<div class="cat-grid">' +
        (res.teams || []).map((t) => '<button class="mini-card" data-nav="team:' + esc(t.id) + '">' + img(t.logo) + '<div><strong>' + esc(t.name) + '</strong><small>Club · ' + esc(t.id) + '</small></div></button>').join('') +
        (res.leagues || []).map((l) => '<button class="mini-card" data-nav="league:' + esc(l.canonicalSlug) + '">' + img(l.logo) + '<div><strong>' + esc(l.name) + '</strong><small>Liga · ' + esc(l.countryName || '') + '</small></div></button>').join('') +
      '</div>' +
      ((res.matches || []).length ? '<h3 style="margin:24px 0 8px">Partidos coincidentes</h3><div class="grid">' + res.matches.map((m, i) => renderMatchCard(m, i)).join('') + '</div>' : '')
    ) : '<div class="empty"><b>Escribí al menos 2 letras para buscar</b></div>');

  $('#searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = $('#globalQ').value.trim();
    if (val.length < 2) return;
    const j = await apiGet('/api/v1/search?q=' + encodeURIComponent(val));
    S.searchData = j.data;
    renderSearchView();
  });
}

/* ===== Vista: Explorador JSON / Mapeos / Salud ===== */
function renderExplorerView() {
  const presets = ['/api/v1/live','/api/v1/matches?date=today','/api/v1/leagues/liga-profesional','/api/v1/channels','/api/v1/teams/pm-igg','/api/v1/search?q=Boca','/api/v1/health'];
  $('#viewRoot').innerHTML =
    '<section class="hero"><div><h2>Explorador de Endpoints</h2><p>Probá cualquier ruta de la API en vivo</p></div></section>' +
    '<div class="ep-row">' + presets.map((p) => '<button class="btn-ghost" data-ep="' + esc(p) + '">' + esc(p) + '</button>').join('') + '</div>' +
    '<div class="ep-row"><input id="epInput" style="flex:1;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:var(--bg2);font-family:var(--mono);font-size:13px" value="' + esc(S.explorerPath) + '"><button class="btn-lime" id="epRun">Ejecutar GET</button></div>' +
    '<pre class="json" id="epOut">' + esc(S.explorerJson || '// Elegí o escribí un endpoint para inspeccionar su JSON.') + '</pre>';
  $('#epRun').addEventListener('click', () => runExplorer($('#epInput').value));
}

async function runExplorer(path) {
  S.explorerPath = path;
  const out = $('#epOut');
  if (out) out.textContent = 'Consultando ' + path + ' ...';
  try {
    const r = await fetch(path);
    const txt = await r.text();
    try { S.explorerJson = JSON.stringify(JSON.parse(txt), null, 2); } catch { S.explorerJson = txt; }
  } catch (e) {
    S.explorerJson = 'Error: ' + e.message;
  }
  if ($('#epOut')) $('#epOut').textContent = S.explorerJson;
}

async function loadMappings() {
  const j = await apiGet('/api/v1/mappings');
  S.mappingsData = j.data;
  $('#viewRoot').innerHTML =
    '<section class="hero"><div><h2><b>' + j.count + '</b> Ligas Mapeadas</h2><p>Catálogo de ligas canónicas de Promiedos</p></div></section>' +
    '<div class="panel"><div class="table-wrap"><table class="tbl"><thead><tr><th>Prioridad</th><th>Nombre</th><th>Slug Canónico</th><th>Promiedos ID</th></tr></thead><tbody>' +
    (j.data || []).map((m) => '<tr><td class="num">' + m.priority + '</td><td><button class="team-link" data-nav="league:' + esc(m.canonicalSlug) + '">' + esc(m.name) + '</button></td><td style="font-family:var(--mono)">' + esc(m.canonicalSlug) + '</td><td style="font-family:var(--mono);color:var(--lime)">' + esc(m.promiedosId || '-') + '</td></tr>').join('') +
    '</tbody></table></div></div>';
}

async function loadChannels(initialQuery = '') {
  const j = await apiGet('/api/v1/channels');
  S.channelsData = j;
  if (typeof S.chQuery !== 'string' || initialQuery) S.chQuery = initialQuery;
  renderChannelsView();
}

function channelHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const tok = sessionStorage.getItem('pivo_admin_token') || '';
  if (tok) h['X-Admin-Token'] = tok;
  return h;
}

function renderChannelsView(toastMsg = '', isErr = false) {
  const j = S.channelsData;
  if (!j) return;
  const q = (S.chQuery || '').trim().toLowerCase();
  const rows = (j.data || []).filter((ch) =>
    !q ||
    ch.name.toLowerCase().includes(q) ||
    (ch.id && ch.id.toLowerCase().includes(q)) ||
    ch.slug.toLowerCase().includes(q) ||
    (ch.aliases || []).some((a) => a.toLowerCase().includes(q))
  );

  const savedTok = sessionStorage.getItem('pivo_admin_token') || '';
  $('#viewRoot').innerHTML =
    '<section class="hero"><div><h2><b>' + j.count + '</b> Canales TV</h2><p>' + j.mappedIdsCount + ' con ID para tu app · ' + (j.count - j.mappedIdsCount) + ' con id: null · Persistencia: <strong>' + (j.persistence === 'firestore' ? 'Firebase Firestore' : j.persistence === 'kv' ? 'Cloudflare KV' : 'Memoria local') + '</strong> · Seguridad: <strong>' + (j.authMode === 'token-protected' ? 'ADMIN_TOKEN activo' : 'Modo dev abierto') + '</strong></p></div>' +
    '<div class="stats"><div class="stat"><b>' + (j.overriddenCount || 0) + '</b><span>Editados</span></div><button class="btn-ghost" id="chCopyBtn" type="button">Copiar JSON</button></div></section>' +
    (toastMsg ? '<div class="ch-toast ' + (isErr ? 'err' : '') + '">' + esc(toastMsg) + '</div>' : '') +
    '<div class="panel"><div class="panel-head"><h3>Agregar o mapear canal</h3>' +
      (j.authMode === 'token-protected' ? '<input class="ch-in mono" id="chAdminTok" type="password" placeholder="ADMIN_TOKEN" value="' + esc(savedTok) + '" style="min-width:200px">' : '') +
    '</div><div class="panel-body"><form id="chAddForm" class="ep-row" style="margin-bottom:0">' +
      '<input class="ch-in" id="chNewName" placeholder="Nombre del canal (ej: TyC Sports Play)" value="' + esc(rows.length === 0 && S.chQuery ? S.chQuery : '') + '" style="flex:1;min-width:190px" required>' +
      '<input class="ch-in mono" id="chNewId" placeholder="ID en tu app (vacío = null)" style="width:180px">' +
      '<select class="ch-sel" id="chNewCat"><option value="tv">tv</option><option value="streaming">streaming</option><option value="ppv">ppv</option></select>' +
      '<input class="ch-in" id="chNewAliases" placeholder="Alias (separados por coma)" style="flex:1;min-width:190px">' +
      '<button class="btn-lime" type="submit">Guardar canal</button>' +
    '</form></div></div>' +
    '<div class="panel"><div class="panel-head"><input class="ch-in" id="chSearch" type="search" value="' + esc(S.chQuery || '') + '" placeholder="Filtrar canales, alias o ID de tu app..." style="flex:1;min-width:240px"></div>' +
    '<div class="table-wrap"><table class="tbl"><thead><tr><th>Canal</th><th>ID de tu App</th><th>Categoría</th><th>Alias</th><th>Acciones</th></tr></thead><tbody>' +
    rows.map((ch) =>
      '<tr data-slug="' + esc(ch.slug) + '">' +
        '<td><strong>' + esc(ch.name) + '</strong><br><small class="muted" style="font-family:var(--mono)">' + esc(ch.slug) + (ch.isOverridden ? ' · editado' : ch.isCustom ? ' · custom' : '') + '</small></td>' +
        '<td><input class="ch-in mono ch-id-in" value="' + esc(ch.id ?? '') + '" placeholder="null" style="width:155px"></td>' +
        '<td><select class="ch-sel ch-cat-in"><option value="tv"' + (ch.category === 'tv' ? ' selected' : '') + '>tv</option><option value="streaming"' + (ch.category === 'streaming' ? ' selected' : '') + '>streaming</option><option value="ppv"' + (ch.category === 'ppv' ? ' selected' : '') + '>ppv</option></select></td>' +
        '<td><input class="ch-in ch-al-in" value="' + esc((ch.aliases || []).join(', ')) + '" style="width:100%;min-width:190px"></td>' +
        '<td style="white-space:nowrap"><button class="btn-lime ch-save" type="button" style="padding:6px 11px;font-size:12px">Guardar</button>' +
        ((ch.isOverridden || ch.isCustom) ? ' <button class="btn-ghost ch-del" type="button" style="padding:6px 10px;font-size:12px">' + (ch.isCustom ? 'Eliminar' : 'Restaurar') + '</button>' : '') +
        '</td>' +
      '</tr>'
    ).join('') +
    '</tbody></table></div></div>';

  const tokEl = $('#chAdminTok');
  if (tokEl) tokEl.addEventListener('input', (e) => sessionStorage.setItem('pivo_admin_token', e.target.value));

  $('#chSearch').addEventListener('input', (e) => {
    S.chQuery = e.target.value;
    renderChannelsView();
    const el = $('#chSearch');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });

  $('#chCopyBtn').addEventListener('click', async () => {
    const out = (S.channelsData?.data || []).map((c) => ({ name: c.name, id: c.id }));
    await navigator.clipboard?.writeText(JSON.stringify(out, null, 2));
    renderChannelsView('JSON de mapeo de canales copiado al portapapeles.');
  });

  $('#chAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#chNewName').value.trim();
    const rawId = $('#chNewId').value.trim();
    const category = $('#chNewCat').value;
    const aliases = $('#chNewAliases').value.split(',').map((s) => s.trim()).filter(Boolean);
    const r = await fetch('/api/v1/channels', {
      method: 'POST',
      headers: channelHeaders(),
      body: JSON.stringify({ name, id: rawId || null, category, aliases }),
    });
    const res = await r.json();
    if (!r.ok || !res.ok) return renderChannelsView(res.error || 'Error guardando canal', true);
    S.channelsData = await apiGet('/api/v1/channels');
    renderChannelsView('Canal "' + res.data.name + '" guardado (' + res.persistedIn.toUpperCase() + ').');
  });

  document.querySelectorAll('.ch-save').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      const slug = tr.dataset.slug;
      const rawId = tr.querySelector('.ch-id-in').value.trim();
      const category = tr.querySelector('.ch-cat-in').value;
      const aliases = tr.querySelector('.ch-al-in').value.split(',').map((s) => s.trim()).filter(Boolean);
      const r = await fetch('/api/v1/channels/' + encodeURIComponent(slug), {
        method: 'PUT',
        headers: channelHeaders(),
        body: JSON.stringify({ id: rawId || null, category, aliases }),
      });
      const res = await r.json();
      if (!r.ok || !res.ok) return renderChannelsView(res.error || 'Error actualizando canal', true);
      S.channelsData = await apiGet('/api/v1/channels');
      renderChannelsView('Mapeo de "' + res.data.name + '" actualizado a id: ' + (res.data.id ?? 'null') + ' (' + res.persistedIn.toUpperCase() + ').');
    });
  });

  document.querySelectorAll('.ch-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slug = btn.closest('tr').dataset.slug;
      const r = await fetch('/api/v1/channels/' + encodeURIComponent(slug), {
        method: 'DELETE',
        headers: channelHeaders(),
      });
      const res = await r.json();
      if (!r.ok || !res.ok) return renderChannelsView(res.error || 'Error restaurando canal', true);
      S.channelsData = await apiGet('/api/v1/channels');
      renderChannelsView('Canal "' + slug + '" restaurado/eliminado.');
    });
  });
}

async function loadExcludedLeagues() {
  const [excl, maps] = await Promise.all([
    apiGet('/api/v1/excluded-leagues'),
    S.mappingsData ? Promise.resolve({ data: S.mappingsData }) : apiGet('/api/v1/mappings'),
  ]);
  S.excludedData = excl;
  S.mappingsData = maps.data;
  updateExclBadge(excl.count || 0);
  renderExcludedLeaguesView();
}

function updateExclBadge(n) {
  const b = $('#sideExclBadge');
  if (!b) return;
  b.textContent = n;
  b.style.display = n > 0 ? 'inline-block' : 'none';
}

function renderExcludedLeaguesView(toastMsg = '', isErr = false) {
  const excl = S.excludedData || { count: 0, persistence: 'memory', authMode: 'open-dev', data: [] };
  const exclSet = new Set((excl.data || []).map((e) => e.slug));
  const q = (S.exclQuery || '').trim().toLowerCase();
  const savedTok = sessionStorage.getItem('pivo_admin_token') || '';

  const pool = new Map();
  for (const m of (S.mappingsData || [])) {
    pool.set(m.canonicalSlug, { slug: m.canonicalSlug, name: m.name, promiedosId: m.promiedosId, espnSlug: m.espnSlug, country: m.countryName });
  }
  for (const g of (S.leagues || [])) {
    const slug = g.league.canonicalSlug || g.league.id;
    if (!pool.has(slug)) {
      pool.set(slug, { slug, name: leagueName(g.league, g.matches), promiedosId: g.league.externalIds?.promiedos, espnSlug: g.league.externalIds?.espn, country: g.league.countryName || '' });
    }
  }
  const available = Array.from(pool.values()).filter((l) =>
    !exclSet.has(l.slug) &&
    (!q || l.name.toLowerCase().includes(q) || l.slug.toLowerCase().includes(q) || (l.espnSlug || '').toLowerCase().includes(q))
  );

  $('#viewRoot').innerHTML =
    '<section class="hero"><div><h2><b>' + excl.count + '</b> Ligas Excluidas</h2><p>Las ligas excluidas no se extraen ni aparecen en tu API · Persistencia: <strong>' + (excl.persistence === 'firestore' ? 'Firebase Firestore' : excl.persistence === 'kv' ? 'Cloudflare KV' : 'Memoria local') + '</strong></p></div></section>' +
    (toastMsg ? '<div class="ch-toast ' + (isErr ? 'err' : '') + '">' + esc(toastMsg) + '</div>' : '') +
    '<div class="panel"><div class="panel-head"><h3>Excluir liga manualmente (slug, ID o nombre)</h3>' +
      (excl.authMode === 'token-protected' ? '<input class="ch-in mono" id="exAdminTok" type="password" placeholder="ADMIN_TOKEN" value="' + esc(savedTok) + '" style="min-width:200px">' : '') +
    '</div><div class="panel-body"><form id="exAddForm" class="ep-row" style="margin-bottom:0">' +
      '<input class="ch-in mono" id="exSlug" placeholder="Slug o ID (ej: championship, eng.2, ihh)" style="flex:1;min-width:190px" required>' +
      '<input class="ch-in" id="exName" placeholder="Nombre visible (opcional)" style="flex:1;min-width:180px">' +
      '<button class="btn-lime" type="submit">Excluir de la API</button>' +
    '</form></div></div>' +
    ((excl.data || []).length
      ? '<div class="panel"><div class="panel-head"><h3>Actualmente excluidas</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Liga</th><th>Slug</th><th>IDs</th><th>Acción</th></tr></thead><tbody>' +
        excl.data.map((e) =>
          '<tr><td><strong>' + esc(e.name) + '</strong></td><td style="font-family:var(--mono);color:var(--red)">' + esc(e.slug) + '</td><td class="muted" style="font-family:var(--mono);font-size:12px">' + esc([e.promiedosId, e.espnSlug].filter(Boolean).join(' · ') || '-') + '</td><td><button class="btn-ghost ex-restore" data-slug="' + esc(e.slug) + '" type="button" style="padding:6px 11px;font-size:12px">Volver a activar</button></td></tr>'
        ).join('') +
        '</tbody></table></div></div>'
      : '') +
    '<div class="panel"><div class="panel-head"><h3>Quitar ligas conocidas</h3><input class="ch-in" id="exSearch" type="search" value="' + esc(S.exclQuery || '') + '" placeholder="Buscar liga para quitar..." style="flex:1;min-width:220px"></div>' +
    '<div class="table-wrap"><table class="tbl"><thead><tr><th>Liga</th><th>País</th><th>Slug</th><th>Acción</th></tr></thead><tbody>' +
    available.map((l) =>
      '<tr><td><strong>' + esc(l.name) + '</strong></td><td class="muted">' + esc(l.country || '-') + '</td><td style="font-family:var(--mono);font-size:12px">' + esc(l.slug) + '</td><td><button class="btn-ghost ex-ban" data-slug="' + esc(l.slug) + '" data-name="' + esc(l.name) + '" data-pm="' + esc(l.promiedosId || '') + '" data-espn="' + esc(l.espnSlug || '') + '" type="button" style="padding:6px 11px;font-size:12px;color:var(--red);border-color:rgba(255,77,94,.35)">Quitar de API</button></td></tr>'
    ).join('') +
    '</tbody></table></div></div>';

  const tokEl = $('#exAdminTok');
  if (tokEl) tokEl.addEventListener('input', (e) => sessionStorage.setItem('pivo_admin_token', e.target.value));

  $('#exSearch').addEventListener('input', (e) => {
    S.exclQuery = e.target.value;
    renderExcludedLeaguesView();
    const el = $('#exSearch');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });

  $('#exAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const slug = $('#exSlug').value.trim();
    const name = $('#exName').value.trim();
    const r = await fetch('/api/v1/excluded-leagues', {
      method: 'POST',
      headers: channelHeaders(),
      body: JSON.stringify({ slug, ...(name ? { name } : {}) }),
    });
    const res = await r.json();
    if (!r.ok || !res.ok) return renderExcludedLeaguesView(res.error || 'Error excluyendo liga', true);
    S.excludedData = await apiGet('/api/v1/excluded-leagues');
    updateExclBadge(S.excludedData.count || 0);
    renderExcludedLeaguesView('Liga "' + res.data.name + '" excluida de tu API.');
  });

  document.querySelectorAll('.ex-ban').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = await fetch('/api/v1/excluded-leagues', {
        method: 'POST',
        headers: channelHeaders(),
        body: JSON.stringify({
          slug: btn.dataset.slug,
          name: btn.dataset.name,
          ...(btn.dataset.pm ? { promiedosId: btn.dataset.pm } : {}),
          ...(btn.dataset.espn ? { espnSlug: btn.dataset.espn } : {}),
        }),
      });
      const res = await r.json();
      if (!r.ok || !res.ok) return renderExcludedLeaguesView(res.error || 'Error excluyendo liga', true);
      S.excludedData = await apiGet('/api/v1/excluded-leagues');
      updateExclBadge(S.excludedData.count || 0);
      renderExcludedLeaguesView('Liga "' + res.data.name + '" quitada de la API.');
    });
  });

  document.querySelectorAll('.ex-restore').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slug = btn.dataset.slug;
      const r = await fetch('/api/v1/excluded-leagues/' + encodeURIComponent(slug), {
        method: 'DELETE',
        headers: channelHeaders(),
      });
      const res = await r.json();
      if (!r.ok || !res.ok) return renderExcludedLeaguesView(res.error || 'Error restaurando liga', true);
      S.excludedData = await apiGet('/api/v1/excluded-leagues');
      updateExclBadge(S.excludedData.count || 0);
      renderExcludedLeaguesView('Liga "' + slug + '" reactivada en tu API.');
    });
  });
}

async function loadCustomLogos() {
  const [logosRes, mapsRes] = await Promise.all([
    apiGet('/api/v1/custom-logos'),
    S.mappingsData ? Promise.resolve({ data: S.mappingsData }) : apiGet('/api/v1/mappings'),
  ]);
  S.customLogosData = logosRes;
  S.mappingsData = mapsRes.data;
  updateLogosBadge(logosRes.count || 0);
  renderCustomLogosView();
}

function updateLogosBadge(n) {
  const b = $('#sideLogosBadge');
  if (!b) return;
  b.textContent = n;
  b.style.display = n > 0 ? 'inline-block' : 'none';
}

function renderCustomLogosView(toastMsg = '', isErr = false) {
  const d = S.customLogosData || { count: 0, persistence: 'firestore', authMode: 'open-dev', data: [] };
  const savedTok = sessionStorage.getItem('pivo_admin_token') || '';
  const teamOpts = new Map();
  for (const g of (S.leagues || [])) {
    for (const m of (g.matches || [])) {
      if (m.home?.id) teamOpts.set(m.home.id, m.home.name + ' (' + m.home.id + ')');
      if (m.away?.id) teamOpts.set(m.away.id, m.away.name + ' (' + m.away.id + ')');
    }
  }
  const leagueOpts = (S.mappingsData || []).map((l) => '<option value="' + esc(l.canonicalSlug) + '">' + esc(l.name) + '</option>').join('');
  const teamOptsHtml = Array.from(teamOpts.entries()).map(([id, label]) => '<option value="' + esc(id) + '">' + esc(label) + '</option>').join('');

  $('#viewRoot').innerHTML =
    '<section class="hero"><div><h2><b>' + d.count + '</b> Logos Custom</h2><p>Asigná logos PNG o SVG por URL a cualquier equipo o liga · Persistencia: <strong>' + (d.persistence === 'firestore' ? 'Firebase Firestore' : d.persistence === 'kv' ? 'Cloudflare KV' : 'Memoria local') + '</strong></p></div></section>' +
    (toastMsg ? '<div class="ch-toast ' + (isErr ? 'err' : '') + '">' + esc(toastMsg) + '</div>' : '') +
    '<div class="panel"><div class="panel-head"><h3>Agregar o reemplazar logo (PNG / SVG)</h3>' +
      (d.authMode === 'token-protected' ? '<input class="ch-in mono" id="clAdminTok" type="password" placeholder="ADMIN_TOKEN" value="' + esc(savedTok) + '" style="min-width:200px">' : '') +
    '</div><div class="panel-body"><form id="clForm" class="ep-row" style="margin-bottom:0;align-items:center">' +
      '<select class="ch-sel" id="clType"><option value="team">Equipo</option><option value="league">Liga</option></select>' +
      '<input class="ch-in mono" id="clId" list="clSuggestions" placeholder="ID, slug o nombre (ej: pm-igg, Boca Juniors, liga-profesional)" style="flex:1;min-width:210px" required>' +
      '<datalist id="clSuggestions">' + teamOptsHtml + leagueOpts + '</datalist>' +
      '<input class="ch-in" id="clName" placeholder="Nombre visible (opcional)" style="min-width:160px">' +
      '<input class="ch-in mono" id="clUrl" type="url" placeholder="https://ejemplo.com/logo.svg o .png" style="flex:1.4;min-width:240px" required>' +
      '<img id="clPreview" src="" alt="" style="width:36px;height:36px;object-fit:contain;border-radius:10px;border:1px solid var(--line);background:var(--bg);padding:3px;display:none">' +
      '<button class="btn-lime" type="submit">Guardar logo</button>' +
    '</form></div></div>' +
    '<div class="panel"><div class="panel-head"><h3>Logos guardados</h3></div>' +
    ((d.data || []).length
      ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Vista previa</th><th>Tipo</th><th>Identificador</th><th>URL (PNG / SVG)</th><th>Acciones</th></tr></thead><tbody>' +
        d.data.map((item) =>
          '<tr>' +
            '<td><img src="' + esc(item.logoUrl) + '" alt="" style="width:36px;height:36px;object-fit:contain;background:rgba(255,255,255,.04);border-radius:8px;padding:3px"></td>' +
            '<td><span class="pill" style="padding:3px 9px;font-size:11.5px">' + esc(item.targetType === 'team' ? 'Equipo' : 'Liga') + '</span></td>' +
            '<td><strong>' + esc(item.name || item.identifier) + '</strong><br><small class="muted" style="font-family:var(--mono)">' + esc(item.key) + '</small></td>' +
            '<td style="font-family:var(--mono);font-size:12px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="' + esc(item.logoUrl) + '" target="_blank" style="color:var(--lime)">' + esc(item.logoUrl) + '</a></td>' +
            '<td><button class="btn-ghost cl-del" data-key="' + esc(item.key) + '" type="button" style="padding:6px 11px;font-size:12px">Restaurar original</button></td>' +
          '</tr>'
        ).join('') +
        '</tbody></table></div>'
      : '<div class="empty"><b>Sin logos personalizados aún</b>Pegá cualquier URL .png o .svg arriba para reemplazar el escudo de un club o liga.</div>') +
    '</div>';

  const tokEl = $('#clAdminTok');
  if (tokEl) tokEl.addEventListener('input', (e) => sessionStorage.setItem('pivo_admin_token', e.target.value));

  const urlEl = $('#clUrl');
  const prevEl = $('#clPreview');
  urlEl.addEventListener('input', () => {
    const v = urlEl.value.trim();
    if (v.startsWith('http://') || v.startsWith('https://')) {
      prevEl.src = v;
      prevEl.style.display = 'block';
    } else {
      prevEl.style.display = 'none';
    }
  });

  $('#clForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetType = $('#clType').value;
    const identifier = $('#clId').value.trim();
    const name = $('#clName').value.trim();
    const logoUrl = $('#clUrl').value.trim();
    const r = await fetch('/api/v1/custom-logos', {
      method: 'POST',
      headers: channelHeaders(),
      body: JSON.stringify({ targetType, identifier, ...(name ? { name } : {}), logoUrl }),
    });
    const res = await r.json();
    if (!r.ok || !res.ok) return renderCustomLogosView(res.error || 'Error guardando logo', true);
    S.customLogosData = await apiGet('/api/v1/custom-logos');
    updateLogosBadge(S.customLogosData.count || 0);
    renderCustomLogosView('Logo guardado para "' + (res.data.name || res.data.identifier) + '" (' + res.persistedIn.toUpperCase() + ').');
  });

  document.querySelectorAll('.cl-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      const r = await fetch('/api/v1/custom-logos/' + encodeURIComponent(key), {
        method: 'DELETE',
        headers: channelHeaders(),
      });
      const res = await r.json();
      if (!r.ok || !res.ok) return renderCustomLogosView(res.error || 'Error eliminando logo', true);
      S.customLogosData = await apiGet('/api/v1/custom-logos');
      updateLogosBadge(S.customLogosData.count || 0);
      renderCustomLogosView('Logo "' + key + '" eliminado; se restauró el original.');
    });
  });
}

async function loadHealth() {
  const r = await fetch('/api/v1/health');
  const h = await r.json();
  S.healthData = h;
  $('#viewRoot').innerHTML =
    '<section class="hero"><div><h2>Estado del Worker</h2><p>Monitoreo de caché L1/L2/KV y fuentes activas</p></div></section>' +
    '<div class="stats" style="margin-bottom:18px">' +
      '<div class="stat"><b>' + (h.ok ? 'OK' : 'ERR') + '</b><span>Estado</span></div>' +
      '<div class="stat"><b>' + (h.cacheStats?.hits ?? 0) + '</b><span>L1 Hits</span></div>' +
      '<div class="stat"><b>' + (h.cacheStats?.staleHits ?? 0) + '</b><span>SWR Stale</span></div>' +
      '<div class="stat"><b>' + (h.cacheStats?.l1Size ?? 0) + '</b><span>Entradas L1</span></div>' +
      '<div class="stat"><b>' + (h.kvConfigured ? 'ON' : 'OFF') + '</b><span>KV Store</span></div>' +
    '</div>' +
    '<pre class="json">' + esc(JSON.stringify(h, null, 2)) + '</pre>';
}

/* ===== Eventos globales ===== */
document.addEventListener('click', (e) => {
  if (e.target.id === 'ov') return closeM();
  if (e.target.id === 'sideBg' || e.target.id === 'sideClose') return toggleDrawer(false);

  const secBtn = e.target.closest('.nav-sec-title');
  if (secBtn) { secBtn.closest('.nav-sec').classList.toggle('shut'); return; }

  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    if ('closeGo' in navBtn.dataset) closeM();
    navigate(navBtn.dataset.nav);
    return;
  }

  const t = e.target.closest('[data-s],[data-lf],[data-t],[data-m],[data-close],[data-reset],[data-stab],[data-ltab],[data-ttab],[data-ep]');
  if (!t) return;
  if (t.dataset.s) { S.status = t.dataset.s; renderMatchesView(); }
  else if (t.dataset.lf) { S.leagueFilter = t.dataset.lf; renderMatchesView(); }
  else if (t.dataset.t) { S.shut.has(t.dataset.t) ? S.shut.delete(t.dataset.t) : S.shut.add(t.dataset.t); renderMatchesView(); }
  else if (t.dataset.m) { openMatch(t.dataset.m); }
  else if ('close' in t.dataset) { closeM(); }
  else if ('reset' in t.dataset) { S.status = 'all'; S.leagueFilter = 'all'; S.q = ''; renderMatchesView(); }
  else if (t.dataset.stab) { S.sheetTab = t.dataset.stab; renderSheet(); }
  else if (t.dataset.ltab) { S.leagueTab = t.dataset.ltab; renderLeagueView(); }
  else if (t.dataset.ttab) { S.teamTab = t.dataset.ttab; renderTeamView(); }
  else if (t.dataset.ep) { $('#epInput').value = t.dataset.ep; runExplorer(t.dataset.ep); }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeM(); });
$('#menuBtn').addEventListener('click', () => toggleDrawer());
$('#rf').addEventListener('click', () => navigate(S.view === 'matches' ? 'matches:' + S.dateMode : S.view === 'league' ? 'league:' + S.leagueId : S.view === 'team' ? 'team:' + S.teamId : S.view, true));
$('#sideDatePick').addEventListener('change', (e) => { if (e.target.value) navigate('matches:' + e.target.value); });

/* ===== Gesto de arrastre 1:1 con momentum para el Sheet (Apple-style) ===== */
(() => {
  const sheet = $('#sheet');
  let drag = null;
  let curY = 0;

  sheet.addEventListener('pointerdown', (e) => {
    const onHandle = e.target.closest('.sheet-handle');
    if (!onHandle && sheet.scrollTop > 0) return;
    if (e.target.closest('button,input,select,a')) return;
    drag = { id: e.pointerId, startY: e.clientY, baseY: curY, pts: [{ y: e.clientY, t: performance.now() }] };
    sheet.style.transition = 'none';
  });

  sheet.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const rawDy = e.clientY - drag.startY + drag.baseY;
    if (rawDy < 0 && sheet.scrollTop > 0) return;
    if (rawDy > 4 && sheet.scrollTop <= 0) {
      if (!sheet.hasPointerCapture(e.pointerId)) {
        try { sheet.setPointerCapture(e.pointerId); } catch {}
      }
    }
    // Resistencia rubber-band hacia arriba, 1:1 hacia abajo
    curY = rawDy >= 0 ? rawDy : rawDy * 0.22;
    sheet.style.transform = 'translate3d(0,' + curY.toFixed(1) + 'px,0)';
    drag.pts.push({ y: e.clientY, t: performance.now() });
    if (drag.pts.length > 5) drag.pts.shift();
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const pts = drag.pts;
    drag = null;
    let vy = 0;
    if (pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      const dt = Math.max(1, b.t - a.t);
      vy = (b.y - a.y) / dt; // px/ms
    }
    const projected = curY + vy * 150;
    sheet.style.transition = 'transform .32s cubic-bezier(.22,1,.36,1)';
    if (projected > 115 || vy > 0.65) {
      curY = window.innerHeight;
      sheet.style.transform = 'translate3d(0,100%,0)';
      setTimeout(() => { curY = 0; sheet.style.transform = ''; sheet.style.transition = ''; closeM(); }, 220);
    } else {
      curY = 0;
      sheet.style.transform = 'translate3d(0,0,0)';
      setTimeout(() => { sheet.style.transition = ''; }, 330);
    }
  };
  sheet.addEventListener('pointerup', endDrag);
  sheet.addEventListener('pointercancel', endDrag);
})();

const toTopBtn = $('#toTop');
window.addEventListener('scroll', () => {
  if (toTopBtn) toTopBtn.classList.toggle('show', window.scrollY > 360);
}, { passive: true });
if (toTopBtn) toTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

apiGet('/api/v1/excluded-leagues').then((r) => updateExclBadge(r.count || 0)).catch(() => {});
apiGet('/api/v1/custom-logos').then((r) => updateLogosBadge(r.count || 0)).catch(() => {});
navigate('matches:today');
setInterval(() => {
  if (!document.hidden && S.view === 'matches' && (S.dateMode === 'today' || S.dateMode === 'live')) {
    loadMatches(false);
  }
}, REFRESH_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && S.view === 'matches' && (S.dateMode === 'today' || S.dateMode === 'live')) {
    loadMatches(false);
  }
});
</script>
</body>
</html>`;
}
