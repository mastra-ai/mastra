import type { Context } from 'hono';
import { Mastra } from '@mastra/core/mastra';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { MastraEditor } from '@mastra/editor';
import { createBuilderAgent } from '@mastra/editor/ee';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';
import { SlackProvider } from '@mastra/slack';
import { StagehandBrowser } from '@mastra/stagehand';

import { mastraAuth, rbacProvider } from './auth';
import { weatherAgent } from './agents';
import { weatherInfo } from './tools';
import { greetWorkflow } from './workflows';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

const builderWorkspace = new Workspace({
  id: 'builder-workspace',
  name: 'Builder Workspace',
  filesystem: new LocalFilesystem({ basePath: '.mastra/workspace' }),
});

export const mastra = new Mastra({
  storage,
  workspace: builderWorkspace,
  agents: {
    builderAgent: createBuilderAgent(),
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
  channels: {
    slack: new SlackProvider({
      baseUrl: process.env.MASTRA_BASE_URL,
    }),
  },
  server: {
    auth: mastraAuth,
    rbac: rbacProvider,
    build: {
      swaggerUI: true,
    },
    // Smoke-test cookie leak route. Off by default; set SMOKE_TEST_COOKIE_LEAK=1
    // in .env to enable. Lets the smoke-test agent read the WorkOS session
    // cookie (which is httpOnly and hidden from document.cookie) so it can
    // hit authenticated endpoints from curl after a browser SSO login.
    apiRoutes:
      process.env.SMOKE_TEST_COOKIE_LEAK === '1'
        ? [
            {
              path: '/smoke-test/cookie',
              method: 'GET' as const,
              handler: async (c: Context) => c.text(c.req.header('cookie') ?? ''),
            },
          ]
        : undefined,
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'builder-smoke',
        exporters: [new DefaultExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  editor: new MastraEditor({
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
          skills: true,
          model: true,
          browser: true,
          avatarUpload: true,
        },
        skill: {
          favorites: true,
        },
      },
      configuration: {
        agent: {
          workspace: { type: 'id', workspaceId: 'builder-workspace' },
          memory: {
            observationalMemory: true,
            options: {
              lastMessages: 10,
            },
          },
          browser: {
            type: 'inline',
            config: {
              provider: 'stagehand',
            },
          },
          models: {
            allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }],
            default: {
              provider: 'openai',
              modelId: 'gpt-5.4',
            },
          },
          tools: { allowed: ['weather-info'] },
          agents: { allowed: ['weather-agent'] },
          workflows: { allowed: ['greet-workflow'] },
        },
      },
    },
  }),
});
