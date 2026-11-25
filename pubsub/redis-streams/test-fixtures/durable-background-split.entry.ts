import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { RedisStreamsPubSub } from '../src/index.ts';

// One app, two roles: `api` (no workers) runs a durable agent, `worker` is a
// dedicated worker on the same storage and broker. The agent's only tool is
// background-eligible.
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

// Calls `brew` once, then answers with the tool message it got back.
const model = {
  specificationVersion: 'v2',
  provider: 'test',
  modelId: 'durable-background-split',
  supportedUrls: {},
  async doGenerate() {
    throw new Error('stream only');
  },
  async doStream({ prompt }: { prompt: Array<{ role: string; content: unknown }> }) {
    const toolMessage = prompt.find(m => m.role === 'tool');
    if (toolMessage) {
      const text = JSON.stringify(toolMessage.content);
      return {
        stream: stream([
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: text.includes('brewed') ? 'brewed' : 'not brewed' },
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

const agent = createDurableAgent({
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
  storage: new LibSQLStore({ id: `durable-split-${role}`, url: process.env.STORAGE_URL! }),
  pubsub: new RedisStreamsPubSub({ url: process.env.REDIS_URL, keyPrefix: process.env.KEY_PREFIX }),
  backgroundTasks: { enabled: true },
  workers: role === 'api' ? false : undefined,
});

if (role === 'worker') {
  await mastra.startWorkers();
  console.info('worker-ready');
  setInterval(() => {}, 1000);
} else {
  const out = await mastra.getAgentById('brewer').stream('brew');
  const chunkTypes: string[] = [];
  let text = '';
  for await (const chunk of out.fullStream) {
    chunkTypes.push(chunk.type);
    if (chunk.type === 'text-delta') text += (chunk.payload as { text: string }).text;
  }
  // Give a worker time to pick up any task the run dispatched.
  const tasks = await mastra.getStorage()!.getStore('backgroundTasks');
  for (let i = 0; i < 30; i++) {
    const rows = (await tasks!.listTasks({ agentId: 'brewer' })).tasks;
    if (rows.every(t => t.status !== 'pending' && t.status !== 'running')) break;
    await new Promise(r => setTimeout(r, 100));
  }
  const rows = (await tasks!.listTasks({ agentId: 'brewer' })).tasks;
  console.info(
    `result:${JSON.stringify({ chunkTypes, text, tasks: rows.map(t => ({ status: t.status, result: t.result })) })}`,
  );
  process.exit(0);
}
