import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { RedisStreamsPubSub } from '../src/index.ts';

// One app, two roles: `api` (no workers) starts an evented agent run, `worker`
// runs it. The agent's only tool is background-eligible.
const role = process.env.ROLE;

const brew = createTool({
  id: 'brew',
  description: 'Brews something',
  inputSchema: z.object({}),
  background: { enabled: true },
  execute: async (_input, ctx) => {
    console.info(`tool-ran:${JSON.stringify({ role, isBackgroundTask: ctx?.agent?.isBackgroundTask === true })}`);
    return { brewed: true };
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

// Calls `brew` once, then answers.
const model = {
  specificationVersion: 'v2',
  provider: 'test',
  modelId: 'background-tool-split',
  supportedUrls: {},
  async doGenerate() {
    throw new Error('stream only');
  },
  async doStream({ prompt }: { prompt: Array<{ role: string }> }) {
    if (prompt.some(m => m.role === 'tool')) {
      return {
        stream: stream([
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: 'done' },
          { type: 'text-end', id: 't' },
          finish('stop'),
        ]),
      };
    }
    return {
      stream: stream([
        { type: 'tool-call', toolCallId: 'call-1', toolName: 'brew', input: '{}' },
        finish('tool-calls'),
      ]),
    };
  },
};

const agent = createEventedAgent({
  agent: new Agent({
    id: 'brewer',
    name: 'brewer',
    instructions: 'Brew.',
    model: model as any,
    tools: { brew },
    backgroundTasks: { tools: { brew: true } },
  }),
});

const mastra = new Mastra({
  logger: false,
  agents: { brewer: agent },
  storage: new LibSQLStore({ id: `split-${role}`, url: process.env.STORAGE_URL! }),
  pubsub: new RedisStreamsPubSub({ url: process.env.REDIS_URL, keyPrefix: process.env.KEY_PREFIX }),
  backgroundTasks: { enabled: true },
  workers: role === 'api' ? false : undefined,
});

if (role === 'worker') {
  await mastra.startWorkers();
  console.info('worker-ready');
  setInterval(() => {}, 1000);
} else {
  if (role === 'single') await mastra.startWorkers();
  const out = await agent.stream('brew', { disableBackgroundTasks: process.env.DISABLE_BACKGROUND === '1' });
  const chunkTypes: string[] = [];
  for await (const chunk of out.fullStream) chunkTypes.push(chunk.type);
  console.info(`stream:${JSON.stringify(chunkTypes)}`);
  const tasks = await mastra.getStorage()!.getStore('backgroundTasks');
  for (let i = 0; i < 50; i++) {
    const rows = (await tasks!.listTasks({ runId: out.runId })).tasks;
    if (
      process.env.DISABLE_BACKGROUND === '1' ||
      (rows.length && rows.every(t => t.status !== 'pending' && t.status !== 'running'))
    )
      break;
    await new Promise(r => setTimeout(r, 100));
  }
  const rows = (await tasks!.listTasks({ runId: out.runId })).tasks;
  console.info(`tasks:${JSON.stringify(rows.map(t => ({ status: t.status, result: t.result })))}`);
  process.exit(0);
}
