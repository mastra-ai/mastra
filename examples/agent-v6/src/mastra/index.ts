import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { weatherToolLoopAgent } from './agents';
import { PinoLogger } from '@mastra/loggers';
import { Observability } from '@mastra/observability';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  storage,
  agents: {
    weatherToolLoopAgent,
  },
  bundler: {
    sourcemap: true,
  },
  server: {
    build: {
      swaggerUI: true,
    },
  },
  logger: new PinoLogger({ name: 'Chef', level: 'debug' }),
  observability: new Observability({
    default: { enabled: true },
  }),
});
