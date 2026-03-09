// @ts-nocheck

import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({
  baseUrl: 'http://localhost:3000',
});

async function demonstrateAllPaginationMethods() {
  await client.listMemoryThreads({
    resourceId: 'user-123',
    agentId: 'support-agent',
    offset: 0,
    limit: 20,
  });

  await client.listLogs({
    transportId: 'console',
    offset: 0,
    limit: 50,
  });

  await client.getLogForRun({
    runId: 'run-abc-123',
    transportId: 'console',
    offset: 0,
    limit: 25,
  });

  await client.getMcpServers({
    offset: 0,
    limit: 10,
  });

  await client.listScoresByScorerId({
    scorerId: 'quality-scorer',
    offset: 0,
    limit: 30,
  });

  await client.listScoresByRunId({
    runId: 'run-abc-123',
    offset: 0,
    limit: 20,
  });

  await client.listScoresByEntityId({
    entityId: 'agent-1',
    entityType: 'agent',
    offset: 0,
    limit: 15,
  });

  await client.getTraces({
    pagination: {
      offset: 0,
      limit: 40,
    },
  });

  await client.listScoresBySpan({
    traceId: 'trace-xyz-789',
    spanId: 'span-abc-456',
    offset: 0,
    limit: 10,
  });

  const memoryThread = client.getMemoryThread({
    threadId: 'thread-123',
    agentId: 'support-agent',
  });

  await memoryThread.listMessages({
    offset: 0,
    limit: 50,
  });

  const workflow = client.getWorkflow('data-processing-workflow');

  await workflow.runs({
    offset: 0,
    limit: 25,
  });

  const agentBuilder = client.getAgentBuilderAction('validate-agent-config');

  await agentBuilder.runs({
    offset: 0,
    limit: 10,
  });
}

demonstrateAllPaginationMethods().catch(console.error);
