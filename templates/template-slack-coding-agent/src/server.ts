/**
 * Standalone server entry point.
 * Run with: npx tsx --env-file=.env src/server.ts
 */
import { createNodeServer } from '@mastra/deployer/server';
import { mastra } from './mastra/index.js';

// Catch crashes so they appear in Railway logs instead of silently dying
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

async function main() {
  const PORT = Number(process.env.PORT) || 4211;
  console.log('Starting Slack coding agent server...');
  console.log(`SLACK_BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN ? 'set' : 'MISSING'}`);
  console.log(`SLACK_SIGNING_SECRET: ${process.env.SLACK_SIGNING_SECRET ? 'set' : 'MISSING'}`);
  console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING'}`);
  console.log(`E2B_API_KEY: ${process.env.E2B_API_KEY ? 'set' : 'MISSING'}`);
  await createNodeServer(mastra, { tools: {} });
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
  console.log(`Slack events endpoint: http://0.0.0.0:${PORT}/slack/coding/events`);
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
