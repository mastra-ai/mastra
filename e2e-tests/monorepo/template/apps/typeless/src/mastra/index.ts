import { Mastra } from '@mastra/core/mastra';
import { apiRoutes, bundlerOptions } from './config';

export const mastra = new Mastra({
  server: { apiRoutes },
  bundler: bundlerOptions,
});
