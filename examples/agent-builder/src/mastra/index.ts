import { Mastra } from '@mastra/core';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { builderAgent } from '@mastra/editor/ee';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { initWorkOS } from './auth';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  storage,
  agents: {
    builderAgent,
  },
  bundler: {
    sourcemap: true,
  },
  server: {
    auth: (await initWorkOS()).mastraAuth,
    build: {
      swaggerUI: true,
    },
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends observability data to hosted Mastra Studio (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
  editor: new MastraEditor({
    builder: {
      enabled: true,
      features: {
        agent: {
          tools: true,
          agents: true,
          workflows: true,
          stars: true,
          model: true,
        },
      },
      configuration: {
        agent: {
          models: {
            allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }],
            default: {
              provider: 'openai',
              modelId: 'gpt-5.4',
            },
          },
          workspace: { type: 'id', workspaceId: 'builder-workspace' },
          memory: {
            options: {
              lastMessages: 10,
            },
          },
        },
      },
    },
  }),
});
