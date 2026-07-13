import { Mastra } from '@mastra/core/mastra';
import { MastraCompositeStore } from '@mastra/core/storage';
import { MastraEditor } from '@mastra/editor';
import { ComposioToolProvider } from '@mastra/editor/composio';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability';
import { SlackProvider } from '@mastra/slack';

import {
  mastraAuth,
  rbacProvider,
  fgaProvider,
  studioAuth,
  studioRbac,
  studioFga,
  serverAuth,
  serverRbac,
  serverFga,
} from './auth';

import {
  agentThatHarassesYou,
  chefAgent,
  chefAgentResponses,
  codeOverrideEditableAgent,
  codeOverrideLockedAgent,
  codeOverrideDescriptionsOnlyAgent,
  dynamicAgent,
  evalAgent,
  dynamicToolsAgent,
  schemaValidatedAgent,
  requestContextDemoAgent,
  mcpAppsAgent,
  slackDemoAgent,
  billingAgent,
  balanceAgent,
  guardrailsInputDemoAgent,
  guardrailsStreamingDemoAgent,
  guardrailsComparisonAgents,
} from './agents/index';
import { MCPClient } from '@mastra/mcp';
import { myMcpServer, myMcpServerTwo, mcpAppsServer } from './mcp/server';

// Non-Mastra MCP server — uses @modelcontextprotocol/sdk directly via stdio.
// toMCPServerProxies() wraps each MCPClient connection as an MCPServerBase so
// it appears in Studio alongside native MCPServer instances.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// Resolve the project root reliably even when running from the bundled output.
// Walk up from the bundled file's directory, skipping the .mastra output tree.
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    const hasPackageJson = existsSync(resolve(dir, 'package.json'));
    const isInsideMastraOutput = dir.includes('.mastra');
    if (hasPackageJson && !isInsideMastraOutput) return dir;
    dir = dirname(dir);
  }
  return startDir;
}
const projectRoot = findProjectRoot(dirname(fileURLToPath(import.meta.url)));

const externalMcpClient = new MCPClient({
  servers: {
    'external-mcp-apps': {
      command: 'npx',
      args: ['tsx', resolve(projectRoot, 'src', 'mastra', 'mcp', 'external-app-server.ts')],
      cwd: projectRoot,
    },
  },
});
import { lessComplexWorkflow, myWorkflow } from './workflows';
import { refundWorkflow } from './workflows/refund-workflow';
import { tickWorkflow, multiCadenceWorkflow } from './workflows/scheduled';
import {
  chefModelV2Agent,
  networkAgent,
  agentWithAdvancedModeration,
  agentWithBranchingModeration,
  agentWithSequentialModeration,
  supervisorAgent,
  durableSupervisorAgent,
  subscriptionOrchestratorAgent,
  cryptoResearchAgent,
  durableCryptoResearchAgent,
} from './agents/model-v2-agent';
import { myWorkflowX, nestedWorkflow, findUserWorkflow } from './workflows/other';
import { moderationProcessor } from './agents/model-v2-agent';
import {
  moderatedAssistantAgent,
  agentWithProcessorWorkflow,
  durableAgentWithProcessorWorkflow,
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
import { askUserAgent } from './agents/ask-user-agent';
import { codeModeAgent } from './agents/code-mode-agent';
import { clinicDirectAgent, clinicSpecialistAgent, clinicSupervisorAgent } from './agents/clinic-context-agents';
import { approvalDemoAgent } from './agents/approval-demo-agent';

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
    gatewayAgent,
    askUserAgent,
    approvalDemoAgent,
    chefAgent,
    chefAgentResponses,
    codeOverrideEditableAgent,
    codeOverrideLockedAgent,
    codeOverrideDescriptionsOnlyAgent,
    dynamicAgent,
    dynamicToolsAgent,
    billingAgent,
    balanceAgent,
    guardrailsInputDemoAgent,
    guardrailsStreamingDemoAgent,
    ...guardrailsComparisonAgents,
    agentThatHarassesYou,
    evalAgent,
    schemaValidatedAgent,
    requestContextDemoAgent,
    mcpAppsAgent,
    chefModelV2Agent,
    networkAgent,
    moderatedAssistantAgent,
    agentWithProcessorWorkflow,
    durableAgentWithProcessorWorkflow,
    simpleAssistantAgent,
    agentWithBranchingWorkflow,
    agentWithAdvancedModeration,
    agentWithBranchingModeration,
    agentWithSequentialModeration,
    supervisorAgent,
    durableSupervisorAgent,
    subscriptionOrchestratorAgent,
    cryptoResearchAgent,
    durableCryptoResearchAgent,
    slackDemoAgent,
    codeModeAgent,
    clinicDirectAgent,
    clinicSpecialistAgent,
    clinicSupervisorAgent,
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
    mcpAppsServer,
    ...externalMcpClient.toMCPServerProxies(),
  },
  workflows: {
    myWorkflow,
    myWorkflowX,
    lessComplexWorkflow,
    nestedWorkflow,
    contentModerationWorkflow,
    advancedModerationWorkflow,
    findUserWorkflow,
    tickWorkflow,
    multiCadenceWorkflow,
    refundWorkflow,
  },
  bundler: {
    sourcemap: true,
  },
  editor: new MastraEditor({
    source: 'code',
    toolProviders: {
      composio: new ComposioToolProvider({ apiKey: '' }),
    },
  }),
  channels: {
    slack: new SlackProvider({
      baseUrl: process.env.MASTRA_BASE_URL,
    }),
  },
  server: {
    // Use dual auth providers if available, otherwise fall back to single auth
    auth: serverAuth ?? mastraAuth,
    rbac: serverRbac ?? rbacProvider,
    fga: serverFga ?? fgaProvider,
  },
  studio: studioAuth
    ? {
        auth: studioAuth,
        rbac: studioRbac,
        fga: studioFga,
      }
    : undefined,
  backgroundTasks: {
    enabled: true,
    globalConcurrency: 10,
    perAgentConcurrency: 5,
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
