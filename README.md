# API PRO PIVO — Football Live & Data Engine

API REST de fútbol en tiempo real construida sobre **Cloudflare Workers + Hono + TypeScript**, diseñada específicamente para consumo directo desde aplicaciones **Flutter / Mobile / Web**, fusionando **Promiedos** (fuente principal) con **ESPN Argentina** (enriquecimiento global, relatos, noticias, videos y estadísticas avanzadas).

---

## Características principales

- **Doble fuente con fusión inteligente (`promiedos` + `espn`)**:
  - **Promiedos**: ligas argentinas completas (`Liga Profesional`, `Copa Argentina`, `Primera Nacional`, `Primera B`, `Primera C`, `Federal A`), horarios `America/Argentina/Buenos_Aires`, goles, tarjetas, cambios, VAR, penales, tablas de posiciones, promedios, llaves de copas, alineaciones con coordenadas visuales 2D (`pitchLocation`), lesionados/suspendidos, estadio, árbitro, canales de TV y cuotas.
  - **ESPN Argentina**: cobertura internacional amplia (~100+ competiciones), relatos minuto a minuto, estadísticas individuales de cada jugador, racha de últimos 5 partidos con rival/resultado, noticias y videos post-partido, además de escudos HD en PNG (`500px` y versión dark).
- **Resolución automática de anomalías**:
  - Detección y alineación de **local/visitante invertido en sede neutral** (e.g. Copa Argentina) entre Promiedos y ESPN para que marcador, goles, tarjetas, estadísticas y formaciones siempre correspondan al mismo equipo.
  - **Fallback SSR `__NEXT_DATA__` automático** en ligas donde la API JSON de Promiedos devuelve error (`hc` / Liga Profesional).
  - **Extracción segura `__espnfitt__`** mediante escáner JSON balanceado sin backtracking.
- **Arquitectura preparada para el Plan Gratuito de Cloudflare Workers**:
  - **Caché multicapa**: L1 LRU en memoria + L2 Cloudflare Edge Cache API (`caches.default`) + L3 opcional Cloudflare KV (`FOOTBALL_KV`).
  - **Stale-While-Revalidate (SWR)** con deduplicación singleflight para solicitudes concurrentes y respaldo *stale* automático ante caídas de origen.
  - **Cron Trigger (`* * * * *`)** para mantener calientes los marcadores en vivo y el catálogo sin latencia fría para los usuarios de tu app.
- **Dashboard Web & OpenAPI 3.1 integrados**:
  - Explorador interactivo en `/` y `/docs`
  - Especificación OpenAPI 3.1 en `/openapi.json`

---

## Endpoints disponibles

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/` o `/docs` | Dashboard en vivo + Explorador interactivo JSON |
| `GET` | `/openapi.json` | Especificación OpenAPI 3.1.0 completa |
| `GET` | `/api/v1/health` | Estado del Worker, fuentes y estadísticas de caché |
| `GET` | `/api/v1/mappings` | Diccionario maestro de ligas (`Promiedos <-> ESPN`) |
| `GET` | `/api/v1/live` | Partidos disputándose actualmente en vivo |
| `GET` | `/api/v1/matches?date=today` | Todos los partidos del día ordenados por prioridad (`today`, `yesterday`, `tomorrow`, `YYYY-MM-DD`, `DD-MM-YYYY`, `YYYYMMDD`). Filtros opcionales: `league`, `state`, `team`, `live=true`, `refresh=true` |
| `GET` | `/api/v1/matches/:id` | Detalle completo fusionado (`pm:<id>`, `espn:<id>` o ID directo): eventos, alineaciones 2D + stats de jugadores, estadísticas, relato, H2H, últimos 5 partidos, ausentes, cuotas, videos y noticias |
| `GET` | `/api/v1/leagues` | Catálogo completo de categorías y torneos |
| `GET` | `/api/v1/leagues/:id` | Liga completa: tablas (posiciones, promedios, anual), llaves/brackets, rondas, partidos y tabla de goleadores/asistencias |
| `GET` | `/api/v1/leagues/:id/standings` | Solo tablas, llaves y líderes de jugadores de la liga |
| `GET` | `/api/v1/leagues/:id/rounds/:roundKey` | Partidos de una jornada/ronda específica |
| `GET` | `/api/v1/teams/:id` | Perfil de equipo (`pm-igg`, `igg`, `espn-5`, `5`): info, estadio + coordenadas GPS, plantel con fotos/stats, últimos y próximos partidos |
| `GET` | `/api/v1/search?q=...` | Búsqueda unificada de clubes, ligas y partidos |

### Slugs de ligas soportados directamente

Cualquiera de estos identificadores funciona en `/api/v1/leagues/:id` y `?league=...`:

- **Slugs canónicos**: `liga-profesional`, `copa-argentina`, `copa-de-la-liga`, `primera-nacional`, `primera-b-metropolitana`, `primera-c`, `federal-a`, `copa-libertadores`, `copa-sudamericana`, `champions-league`, `europa-league`, `premier-league`, `la-liga`, `serie-a`, `bundesliga`, `ligue-1`, `brasileirao`, `mls`, `eliminatorias-conmebol`, `copa-america`, `mundial`, entre 45 ligas mapeadas.
- **IDs de Promiedos**: `hc`, `gea`, `ebj`, `h`, `bbd`, etc.
- **Slugs ESPN**: `arg.1`, `arg.copa`, `eng.1`, `esp.1`, `ita.1`, `ger.1`, `uefa.champions`, `conmebol.libertadores`, etc.

---

## Instalación y desarrollo local

```bash
# 1. Instalar dependencias (Wrangler CLI, TypeScript y tipos de Workers)
npm install

