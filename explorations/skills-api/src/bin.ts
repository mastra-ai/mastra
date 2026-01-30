#!/usr/bin/env node
/**
 * Skills.sh API Server CLI
 * Standalone server for the Skills marketplace API
 */

import { serve } from '@hono/node-server';

import { initializeData } from './registry/data.js';
import { createSkillsApiServer } from './server.js';
import { getStorageInfo } from './storage/index.js';

const PORT = parseInt(process.env.PORT || '3456', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const AUTO_REFRESH = process.env.AUTO_REFRESH === 'true' || process.env.AUTO_REFRESH === '1';
const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL || '30', 10);

async function main() {
  // Initialize data (loads from S3 if configured)
  await initializeData();

  const app = createSkillsApiServer({
    cors: true,
    corsOrigin: CORS_ORIGIN,
    logging: true,
    enableAdmin: true,
    autoRefresh: AUTO_REFRESH,
    refreshIntervalMinutes: REFRESH_INTERVAL,
  });

  const autoRefreshStatus = AUTO_REFRESH ? `${REFRESH_INTERVAL} min` : 'disabled';
  const storageInfo = getStorageInfo();

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
║   Server:       http://${HOST}:${PORT.toString().padEnd(24)}║
║   API:          http://${HOST}:${PORT}/api/skills${' '.repeat(13)}║
║   Admin:        http://${HOST}:${PORT}/api/admin${' '.repeat(14)}║
║   Health:       http://${HOST}:${PORT}/health${' '.repeat(15)}║
║                                                           ║
║   Auto-refresh: ${autoRefreshStatus.padEnd(40)}║
║   Storage:      ${storageInfo.type.padEnd(40)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

  if (storageInfo.s3.configured) {
    console.info(`[Storage] S3: s3://${storageInfo.s3.bucket}/${storageInfo.s3.key}`);
    if (storageInfo.s3.endpoint) {
      console.info(`[Storage] S3 Endpoint: ${storageInfo.s3.endpoint}`);
    }
  }

  if (storageInfo.filesystem.dataDir) {
    console.info(`[Storage] Filesystem: ${storageInfo.filesystem.dataDir}`);
  }

  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
