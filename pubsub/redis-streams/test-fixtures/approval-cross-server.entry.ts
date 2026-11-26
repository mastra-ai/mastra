import { appendFileSync } from 'node:fs';
import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { RedisStreamsPubSub } from '../src/index.ts';

// One app, two roles sharing storage and Redis: `owner` starts an evented run that parks on a tool approval and
// stays up; `approver` (no workers) approves it, so the resumed tool-call step runs on the owner's workers.
const role = process.env.ROLE;

const pay = createTool({
  id: 'pay',
  description: 'Pays',
  inputSchema: z.object({}),
  requireApproval: true,
  execute: async () => {
    appendFileSync(process.env.LEDGER!, `${role}\n`);
    return { paid: true };
  },
});

const stream = (chunks: unknown[]) =>
  new ReadableStream({
    start(controller) {
      for (const chunk of [{ type: 'stream-start', warnings: [] }, ...chunks]) controller.enqueue(chunk);
      controller.close();
    },
  });
const finish = (finishReason: string) => ({
  type: 'finish',
  finishReason,
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
});

// Calls `pay` once, then answers.
const model = {
  specificationVersion: 'v2',
  provider: 'test',
  modelId: 'approval-cross-server',
  supportedUrls: {},
  async doGenerate() {
    throw new Error('stream only');
  },
  async doStream({ prompt }: { prompt: Array<{ role: string }> }) {
    if (prompt.some(m => m.role === 'tool')) {
      return {
        stream: stream([
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: 'paid' },
          { type: 'text-end', id: 't' },
          finish('stop'),
        ]),
      };
    }
    return {
      stream: stream([{ type: 'tool-call', toolCallId: 'call-1', toolName: 'pay', input: '{}' }, finish('tool-calls')]),
    };
  },
};

const agent = createEventedAgent({
  agent: new Agent({ id: 'payer', name: 'payer', instructions: 'Pay.', model: model as any, tools: { pay } }),
});

const mastra = new Mastra({
  logger: false,
  agents: { payer: agent },
  storage: new LibSQLStore({ id: `approval-${role}`, url: process.env.STORAGE_URL! }),
  pubsub: new RedisStreamsPubSub({ url: process.env.REDIS_URL, keyPrefix: process.env.KEY_PREFIX }),
  workers: role === 'approver' ? false : undefined,
});
const memory = { thread: 'approval-thread', resource: 'approval-user' };

if (role === 'owner') {
  await mastra.startWorkers();
  const out = await agent.stream('pay', { memory });
  for await (const chunk of out.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      console.info(`parked:${JSON.stringify({ runId: out.runId, toolCallId: chunk.payload.toolCallId })}`);
      break;
    }
  }
  setInterval(() => {}, 1000);
} else {
  const { runId, toolCallId } = JSON.parse(process.env.PARKED!);
  const out = await agent.approveToolCall({ runId, toolCallId, memory });
  const chunks: string[] = [];
  const errors: string[] = [];
  for await (const chunk of out.fullStream) {
    if (!chunk.type.endsWith('-delta')) chunks.push(chunk.type);
    if (chunk.type === 'tool-error')
      errors.push(String((chunk.payload.error as Error)?.message ?? chunk.payload.error));
    // The model asking again means the approved tool never ran.
    if (chunk.type === 'tool-call-approval') break;
  }
  console.info(`resumed:${JSON.stringify({ chunks, errors })}`);
  process.exit(0);
}