# 2. Levantar servidor local con Cloudflare Wrangler (incluye simulación de Cron)
npm run dev

# 3. Verificación TypeScript y tests en vivo contra Promiedos + ESPN
npm run typecheck
npm run test:live
```

> Nota: Si usas Node.js v24+, `tests/verify-live.ts` puede ejecutarse directamente sin paso de compilación previo.

---

## Despliegue en Cloudflare Workers (Plan Gratuito)

1. Inicia sesión en Cloudflare:
   ```bash
   npx wrangler login
   ```
2. *(Opcional)* Crea un namespace KV para persistencia global entre reinicios de isolates:
   ```bash
   npx wrangler kv namespace create FOOTBALL_KV
   ```
   Luego descomenta el bloque `[[kv_namespaces]]` en [`wrangler.toml`](wrangler.toml) y pega tu `id`.
   *(El Worker funciona también sin KV usando memoria L1 + Cache API Edge L2).*
3. Despliega a producción:
   ```bash
   npm run deploy
   ```

El archivo [`wrangler.toml`](wrangler.toml) ya incluye `[triggers] crons = ["* * * * *"]` compatible con la cuota gratuita de Cloudflare Workers.

---

## Estructura del proyecto

```text
src/
├── config/
│   └── mappings.ts      # Diccionario maestro de 45 ligas, alias de clubes y códigos de eventos
├── scrapers/
│   ├── promiedos.ts     # Cliente Promiedos (API + HTML __NEXT_DATA__ fallback)
│   └── espn.ts          # Cliente ESPN Argentina (API + __espnfitt__ + summary/standings)
├── services/
│   └── fusion.ts        # Motor de emparejamiento, orientación neutral y fusión integral
├── types/
│   └── schema.ts        # Contratos TypeScript unificados para consumo en app móvil/web
├── ui/
│   └── dashboard.ts     # Dashboard HTML en tiempo real y generador OpenAPI 3.1
├── utils/
│   ├── cache.ts         # Caché L1 LRU + L2 Edge Cache + L3 KV con SWR y singleflight
│   ├── http.ts          # Fetch con AbortController, reintentos/backoff y parsers JSON seguros
│   └── normalize.ts     # Normalización de equipos, fechas AR (UTC-3), minutos y hashes
└── index.ts             # Entrypoint Hono + Cloudflare Worker fetch() & scheduled()
tests/
└── verify-live.ts       # Invariantes unitarios + pruebas E2E en vivo
```

---

## Ejemplo rápido de consumo en Flutter / Dart

```dart
final uri = Uri.parse('https://tu-worker.workers.dev/api/v1/matches?date=today');
final res = await http.get(uri);
final json = jsonDecode(res.body) as Map<String, dynamic>;

final leagues = (json['data']['leagues'] as List).cast<Map<String, dynamic>>();
for (final grp in leagues) {
  final leagueName = grp['league']['name'];
  final matches = grp['matches'] as List;
  // Cada partido incluye home/away.logo, status.isLive, status.minuteDisplay, goals, cards, broadcasts
}
```
