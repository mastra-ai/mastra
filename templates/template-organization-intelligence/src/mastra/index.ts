import { fileURLToPath } from 'node:url';

import { Mastra } from '@mastra/core/mastra';

import { createOrganizationAgent } from './agents/organization-agent.js';
import { createOrganizationAnswerRoute, createOrganizationTelemetryRoute } from './api/organization.js';
import { createOrganizationApplication } from './application.js';
import { createOrganizationMcpServer } from './mcp/organization.js';
import { InitialSynchronization } from './workers/initial-synchronization.js';
import { createSourceInspectionWorkflow } from './workflows/source-inspection.js';
import { createSourceSearchWorkflow } from './workflows/source-search.js';
import { createSourceSyncWorkflow } from './workflows/source-sync.js';

const application = await createOrganizationApplication({
  projectRoot: fileURLToPath(new URL('../../', import.meta.url)),
});
// Mastra's CLI config extraction requires identifier bindings instead of top-level destructuring.
const index = application.index;
const storage = application.storage;
const sources = application.sources;
const organizationAgent = createOrganizationAgent(index);
const sourceSyncWorkflow = createSourceSyncWorkflow(index);
const mcpServer = createOrganizationMcpServer(organizationAgent);

export const mastra = new Mastra({
  logger: false,
  storage,
  workspace: sources.workspace,
  agents: { organizationAgent },
  workflows: {
    sourceInspectionWorkflow: createSourceInspectionWorkflow(sources),
    sourceSyncWorkflow,
    sourceSearchWorkflow: createSourceSearchWorkflow(index),
  },
  mcpServers: { organizationIntelligence: mcpServer },
  server: {
    host: '127.0.0.1',
    cors: {
      // Studio includes credentials when localhost connects to the loopback API.
      origin: origin => (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : undefined),
      credentials: true,
    },
    apiRoutes: [createOrganizationAnswerRoute(organizationAgent), createOrganizationTelemetryRoute(index)],
  },
  workers: [new InitialSynchronization(index, storage, sourceSyncWorkflow)],
});
