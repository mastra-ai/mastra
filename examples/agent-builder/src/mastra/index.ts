import { Mastra } from '@mastra/core';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { builderAgent } from '@mastra/editor/ee';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { initWorkOS } from './auth';
import { StagehandBrowser } from '@mastra/stagehand';
import { DaytonaSandbox } from '@mastra/daytona';
import { ComposioToolProvider } from '@mastra/editor/composio';
import { weatherInfo } from './tools';
import { weatherAgent } from './agents';
import { greetWorkflow } from './workflows';
import { SlackProvider } from '@mastra/slack';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

const builderWorkspace = new Workspace({
  id: 'builder-workspace',
  name: 'Builder Workspace',
  filesystem: new LocalFilesystem({ basePath: '.mastra/workspace' }),
  sandbox: new DaytonaSandbox(),
});

const slack = new SlackProvider({
  token: process.env.SLACK_APP_CONFIG_TOKEN,
  refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
  baseUrl: process.env.SLACK_BASE_URL,
});

export const mastra = new Mastra({
  storage,
  workspace: builderWorkspace,
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
    toolProviders: {
      composio: new ComposioToolProvider({ apiKey: process.env.COMPOSIO_API_KEY ?? '' }),
    },
    sandboxes: {
      daytona: {
        id: 'daytona',
        name: 'Daytona Sandbox',
        description: 'Remote sandbox powered by Daytona',
        createSandbox: () => new DaytonaSandbox(),
      },
    },
    browsers: {
      stagehand: {
        id: 'stagehand',
        name: 'Stagehand Browser',
        createBrowser: config =>
          new StagehandBrowser({
            ...config,
            env: 'LOCAL',
            headless: true,
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
          stars: true,
          skills: true,
          model: true,
          browser: true,
          avatarUpload: true,
        },
        skill: {
          stars: true,
        },
      },
      configuration: {
        agent: {
          workspace: { type: 'id', workspaceId: 'builder-workspace' },
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
          tools: { allowed: ['weather-info'] },
          agents: { allowed: ['weather-agent'] },
          workflows: { allowed: ['greet-workflow'] },
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
