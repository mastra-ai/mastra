#!/usr/bin/env node
/**
 * Skills.sh API Server CLI
 * Standalone server for the Skills marketplace API
 */

import { serve } from '@hono/node-server';

import { createSkillsApiServer } from './server.js';

const PORT = parseInt(process.env.PORT || '3456', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const AUTO_REFRESH = process.env.AUTO_REFRESH === 'true' || process.env.AUTO_REFRESH === '1';
const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL || '30', 10);

const app = createSkillsApiServer({
  cors: true,
  corsOrigin: CORS_ORIGIN,
  logging: true,
  enableAdmin: true,
  autoRefresh: AUTO_REFRESH,
  refreshIntervalMinutes: REFRESH_INTERVAL,
});

const autoRefreshStatus = AUTO_REFRESH ? `${REFRESH_INTERVAL} min` : 'disabled';

console.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎯 Skills.sh API Server                                 ║
║                                                           ║
║   Agent Skills Marketplace API                            ║
║   https://skills.sh                                       ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   Server:    http://${HOST}:${PORT.toString().padEnd(27)}║
║   API:       http://${HOST}:${PORT}/api/skills${' '.repeat(16)}║
║   Admin:     http://${HOST}:${PORT}/api/admin${' '.repeat(17)}║
║   Health:    http://${HOST}:${PORT}/health${' '.repeat(18)}║
║                                                           ║
║   Auto-refresh: ${autoRefreshStatus.padEnd(40)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
