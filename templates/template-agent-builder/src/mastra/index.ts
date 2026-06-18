import { Mastra } from '@mastra/core/mastra';
import { MastraEditor } from '@mastra/editor';
import { ComposioToolProvider } from '@mastra/editor/composio';
import { createBuilderAgent } from '@mastra/editor/ee';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';
import { SlackProvider } from '@mastra/slack';
import { StagehandBrowser } from '@mastra/stagehand';

import { initWorkOS } from './auth';
import { getEnv, hasEnv } from './env';
import { workspace } from './workspace';

const workos = await initWorkOS();

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

const hasComposio = hasEnv('COMPOSIO_API_KEY');
const hasSlack = hasEnv('SLACK_APP_CONFIG_TOKEN') && hasEnv('SLACK_APP_CONFIG_REFRESH_TOKEN');
const hasBrowserbase = hasEnv('BROWSERBASE_API_KEY') && hasEnv('BROWSERBASE_PROJECT_ID');

const editor = new MastraEditor({
  ...(hasComposio
    ? {
        toolProviders: {
          composio: new ComposioToolProvider({ apiKey: getEnv('COMPOSIO_API_KEY')! }),
        },
      }
    : {}),
  ...(hasBrowserbase
    ? {
        browsers: {
          stagehand: {
            id: 'stagehand',
            name: 'Stagehand Browser',
            createBrowser: config =>
              new StagehandBrowser({
                ...config,
                apiKey: getEnv('BROWSERBASE_API_KEY')!,
                env: 'BROWSERBASE',
                projectId: getEnv('BROWSERBASE_PROJECT_ID')!,
              }),
          },
        },
      }
    : {}),
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
        browser: hasBrowserbase,
        avatarUpload: true,
      },
    },
    configuration: {
      agent: {
        workspace: { type: 'id', workspaceId: workspace.id },
        memory: {
          observationalMemory: true,
          options: {
            lastMessages: 10,
          },
        },
        models: {
          allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-sonnet-4-6' }],
          default: {
            provider: 'openai',
            modelId: 'gpt-5',
          },
        },
        ...(hasBrowserbase
          ? {
              browser: {
                type: 'inline',
                config: {
                  provider: 'stagehand',
                },
              },
            }
          : {}),
      },
    },
  },
});

export const mastra = new Mastra({
  storage,
  workspace,
  agents: {
    builderAgent: createBuilderAgent(),
  },
  bundler: {
    sourcemap: true,
  },
  server: {
    ...(workos
      ? {
          auth: workos.mastraAuth,
          rbac: workos.rbacProvider,
        }
      : {}),
    build: {
      swaggerUI: true,
    },
  },
  ...(hasSlack
    ? {
        channels: {
          slack: new SlackProvider({
            token: getEnv('SLACK_APP_CONFIG_TOKEN'),
            refreshToken: getEnv('SLACK_APP_CONFIG_REFRESH_TOKEN'),
            baseUrl: getEnv('SLACK_BASE_URL'),
          }),
        },
      }
    : {}),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'agent-builder-template',
        exporters: [new DefaultExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  editor,
});
