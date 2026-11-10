// COR-1519 disposable Studio fixture. Test-only: real Mastra dev server, real
// LibSQL storage and memory; only the model's HTTP endpoint is AIMock (the
// Playwright spec starts it on AIMOCK_PORT).
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod';

const AIMOCK_URL = `http://127.0.0.1:${process.env.AIMOCK_PORT ?? '4319'}/v1`;

type ToolState = { started: number; aborted: number; finished: number };
const tool: ToolState = { started: 0, aborted: 0, finished: 0 };
let release: () => void = () => {};
let gate = new Promise<void>(r => (release = r));
let generation = 0;

const wait = createTool({
  id: 'wait',
  description: 'Wait for the job',
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const mine = generation;
    tool.started++;
    const signal = context?.abortSignal;
    await Promise.race([
      gate,
      new Promise<void>(r => signal?.addEventListener('abort', () => r(), { once: true })),
      new Promise<void>(r => setTimeout(r, 60_000)),
    ]);
    if (mine !== generation) return { done: true };
    if (signal?.aborted) tool.aborted++;
    else tool.finished++;
    return { done: true };
  },
});

function makeAgent(id: string) {
  return new Agent({
    id,
    name: id,
    instructions: 'Use the wait tool, then answer.',
    model: { id: 'openai/gpt-4o-mini', url: AIMOCK_URL, apiKey: 'aimock-test-key' },
    memory: new Memory(),
    tools: { wait },
  });
}

const plainAgent = makeAgent('plain-agent');
const durableAgent = createDurableAgent({ agent: makeAgent('durable-agent') });

export const mastra = new Mastra({
  agents: { 'plain-agent': plainAgent, 'durable-agent': durableAgent as unknown as Agent },
  storage: new LibSQLStore({ id: 'cor-1519-storage', url: 'file:cor-1519.db' }),
  logger: false,
  server: {
    apiRoutes: [
      registerApiRoute('/cor1519/state', { method: 'GET', handler: async c => c.json(tool) }),
      registerApiRoute('/cor1519/release', {
        method: 'POST',
        handler: async c => {
          release();
          return c.json({ ok: true });
        },
      }),
      registerApiRoute('/cor1519/reset', {
        method: 'POST',
        handler: async c => {
          release();
          generation++;
          Object.assign(tool, { started: 0, aborted: 0, finished: 0 });
          gate = new Promise<void>(r => (release = r));
          return c.json({ ok: true });
        },
      }),
    ],
  },
});
