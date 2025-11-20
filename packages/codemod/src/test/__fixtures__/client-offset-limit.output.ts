// @ts-nocheck

import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({
  baseUrl: 'http://localhost:3000',
});

async function demonstrateAllPaginationMethods() {
  await client.listMemoryThreads({
    resourceId: 'user-123',
    agentId: 'support-agent',
    page: 0,
    perPage: 20,
  });

  await client.listLogs({
    transportId: 'console',
    page: 0,
    perPage: 50,
  });

  await client.getLogForRun({
    runId: 'run-abc-123',
    transportId: 'console',
    page: 0,
    perPage: 25,
  });

  await client.getMcpServers({
    page: 0,
    perPage: 10,
  });

  await client.listScoresByScorerId({
    scorerId: 'quality-scorer',
    page: 0,
    perPage: 30,
  });

  await client.listScoresByRunId({
    runId: 'run-abc-123',
    page: 0,
    perPage: 20,
  });

  await client.listScoresByEntityId({
    entityId: 'agent-1',
    entityType: 'agent',
    page: 0,
    perPage: 15,
  });

  await client.getTraces({
    pagination: {
      page: 0,
      perPage: 40,
    },
  });

  await client.listScoresBySpan({
    traceId: 'trace-xyz-789',
    spanId: 'span-abc-456',
    page: 0,
    perPage: 10,
  });

  const memoryThread = client.getMemoryThread({
    threadId: 'thread-123',
    agentId: 'support-agent',
  });

  await memoryThread.listMessages({
    page: 0,
    perPage: 50,
  });

  const workflow = client.getWorkflow('data-processing-workflow');

  await workflow.runs({
    page: 0,
    perPage: 25,
  });

  const agentBuilder = client.getAgentBuilderAction('validate-agent-config');

  await agentBuilder.runs({
    page: 0,
    perPage: 10,
  });
}

demonstrateAllPaginationMethods().catch(console.error);
