// @ts-check
import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod';
import { Memory } from '../../../packages/memory/dist/index.js';
import { RedisStreamsPubSub } from '../src/index.ts';

const role = process.env.TAKEOVER_ROLE;
const runId = process.env.TAKEOVER_RUN_ID;
if (!runId) throw new Error('TAKEOVER_RUN_ID is required');
const leaseTtlMs = Number(process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS);
if (!Number.isFinite(leaseTtlMs) || leaseTtlMs <= 0) {
  throw new Error('MASTRA_AGENT_THREAD_LEASE_TTL_MS must be a positive number');
}
const schema = process.env.TAKEOVER_SCHEMA;
const storage = new PostgresStore({
  id: `api-loss-${role}`,
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  schemaName: schema,
});
const pubsub = new RedisStreamsPubSub({
  url: process.env.REDIS_URL,
  keyPrefix: process.env.TAKEOVER_PREFIX,
  blockMs: 100,
  reclaimIntervalMs: 1000,
});
await storage.init();
const tool = createTool({
  id: 'slowTool',
  description: 'Perform one recorded operation.',
  inputSchema: z.object({ index: z.number().int().min(0).max(3) }),
  execute: async ({ index }, context) => {
    if (!context.agent) throw new Error('Expected agent tool context');
    const callId = context.agent.toolCallId;
    const { id } = await storage.db.one(
      `INSERT INTO "${schema}".tool_executions (run_id, tool_call_id) VALUES ($1, $2) RETURNING id`,
      [runId, callId],
    );
    console.info(`tool-entered:${callId}`);
    // One sibling finishes early; the others outlive both execution and thread leases.
    /** @type {Promise<void>} */
    const completion = new Promise((resolve, reject) => {
      const signal = context.abortSignal;
      const abort = () => {
        clearTimeout(timer);
        console.info(`tool-aborted:${callId}`);
        reject(signal?.reason);
      };
      const timer = setTimeout(
        () => {
          signal?.removeEventListener('abort', abort);
          resolve();
        },
        index === 0 ? 2000 : leaseTtlMs * 2 + 5000,
      );
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    });
    await completion;
    await storage.db.none(`UPDATE "${schema}".tool_executions SET completed = true WHERE id = $1`, [id]);
    console.info(`tool-completed:${callId}`);
    return { index, completed: true };
  },
});
/** @typedef {Extract<import('@mastra/core/llm').LanguageModel, { specificationVersion: 'v2' }>} FixtureModel */
/** @type {FixtureModel} */
const model = {
  specificationVersion: 'v2',
  provider: 'test',
  modelId: 'api-loss-test',
  supportedUrls: {},
  async doGenerate() {
    throw new Error('stream only');
  },
  async doStream({ prompt }) {
    const finished = prompt.some(message => message.role === 'tool');
    /** @type {Awaited<ReturnType<FixtureModel['doStream']>>['stream'] extends ReadableStream<infer Part> ? Part[] : never} */
    const chunks = finished
      ? [
          { type: 'text-start', id: 'answer' },
          { type: 'text-delta', id: 'answer', delta: 'All four operations completed.' },
          { type: 'text-end', id: 'answer' },
        ]
      : Array.from({ length: 4 }, (_, index) => ({
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: `operation-${index}`,
          toolName: 'slowTool',
          input: JSON.stringify({ index }),
          providerExecuted: false,
        }));
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.enqueue({
            type: 'finish',
            finishReason: finished ? 'stop' : 'tool-calls',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      }),
    };
  },
};
const agent = createEventedAgent({
  agent: new Agent({
    id: 'api-loss-agent',
    name: 'api-loss-agent',
    instructions: 'Perform all operations.',
    model,
    tools: { slowTool: tool },
    memory: process.env.TAKEOVER_THREAD ? new Memory({ storage, options: { generateTitle: false } }) : undefined,
  }),
});
const mastra = new Mastra({ storage, pubsub, agents: { [agent.id]: agent } });
process.once('SIGTERM', async () => {
  console.info('shutdown-started');
  await mastra.shutdown();
  console.info('shutdown-completed');
  process.exit(0);
});
if (role === 'worker' || role === 'local') await mastra.startWorkers();
console.info('api-loss-ready');
const thread = { resourceId: 'api-loss-resource', threadId: process.env.TAKEOVER_THREAD };
if (role === 'aborter') {
  await agent.abortRunStream(runId);
  await pubsub.flush();
  console.info('abort-requested');
} else if (role === 'followup') {
  if (!thread.threadId) throw new Error('TAKEOVER_THREAD is required for followup');
  const accepted = await agent.sendMessage('Continue after API loss.', { ...thread, threadId: thread.threadId })
    .accepted;
  console.info(`followup-accepted:${accepted.action}:${'runId' in accepted ? accepted.runId : ''}`);
  if (accepted.action === 'wake') console.info(`followup-completed:${await accepted.output.text}`);
} else if (role !== 'worker') {
  const { output } = await agent.stream('Perform four operations.', {
    runId,
    ...(thread.threadId ? { memory: { resource: thread.resourceId, thread: thread.threadId } } : {}),
  });
  console.info(`caller-completed:${await output.text}`);
}
setInterval(() => {}, 1000);
