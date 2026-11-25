import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable';
import { Mastra } from '../mastra';
import { MockStore } from '../storage';
import { createTool } from '../tools';

// With `workers: false` the background-task manager runs in producer mode: it
// can't run a task bound to the run's in-process executor, and no other process
// can either. Instead of leaving a task nobody claims, a durable agent runs the
// tool inline and a regular agent gets the dispatch error as the tool result.
// (#31089)

const streamOf = (chunks: unknown[]) =>
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

function setup(kind: 'durable' | 'regular') {
  let toolRuns = 0;
  const brew = createTool({
    id: 'brew',
    description: 'Brews something',
    inputSchema: z.object({}),
    background: { enabled: true },
    execute: async () => {
      toolRuns++;
      return { brewed: true };
    },
  });

  // Calls `brew` once, then echoes the tool message it got back.
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const toolMessage = prompt.find(message => message.role === 'tool');
      const chunks = toolMessage
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: JSON.stringify(toolMessage.content) },
            { type: 'text-end', id: 't' },
            finish('stop'),
          ]
        : [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'brew', input: '{}' }, finish('tool-calls')];
      return { stream: streamOf(chunks) } as Awaited<ReturnType<MockLanguageModelV2['doStream']>>;
    },
  });

  const agent = new Agent({
    id: 'brewer',
    name: 'brewer',
    instructions: 'Brew.',
    model,
    tools: { brew },
    backgroundTasks: { tools: { brew: true } },
  });
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    agents: { brewer: kind === 'durable' ? createDurableAgent({ agent }) : agent },
    backgroundTasks: { enabled: true },
    workers: false,
  });
  return { mastra, toolRuns: () => toolRuns };
}

async function run(mastra: Mastra) {
  const out = await mastra.getAgentById('brewer').stream('brew');
  const chunkTypes: string[] = [];
  let text = '';
  for await (const chunk of out.fullStream) {
    chunkTypes.push(chunk.type);
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  const { tasks } = await mastra.backgroundTaskManager!.listTasks({});
  return { chunkTypes, text, tasks };
}

describe('background tool in an agent run on a process without background-task workers', () => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.stopWorkers();
    mastra = undefined;
  });

  it('runs the tool inline for a durable agent', async () => {
    const setupResult = setup('durable');
    mastra = setupResult.mastra;

    const { chunkTypes, text, tasks } = await run(mastra);

    expect(chunkTypes).not.toContain('background-task-started');
    expect(chunkTypes).toContain('tool-result');
    expect(text).toContain('brewed');
    expect(setupResult.toolRuns()).toBe(1);
    expect(tasks).toEqual([]);
  });

  it('returns the dispatch error as the tool result for a regular agent', async () => {
    const setupResult = setup('regular');
    mastra = setupResult.mastra;

    const { chunkTypes, text, tasks } = await run(mastra);

    expect(chunkTypes).not.toContain('background-task-started');
    expect(chunkTypes).toContain('tool-error');
    expect(text).toContain("this process doesn't run background tasks");
    expect(setupResult.toolRuns()).toBe(0);
    expect(tasks).toEqual([]);
  });
});
