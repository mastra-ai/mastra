import { Mastra } from '@mastra/core/mastra';

import { createOrganizationAgent } from '../../src/mastra/agents/organization-agent.js';
import { createOrganizationAnswerRoute, createOrganizationTelemetryRoute } from '../../src/mastra/api/organization.js';
import type { ApplicationOptions } from '../../src/mastra/application.js';
import { createOrganizationApplication as createApplication } from '../../src/mastra/application.js';
import { createOrganizationMcpServer } from '../../src/mastra/mcp/organization.js';
import { InitialSynchronization } from '../../src/mastra/workers/initial-synchronization.js';
import { createSourceInspectionWorkflow } from '../../src/mastra/workflows/source-inspection.js';
import { createSourceSearchWorkflow } from '../../src/mastra/workflows/source-search.js';
import { createSourceSyncWorkflow } from '../../src/mastra/workflows/source-sync.js';

export async function createOrganizationApplication(
  options: ApplicationOptions & { answerModel?: Parameters<typeof createOrganizationAgent>[1] },
) {
  const application = await createApplication(options);
  const { index, storage, sources } = application;
  const organizationAgent = createOrganizationAgent(index, options.answerModel);
  const sourceSyncWorkflow = createSourceSyncWorkflow(index);
  const mcpServer = createOrganizationMcpServer(organizationAgent);
  const mastra = new Mastra({
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
      apiRoutes: [createOrganizationAnswerRoute(organizationAgent), createOrganizationTelemetryRoute(index)],
    },
    workers: [new InitialSynchronization(index, storage, sourceSyncWorkflow)],
  });
  return { ...application, organizationAgent, mcpServer, mastra };
}
