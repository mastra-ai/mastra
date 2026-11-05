// @ts-check
import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { ConsoleLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod';
import { Memory } from '../../../packages/memory/dist/index.js';
import { RedisStreamsPubSub } from '../src/index.ts';

// API (MASTRA_WORKERS=false) or dedicated worker of a split deploy with
// `recovery.durableAgents: 'auto'`. A booted API recovers in-flight runs the
// way the deployer's startup hook does.
const role = process.env.RESTART_ROLE;
const runId = process.env.RESTART_RUN_ID;
const schema = process.env.RESTART_SCHEMA;
const toolMs = Number(process.env.RESTART_TOOL_MS);
const toolCalls = Number(process.env.RESTART_TOOL_CALLS);
if (!runId || !schema || !(toolMs > 0) || !(toolCalls > 0)) throw new Error('Missing RESTART_* configuration');

const storage = new PostgresStore({
  id: `full-restart-${role}`,
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  schemaName: schema,
});
const pubsub = new RedisStreamsPubSub({
  url: process.env.REDIS_URL,
  keyPrefix: process.env.RESTART_PREFIX,
  blockMs: 100,
  reclaimIntervalMs: 1000,
});
await storage.init();

// Like the Doctor `sleep` tool, this ignores its abort signal (COR-1488), so a
// recovered run re-executes the interrupted call to completion.
const tool = createTool({
  id: 'sleepTool',
  description: 'Sleep once.',
  inputSchema: z.object({ index: z.number().int().min(0) }),
  execute: async ({ index }, context) => {
    const callId = context.agent?.toolCallId;
    const { id } = await storage.db.one(
      `INSERT INTO "${schema}".tool_executions (run_id, tool_call_id, role, pid) VALUES ($1, $2, $3, $4) RETURNING id`,
      [runId, callId, role, process.pid],
    );
    console.info(`tool-entered:${callId}`);
    await new Promise(resolve => setTimeout(resolve, toolMs));
    await storage.db.none(`UPDATE "${schema}".tool_executions SET completed = true WHERE id = $1`, [id]);
    console.info(`tool-completed:${callId}`);
    return { index, slept: toolMs };
  },
});

/** @typedef {Extract<import('@mastra/core/llm').LanguageModel, { specificationVersion: 'v2' }>} FixtureModel */
/** @type {FixtureModel} */
const model = {
  specificationVersion: 'v2',
  provider: 'test',
  modelId: 'full-restart-test',
  supportedUrls: {},
  async doGenerate() {
    throw new Error('stream only');
  },
  async doStream({ prompt }) {
    // One tool call per step, sequentially, like `sleep N xK`. Count only this
    // turn's results: memory history can carry an earlier run's tool messages.
    const lastUser = prompt.findLastIndex(message => message.role === 'user');
    const done = prompt.slice(lastUser + 1).filter(message => message.role === 'tool').length;
    const finished = done >= toolCalls;
    /** @type {Awaited<ReturnType<FixtureModel['doStream']>>['stream'] extends ReadableStream<infer Part> ? Part[] : never} */
    const chunks = finished
      ? [
          { type: 'text-start', id: 'answer' },
          { type: 'text-delta', id: 'answer', delta: 'All sleeps completed.' },
          { type: 'text-end', id: 'answer' },
        ]
      : [
          {
            type: 'tool-call',
            toolCallId: `sleep-${done}`,
            toolName: 'sleepTool',
            input: JSON.stringify({ index: done }),
            providerExecuted: false,
          },
        ];
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
    id: 'full-restart-agent',
    name: 'full-restart-agent',
    instructions: 'Sleep as asked.',
    model,
    tools: { sleepTool: tool },
    memory: new Memory({ storage, options: { generateTitle: false } }),
  }),
});
const mastra = new Mastra({
  storage,
  pubsub,
  agents: { [agent.id]: agent },
  recovery: { durableAgents: 'auto' },
  ...(process.env.RESTART_LOG_LEVEL
    ? { logger: new ConsoleLogger({ name: role, level: /** @type {any} */ (process.env.RESTART_LOG_LEVEL) }) }
    : {}),
});
process.once('SIGTERM', async () => {
  console.info('shutdown-started');
  await mastra.shutdown();
  console.info('shutdown-completed');
  process.exit(0);
});
if (role === 'worker') await mastra.startWorkers();
console.info('full-restart-ready');
const memory = { resource: 'full-restart-resource', thread: process.env.RESTART_THREAD ?? runId };
if (role === 'api') {
  if (process.env.RESTART_BOOT === 'recover') {
    // Mirrors the deployer's startup hook for `recovery.durableAgents: 'auto'`.
    void mastra.restartAllActiveWorkflowRuns().catch(error => console.error('restart-workflows-failed', error));
    const result = await mastra.recoverAllDurableAgents();
    console.info(`recovery-result:${JSON.stringify(result)}`);
  } else {
    const { output } = await agent.stream('Sleep repeatedly.', { runId, memory });
    console.info(`caller-completed:${await output.text}`);
  }
} else if (role === 'followup') {
  // A second run on the same thread, like Doctor re-diagnosing a stuck deploy.
  try {
    const { output } = await agent.stream('Diagnose again.', { runId: process.env.RESTART_FOLLOWUP_RUN_ID, memory });
    console.info(`followup-completed:${await output.text}`);
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}:${error.message}` : String(error);
    console.info(`followup-rejected:${reason}`);
  }
}
setInterval(() => {}, 1000);
