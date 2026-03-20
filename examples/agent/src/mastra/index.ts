import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter } from '@mastra/observability';

import { memoryTracingAgent } from './agents/index';

const libsqlStore = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  agents: {
    memoryTracingAgent,
  },
  storage: libsqlStore,
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new DefaultExporter()],
      },
    },
  }),
});
