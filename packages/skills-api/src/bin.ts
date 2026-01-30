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

const app = createSkillsApiServer({
  cors: true,
  corsOrigin: CORS_ORIGIN,
  logging: true,
});

// eslint-disable-next-line no-console
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
║   Health:    http://${HOST}:${PORT}/health${' '.repeat(18)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
