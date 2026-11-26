import { Mastra } from '@mastra/core/mastra';
import { bootstrap } from './bootstrap.ts';

// Studio uses the streaming route, which binds the authenticated customer thread.
process.env.MASTRA_AGENT_SIGNALS = 'false';
const config = await bootstrap();

export const mastra = new Mastra({
  ...config,
  // The Mastra CLI reads the server option directly from the constructor.
  server: config.server,
});
