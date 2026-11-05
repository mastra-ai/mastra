// @ts-check
// API or worker process for evented-redis-loading.test.ts (COR-1502) and
// evented-step-end-fault.test.ts (#29504). Both talk to Redis (through the
// test's LOADING proxy for COR-1502) and to Postgres directly.
import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { ConsoleLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod';
import { RedisStreamsPubSub } from '../src/index.ts';

const role = process.env.LOADING_ROLE;
const runId = process.env.LOADING_RUN_ID;
const schema = process.env.LOADING_SCHEMA;
const threadId = process.env.LOADING_THREAD;
const toolMs = Number(process.env.LOADING_TOOL_MS);
if (!runId || !schema || !threadId || !Number.isFinite(toolMs)) throw new Error('missing LOADING_* env');

const storage = new PostgresStore({
  id: `loading-${role}`,
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  schemaName: schema,
});
const pubsub = new RedisStreamsPubSub({
  url: process.env.REDIS_URL,
  keyPrefix: process.env.LOADING_PREFIX,
  blockMs: 100,
  reclaimIntervalMs: 1000,
  logger: { warn: (...args) => console.error('[pubsub warn]', ...args) },
});
await storage.init();

// #29504: fail the first `workflow.step.end` publish for a finished tool call,
// either by throwing a non-LOADING transport error or by dying before it is sent.
const stepEndFault = process.env.LOADING_STEP_END_FAULT;
if (stepEndFault) {
  const publish = pubsub.publish.bind(pubsub);
  let faulted = false;
  pubsub.publish = async (topic, event) => {
    const prevResult = /** @type {any} */ (event.data)?.prevResult;
    if (
      !faulted &&
      event.type === 'workflow.step.end' &&
      prevResult?.status === 'success' &&
      prevResult.output?.toolCallId === 'operation-0'
    ) {
      faulted = true;
      console.info('step-end-fault');
      if (stepEndFault === 'exit') process.exit(1);
      throw new Error('read ECONNRESET');
    }
    return publish(topic, event);
  };
}

const tool = createTool({
  id: 'recordedTool',
  description: 'Perform one recorded operation.',
  inputSchema: z.object({ index: z.number().int().min(0).max(3) }),
  execute: async ({ index }, context) => {
    const callId = context.agent?.toolCallId;
    const { id } = await storage.db.one(
      `INSERT INTO "${schema}".tool_executions (run_id, tool_call_id) VALUES ($1, $2) RETURNING id`,
      [runId, callId],
    );
    console.info(`tool-entered:${callId}`);
    await new Promise(resolve => setTimeout(resolve, toolMs));
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
  modelId: 'loading-test',
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
          { type: 'text-delta', id: 'answer', delta: 'Both operations completed.' },
          { type: 'text-end', id: 'answer' },
        ]
      : Array.from({ length: 2 }, (_, index) => ({
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: `operation-${index}`,
          toolName: 'recordedTool',
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
    id: 'loading-agent',
    name: 'loading-agent',
    instructions: 'Perform all operations.',
    model,
    tools: { recordedTool: tool },
    memory: new Memory({ storage, options: { generateTitle: false } }),
  }),
});
const mastra = new Mastra({
  storage,
  pubsub,
  agents: { [agent.id]: agent },
  // Surface worker errors (e.g. 'error extending event lease') on stderr.
  logger: new ConsoleLogger({ name: `loading-${role}`, level: 'warn' }),
});

if (role === 'worker') await mastra.startWorkers();
console.info('loading-ready');
if (role === 'api') {
  const { output } = await agent.stream('Perform two operations.', {
    runId,
    memory: { resource: 'loading-resource', thread: threadId },
  });
  console.info(`caller-completed:${await output.text}`);
}
setInterval(() => {}, 1000);
