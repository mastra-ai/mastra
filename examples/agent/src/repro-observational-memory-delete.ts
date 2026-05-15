import 'dotenv/config';

import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';

const cleanup = process.argv.includes('--cleanup');
const threadId = `repro-om-delete-${Date.now()}`;
const resourceId = `resource-${Date.now()}`;
const model = process.env.REPRO_OPENAI_MODEL || 'openai/gpt-4o-mini';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Set OPENAI_API_KEY before running this repro.');
}

const storage = new LibSQLStore({
  id: 'repro-observational-memory-delete',
  url: 'file:./mastra.db',
});

const memory = new Memory({
  storage,
  options: {
    observationalMemory: {
      scope: 'thread',
      observation: {
        model,
        messageTokens: 1,
        bufferTokens: false,
      },
    },
  },
});

const memoryStore = await storage.getStore('memory');
if (!memoryStore) {
  throw new Error('Memory store is not available.');
}
await memoryStore.init?.();

const weatherAgent = new Agent({
  id: 'repro-weather-agent',
  name: 'Repro Weather Agent',
  instructions: 'You are a concise weather agent. Answer weather questions directly in one sentence.',
  model,
  memory,
});

await weatherAgent.generate('What is the weather in San Francisco? I wanna go there in 3 days.', {
  memory: {
    thread: threadId,
    resource: resourceId,
  },
});

const om = await memory.omEngine;
if (!om) {
  throw new Error('Observational memory engine is not available.');
}

const status = await om.getStatus({ threadId, resourceId });
if (status.shouldObserve) {
  await om.observe({ threadId, resourceId });
}

const beforeThread = await memory.getThreadById({ threadId });
const beforeObservationalMemory = await memoryStore.getObservationalMemory(threadId, resourceId);

await memory.deleteThread(threadId);

const afterThread = await memory.getThreadById({ threadId });
const afterObservationalMemory = await memoryStore.getObservationalMemory(threadId, resourceId);

console.log(
  JSON.stringify(
    {
      threadId,
      resourceId,
      beforeDelete: {
        threadExists: Boolean(beforeThread),
        observationalMemoryExists: Boolean(beforeObservationalMemory),
        activeObservations:
          beforeObservationalMemory?.activeObservations?.slice(0, 300) || '(activeObservations is empty)',
      },
      afterDelete: {
        threadExists: Boolean(afterThread),
        observationalMemoryExists: Boolean(afterObservationalMemory),
        activeObservations:
          afterObservationalMemory?.activeObservations?.slice(0, 300) || '(activeObservations is empty)',
      },
      expectedBug: 'thread is deleted, but thread-scoped observational memory still exists',
    },
    null,
    2,
  ),
);

if (cleanup) {
  await memoryStore.clearObservationalMemory(threadId, resourceId);
  console.log(`Cleaned up observational memory for ${threadId}`);
} else {
  console.log(`Run again with --cleanup if you want this script to remove the seeded OM row.`);
}
