import { Mastra } from '@mastra/core/mastra';
import { MastraCompositeStore } from '@mastra/core/storage';
import { MastraEditor } from '@mastra/editor';
import { ComposioToolProvider } from '@mastra/editor/composio';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability';
import { SlackProvider } from '@mastra/slack';

import { mastraAuth, rbacProvider, fgaProvider } from './auth';
import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';

import {
  agentThatHarassesYou,
  chefAgent,
  chefAgentResponses,
  dynamicAgent,
  evalAgent,
  dynamicToolsAgent,
  schemaValidatedAgent,
  requestContextDemoAgent,
  mcpAppsAgent,
  slackDemoAgent,
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
    chefAgent,
    chefAgentResponses,
    dynamicAgent,
    dynamicToolsAgent,
    agentThatHarassesYou,
    evalAgent,
    schemaValidatedAgent,
    requestContextDemoAgent,
    mcpAppsAgent,
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
    heartbeatWorkflow,
    multiCadenceWorkflow,
  },
  bundler: {
    sourcemap: true,
    externals: ['@duckdb/node-bindings', '@mastra/duckdb'],
  },
  editor: new MastraEditor({
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
    // Server auth (external customers) - uses WorkOS to list all users (not org-filtered)
    auth: new MastraAuthWorkos({
      redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:4222/api/auth/sso/callback',
      fetchMemberships: false, // Don't need memberships for customer listing
      organizationId: '', // Explicitly empty to list ALL users, not just org members
    }),
    rbac: rbacProvider,
    fga: fgaProvider,
  },
  // Studio auth (internal team) - uses WorkOS for SSO with org memberships
  studio: {
    auth: new MastraAuthWorkos({
      redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:4222/api/auth/sso/callback',
      fetchMemberships: true, // Fetch org memberships for team filtering
      organizationId: process.env.WORKOS_ORGANIZATION_ID, // Filter to this org
    }),
    rbac: new MastraRBACWorkos({
      organizationId: process.env.WORKOS_ORGANIZATION_ID,
      // mode: 'static' (default) - roleMapping is source of truth, roles are read-only in UI
      // mode: 'seed' - roleMapping used for `mastra migrate`, WorkOS is source of truth, roles editable in UI
      roleMapping: {
        owner: ['*'], // Full access
        admin: ['*:read', '*:write', '*:execute', '*:delete'], // All actions
        member: ['*:read', '*:execute'], // Read and execute
        viewer: ['*:read'], // Read only
      },
    }),
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
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
