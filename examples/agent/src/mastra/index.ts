import { Mastra, type Config } from '@mastra/core/mastra';

import { MastraCompositeStore, FilesystemStore, InMemoryDB, InMemoryStore } from '@mastra/core/storage';
import { MastraEditor } from '@mastra/editor';
import { builderAgent } from '@mastra/editor/ee';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';

import { mastraAuth, rbacProvider } from './auth';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';

import { ComposioToolProvider } from '@mastra/editor/composio';

import {
  agentThatHarassesYou,
  chefAgent,
  chefAgentResponses,
  dynamicAgent,
  evalAgent,
  dynamicToolsAgent,
  schemaValidatedAgent,
  requestContextDemoAgent,
} from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';
import { lessComplexWorkflow, myWorkflow } from './workflows';
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
import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';

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
  // editor: new FilesystemStore({ dir: '.mastra-storage' }),
});

const workspace = new Workspace({
  id: 'builder-workspace',
  sandbox: new DaytonaSandbox(),
});

const config: Config = {
  agents: {
    builderAgent,
    gatewayAgent,
    chefAgent,
    chefAgentResponses,
    dynamicAgent,
    dynamicToolsAgent, // Dynamic tool search example
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
  },
  bundler: {
    sourcemap: true,
  },
  editor: new MastraEditor(),
  server: {
    auth: mastraAuth,
    rbac: rbacProvider,
  },
  workspace,
};

export const mastra = new Mastra({
  ...config,
  backgroundTasks: {
    enabled: true,
    globalConcurrency: 10,
    perAgentConcurrency: 5,
  },
  editor: new MastraEditor({
    toolProviders: {
      composio: new ComposioToolProvider({ apiKey: '' }),
    },
    builder: {
      enabled: true,
      features: {
        agent: {
          tools: true,
          agents: true,
          workflows: true,
          stars: true,
        },
        skill: {
          stars: true,
        },
      },
      configuration: {
        agent: {
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
