import { Mastra } from '@mastra/core/mastra';
import { bootstrap } from './bootstrap.ts';

const config = await bootstrap();

export const mastra = new Mastra({
  ...config,
  // The Mastra CLI reads the server option directly from the constructor.
  server: config.server,
});
