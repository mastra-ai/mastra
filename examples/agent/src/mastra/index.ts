import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { MastraCompositeStore, FilesystemStore, InMemoryDB, InMemoryStore } from '@mastra/core/storage';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';

import { mastraAuth, rbacProvider } from './auth';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { z } from 'zod';
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
  mcpAppsAgent,
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
  // editor: new FilesystemStore({ dir: '.mastra-storage' }),
});

const config = {
  agents: {
    gatewayAgent,
    chefAgent,
    chefAgentResponses,
    dynamicAgent,
    dynamicToolsAgent, // Dynamic tool search example
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
  },
  bundler: {
    sourcemap: true,
  },
  editor: new MastraEditor(),
  server: {
    auth: mastraAuth,
    rbac: rbacProvider,
  },
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
