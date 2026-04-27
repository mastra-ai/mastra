import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  bundler: {
    dynamicPackages: ['pino-opentelemetry-transport'],
  },
});
