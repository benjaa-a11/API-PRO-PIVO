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
    },
  };
}

export function renderDashboardHtml(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API PRO PIVO — Football Live Engine</title>
  <style>
    :root {
      --bg: #080b10;
      --surface: #11161f;
      --surface-2: #18202c;
      --border: #263244;
      --text: #eef3f9;
      --muted: #8fa0b5;
      --accent: #c8ff00;
      --live: #ff3b5c;
      --ok: #22c55e;
      --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      --sans: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    header {
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, #0e141d 0%, var(--bg) 100%);
      padding: 20px 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    .topbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .badge {
      background: var(--accent);
      color: #090c10;
      font-weight: 800;
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.04em;
    }
    .nav-links { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn {
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: border-color 0.15s, background 0.15s;
    }
    .btn:hover { border-color: var(--accent); }
    .btn.primary { background: var(--accent); color: #090c10; border-color: var(--accent); }
    main { padding: 24px 0 60px; display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 24px; }
    @media (max-width: 960px) { main { grid-template-columns: 1fr; } }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .card-head {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .card-title { font-weight: 700; font-size: 15px; margin: 0; }
    .stats-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .stat-pill {
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 10px 14px;
      border-radius: 10px;
      min-width: 120px;
    }
    .stat-pill small { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase; }
    .stat-pill strong { font-size: 20px; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 18px; border-bottom: 1px solid var(--border); background: #0d121a; }
    .chip {
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--muted);
      padding: 5px 11px;
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
    }
    .chip.active { color: #090c10; background: var(--accent); border-color: var(--accent); font-weight: 700; }
    .league-block { border-bottom: 1px solid var(--border); }
    .league-name {
      padding: 8px 18px;
      background: #141b26;
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .league-name img { width: 16px; height: 16px; object-fit: contain; }
    .match-row {
      display: grid;
      grid-template-columns: 74px 1fr auto 1fr;
      align-items: center;
      gap: 10px;
      padding: 10px 18px;
      border-top: 1px solid rgba(38,50,68,0.45);
      cursor: pointer;
      transition: background 0.12s;
    }
    .match-row:hover { background: var(--surface-2); }
    .status-badge { font-family: var(--mono); font-size: 12px; color: var(--muted); }
    .status-badge.live { color: var(--live); font-weight: 700; }
    .team { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .team.home { justify-content: flex-end; text-align: right; }
    .team img { width: 20px; height: 20px; object-fit: contain; }
    .score {
      font-family: var(--mono);
      font-weight: 800;
      font-size: 15px;
      padding: 3px 9px;
      background: #0a0e14;
      border: 1px solid var(--border);
      border-radius: 6px;
      min-width: 54px;
      text-align: center;
    }
    .endpoint-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
    .ep-btn {
      text-align: left;
      font-family: var(--mono);
      font-size: 12px;
      padding: 8px 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 8px;
      cursor: pointer;
    }
    .ep-btn:hover { border-color: var(--accent); }
    pre {
      margin: 0;
      padding: 16px;
      font-family: var(--mono);
      font-size: 12px;
      overflow: auto;
      max-height: 520px;
      background: #090c11;
      color: #c5e4fd;
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <header>
    <div class="container topbar">
      <div class="brand">
        <span class="badge">PRO-PIVO v1</span>
        <div>
          <strong style="font-size:18px;">Football Live & Data API</strong>
          <div style="font-size:12px;color:var(--muted);">Promiedos + ESPN Argentina Fusion · Cloudflare Workers</div>
        </div>
      </div>
      <div class="nav-links">
        <a class="btn" href="${cleanBase}/openapi.json" target="_blank">OpenAPI JSON</a>
        <a class="btn" href="${cleanBase}/api/v1/health" target="_blank">Health</a>
        <a class="btn primary" href="${cleanBase}/api/v1/live" target="_blank">GET /api/v1/live</a>
      </div>
    </div>
  </header>

  <div class="container" style="padding-top:20px;">
    <div class="stats-bar" id="statsBar">
      <div class="stat-pill"><small>Partidos Hoy</small><strong id="statTotal">-</strong></div>
      <div class="stat-pill"><small>En Vivo</small><strong id="statLive" style="color:var(--live)">-</strong></div>
      <div class="stat-pill"><small>Ligas</small><strong id="statLeagues">-</strong></div>
      <div class="stat-pill"><small>Cache</small><strong id="statCache">-</strong></div>
    </div>

    <main>
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Scoreboard Unificado (Hoy AR)</h2>
          <button class="btn" onclick="loadScoreboard(true)">Actualizar</button>
        </div>
        <div class="filters">
          <button class="chip active" onclick="setFilter('ALL', this)">Todos</button>
          <button class="chip" onclick="setFilter('LIVE', this)">En Vivo</button>
          <button class="chip" onclick="setFilter('FT', this)">Finalizados</button>
          <button class="chip" onclick="setFilter('PRE', this)">Próximos</button>
        </div>
        <div id="matchesHost" style="max-height:700px;overflow:auto;">
          <div style="padding:24px;color:var(--muted);">Cargando partidos...</div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Explorador Interactivo</h2>
          <span id="respMeta" style="font-size:12px;color:var(--muted);font-family:var(--mono);"></span>
        </div>
        <div class="endpoint-list">
          <button class="ep-btn" onclick="inspectEndpoint('/api/v1/live')">GET /api/v1/live</button>
          <button class="ep-btn" onclick="inspectEndpoint('/api/v1/matches?date=today')">GET /api/v1/matches?date=today</button>
          <button class="ep-btn" onclick="inspectEndpoint('/api/v1/leagues/liga-profesional')">GET /api/v1/leagues/liga-profesional</button>
          <button class="ep-btn" onclick="inspectEndpoint('/api/v1/leagues/premier-league')">GET /api/v1/leagues/premier-league</button>
          <button class="ep-btn" onclick="inspectEndpoint('/api/v1/teams/pm-igg')">GET /api/v1/teams/pm-igg (Boca Juniors)</button>
          <button class="ep-btn" onclick="inspectEndpoint('/api/v1/search?q=Boca')">GET /api/v1/search?q=Boca</button>
          <button class="ep-btn" onclick="inspectEndpoint('/api/v1/mappings')">GET /api/v1/mappings</button>
        </div>
        <pre id="jsonOut">// Hacé click en un partido o en un endpoint para inspeccionar el JSON unificado.</pre>
      </section>
    </main>
  </div>

  <script>
    let currentFilter = 'ALL';
    let cachedPayload = null;

    function setFilter(f, el) {
      currentFilter = f;
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      if (el) el.classList.add('active');
      renderMatches();
    }

    function escapeHtml(str) {
      return String(str ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    function renderMatches() {
      const host = document.getElementById('matchesHost');
      if (!cachedPayload || !cachedPayload.data) return;
      const leagues = cachedPayload.data.leagues || [];
      let html = '';

      for (const grp of leagues) {
        const filtered = (grp.matches || []).filter((m) => {
          if (currentFilter === 'ALL') return true;
          if (currentFilter === 'LIVE') return m.status.isLive;
          if (currentFilter === 'FT') return m.status.isFinished;
          if (currentFilter === 'PRE') return m.status.state === 'PRE';
          return true;
        });
        if (filtered.length === 0) continue;

        html += '<div class="league-block">';
        html += '<div class="league-name">' + (grp.league.logo ? '<img src="' + escapeHtml(grp.league.logo) + '" />' : '') + escapeHtml(grp.league.name) + ' (' + filtered.length + ')</div>';
        for (const m of filtered) {
          const scoreText = (m.home.score !== null && m.away.score !== null) ? (m.home.score + ' - ' + m.away.score) : (m.timeLocalAr || '-');
          const statusCls = m.status.isLive ? 'status-badge live' : 'status-badge';
          const statusText = m.status.isLive ? (m.status.minuteDisplay || 'VIVO') : (m.status.state === 'PRE' ? m.timeLocalAr : m.status.shortLabel);
          html += '<div class="match-row" onclick="inspectEndpoint(\\x27/api/v1/matches/' + encodeURIComponent(m.id) + '\\x27)">';
          html += '<div class="' + statusCls + '">' + escapeHtml(statusText) + '</div>';
          html += '<div class="team home"><span>' + escapeHtml(m.home.shortName || m.home.name) + '</span>' + (m.home.logo ? '<img src="' + escapeHtml(m.home.logo) + '" />' : '') + '</div>';
          html += '<div class="score">' + escapeHtml(scoreText) + '</div>';
          html += '<div class="team away">' + (m.away.logo ? '<img src="' + escapeHtml(m.away.logo) + '" />' : '') + '<span>' + escapeHtml(m.away.shortName || m.away.name) + '</span></div>';
          html += '</div>';
        }
        html += '</div>';
      }

      host.innerHTML = html || '<div style="padding:24px;color:var(--muted);">No hay partidos para este filtro.</div>';
    }

    async function loadScoreboard(bypass = false) {
      const url = '/api/v1/matches?date=today' + (bypass ? '&refresh=true' : '');
      const res = await fetch(url);
      const json = await res.json();
      cachedPayload = json;
      const sum = json?.data?.summary || {};
      document.getElementById('statTotal').textContent = sum.totalMatches ?? 0;
      document.getElementById('statLive').textContent = sum.liveMatches ?? 0;
      document.getElementById('statLeagues').textContent = sum.leaguesCount ?? 0;
      document.getElementById('statCache').textContent = json?.meta?.cache || '-';
      renderMatches();
    }

    async function inspectEndpoint(path) {
      const out = document.getElementById('jsonOut');
      const meta = document.getElementById('respMeta');
      out.textContent = 'Consultando ' + path + ' ...';
      const t0 = performance.now();
      const res = await fetch(path);
      const text = await res.text();
      const dt = Math.round(performance.now() - t0);
      meta.textContent = res.status + ' · ' + dt + 'ms';
      try {
        out.textContent = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        out.textContent = text;
      }
    }

    loadScoreboard(false);
  </script>
</body>
</html>`;
}
