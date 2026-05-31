import { Mastra } from '@mastra/core';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { createBuilderAgent } from '@mastra/editor/ee';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { initWorkOS } from './auth';
import { StagehandBrowser } from '@mastra/stagehand';
import { ComposioToolProvider } from '@mastra/editor/composio';
import { weatherInfo, diceRoll, coinFlip, randomQuote } from './tools';
import { weatherAgent } from './agents';
import { greetWorkflow } from './workflows';
import { SlackProvider } from '@mastra/slack';
import { workspace } from './workspace';
import { e2bSandboxProvider } from '@mastra/e2b';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

const slack = new SlackProvider({
  token: process.env.SLACK_APP_CONFIG_TOKEN,
  refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
  baseUrl: process.env.SLACK_BASE_URL,
});

const workos = await initWorkOS();

export const mastra = new Mastra({
  storage,
  channels: { slack },
  agents: {
    builderAgent: createBuilderAgent(),
    weatherAgent,
  },
  tools: {
    weatherInfo,
    diceRoll,
    coinFlip,
    randomQuote,
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
    sandboxes: { e2b: e2bSandboxProvider },
    toolProviders: {
      composio: new ComposioToolProvider({ apiKey: process.env.COMPOSIO_API_KEY ?? '' }),
    },
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
      features: {
        agent: {
          tools: true,
          agents: true,
          workflows: true,
          favorites: true,
          model: true,
          browser: true,
          avatarUpload: true,
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
          memory: {
            observationalMemory: true,
          },
          agents: { allowed: ['weather-agent'] },
          workflows: { allowed: ['greet-workflow'] },
          browser: {
            type: 'inline',
            config: {
              provider: 'stagehand',
            },
          },
          workspace: { type: 'id', workspaceId: workspace.id },
        },
      },
    },
  }),
  workspace,
});
