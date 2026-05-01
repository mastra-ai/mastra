import { Mastra } from '@mastra/core/mastra';
import { MastraCompositeStore } from '@mastra/core/storage';
import { MastraEditor } from '@mastra/editor';
import { builderAgent } from '@mastra/editor/ee';
import { ComposioToolProvider } from '@mastra/editor/composio';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';
import { SlackProvider } from '@mastra/slack';

import { mastraAuth, rbacProvider } from './auth';

import {
  agentThatHarassesYou,
  chefAgent,
  chefAgentResponses,
  dynamicAgent,
  evalAgent,
  dynamicToolsAgent,
  schemaValidatedAgent,
  requestContextDemoAgent,
  slackDemoAgent,
} from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';
import { lessComplexWorkflow, myWorkflow } from './workflows';
import { heartbeatWorkflow, multiCadenceWorkflow } from './workflows/scheduled';
import {
  chefModelV2Agent,
  networkAgent,
  agentWithAdvancedModeration,
  agentWithBranchingModeration,
  agentWithSequentialModeration,
  supervisorAgent,
  subscriptionOrchestratorAgent,
  cryptoResearchAgent,
} from './agents/model-v2-agent';
import { myWorkflowX, nestedWorkflow, findUserWorkflow } from './workflows/other';
import { moderationProcessor } from './agents/model-v2-agent';
import {
  moderatedAssistantAgent,
  agentWithProcessorWorkflow,
  contentModerationWorkflow,
  simpleAssistantAgent,
  agentWithBranchingWorkflow,
  advancedModerationWorkflow,
} from './workflows/content-moderation';
import {
  piiDetectionProcessor,
  toxicityCheckProcessor,
  responseQualityProcessor,
  sensitiveTopicBlocker,
  stepLoggerProcessor,
} from './processors/index';
import { gatewayAgent } from './agents/gateway';
import { DaytonaSandbox } from '@mastra/daytona';
import { StagehandBrowser } from '@mastra/stagehand';

const libsqlStore = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

const duckdbStore = new DuckDBStore({ path: './mastra-observability.duckdb' });
const storage = new MastraCompositeStore({
  id: 'composite-storage',
  default: libsqlStore,
  domains: {
    observability: duckdbStore.observability,
  },
});

export const mastra = new Mastra({
  agents: {
    builderAgent,
    gatewayAgent,
    chefAgent,
    chefAgentResponses,
    dynamicAgent,
    dynamicToolsAgent,
    agentThatHarassesYou,
    evalAgent,
    schemaValidatedAgent,
    requestContextDemoAgent,
    chefModelV2Agent,
    networkAgent,
    moderatedAssistantAgent,
    agentWithProcessorWorkflow,
    simpleAssistantAgent,
    agentWithBranchingWorkflow,
    agentWithAdvancedModeration,
    agentWithBranchingModeration,
    agentWithSequentialModeration,
    supervisorAgent,
    subscriptionOrchestratorAgent,
    cryptoResearchAgent,
    slackDemoAgent,
  },
  processors: {
    moderationProcessor,
    piiDetectionProcessor,
    toxicityCheckProcessor,
    responseQualityProcessor,
    sensitiveTopicBlocker,
    stepLoggerProcessor,
  },
  storage,
  mcpServers: {
    myMcpServer,
    myMcpServerTwo,
  },
  workflows: {
    myWorkflow,
    myWorkflowX,
    lessComplexWorkflow,
    nestedWorkflow,
    contentModerationWorkflow,
    advancedModerationWorkflow,
    findUserWorkflow,
    heartbeatWorkflow,
    multiCadenceWorkflow,
  },
  bundler: {
    sourcemap: true,
  },

  editor: new MastraEditor({
    toolProviders: {
      composio: new ComposioToolProvider({ apiKey: '' }),
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
          stars: true,
          skills: true,
          model: true,
          browser: true,
        },
        skill: {
          stars: true,
        },
      },
      configuration: {
        agent: {
          workspace: { type: 'id', workspaceId: 'builder-workspace' },
          // workspace: {
          //   type: 'inline',
          //   config: {
          //     name: 'builder-workspace',
          //     filesystem: { provider: 'local', config: { basePath: '.mastra/workspace' } },
          //     sandbox: { provider: 'daytona', config: {} },
          //   },
          // },
          memory: {
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
        },
      },
    },
  }),
  channels: {
    slack: new SlackProvider({
      baseUrl: process.env.MASTRA_BASE_URL,
    }),
  },
  server: {
    auth: mastraAuth,
    rbac: rbacProvider,
  },
  backgroundTasks: {
    enabled: true,
    globalConcurrency: 10,
    perAgentConcurrency: 5,
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new DefaultExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
