import { Mastra } from '@mastra/core';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { builderAgent } from '@mastra/editor/ee';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { initWorkOS } from './auth';
import { StagehandBrowser } from '@mastra/stagehand';
import { ComposioToolIntegration } from '@mastra/editor/composio';
import { weatherInfo } from './tools';
import { weatherAgent } from './agents';
import { greetWorkflow } from './workflows';
import { SlackProvider } from '@mastra/slack';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

const slack = new SlackProvider({
  refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
  baseUrl: process.env.SLACK_BASE_URL,
});

const workos = await initWorkOS();

export const mastra = new Mastra({
  storage,
  channels: { slack },
  agents: {
    builderAgent,
    weatherAgent,
  },
  tools: {
    weatherInfo,
  },
  workflows: {
    greetWorkflow,
  },
  bundler: {
    sourcemap: true,
  },
  server: {
    auth: workos.mastraAuth,
    rbac: workos.rbacProvider,
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
    toolIntegrations: [
      new ComposioToolIntegration({
        apiKey: process.env.COMPOSIO_API_KEY!,
        allowedToolServices: [
          'gmail',
        ],
      })],
    browsers: {
      stagehand: {
        id: 'stagehand',
        name: 'Stagehand Browser',
        createBrowser: config =>
          new StagehandBrowser({
            ...config,
            apiKey: process.env.BROWSERBASE_API_KEY ?? '',
            env: 'BROWSERBASE',
            projectId: process.env.BROWSERBASE_PROJECT_ID ?? '',
          }),
      },
    },
    builder: {
      enabled: true,
      configuration: {
        agent: {
          models: {
            allowed: [{ provider: 'openai', modelId: 'gpt-5.4-mini' }],
          },
          memory: {
            observationalMemory: true,
          },
          browser: {
            type: 'inline',
            config: {
              provider: 'stagehand',
            },
          },
        },
      },
    },
  }),
});
