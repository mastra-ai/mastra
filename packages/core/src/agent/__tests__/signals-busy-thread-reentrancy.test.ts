import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const memory = { resource: 'reentrant-user', thread: 'reentrant-thread' };
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function streamOf(parts: any[]) {
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
  };
}

/** A model that answers `reply`, optionally taking `delayMs`, and calls tool `toolName` on its first call. */
function createModel(opts: { delayMs?: number; toolName?: string; onCall?: (signal?: AbortSignal) => void } = {}) {
  let calls = 0;
  const model = new MockLanguageModelV2({
    doGenerate: async ({ abortSignal }) => {
      const call = ++calls;
      opts.onCall?.(abortSignal);
      if (opts.delayMs) await sleep(opts.delayMs);
      const tool = opts.toolName && call === 1;
      return {
        content: tool
          ? [{ type: 'tool-call' as const, toolCallId: 'c1', toolName: opts.toolName!, input: '{}' }]
          : [{ type: 'text' as const, text: 'done' }],
        finishReason: tool ? ('tool-calls' as const) : ('stop' as const),
        usage,
        warnings: [],
      };
    },
    doStream: async () => {
      const call = ++calls;
      opts.onCall?.();
      if (opts.delayMs) await sleep(opts.delayMs);
      if (opts.toolName && call === 1) {
        return streamOf([
          { type: 'tool-call', toolCallId: 'c1', toolName: opts.toolName, input: '{}' },
          { type: 'finish', finishReason: 'tool-calls', usage },
        ]);
      }
      return streamOf([
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'done' },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: 'stop', usage },
      ]);
    },
  });
  return { model, calls: () => calls };
}

function createAgent(id: string, model: MockLanguageModelV2, tools: Record<string, any> = {}) {
  return new Agent({ id, name: id, instructions: 'Test', model, memory: new MockMemory(), tools });
}

/** Agents must share one Mastra, as they do in an app, so they share the thread runtime state. */
function build(id: string, model: MockLanguageModelV2) {
  const agent = createAgent(id, model);
  new Mastra({ agents: { [id]: agent }, logger: false });
  return agent;
}

async function run(agent: Agent<any, any, any, any>, method: 'generate' | 'stream', options: any = {}) {
  if (method === 'generate') return agent.generate('hi', options);
  const output = await agent.stream('hi', options);
  await output.consumeStream();
  return output;
}

describe('thread-bound generate()/stream() on a thread that already has a running turn', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  for (const method of ['generate', 'stream'] as const) {
    it(`serializes concurrent ${method}() calls on one thread, as stream() always has`, async () => {
      let active = 0;
      let maxActive = 0;
      const { model } = createModel({ delayMs: 100, onCall: () => void (maxActive = Math.max(maxActive, ++active)) });
      const agent = build(`concurrent-${method}`, model);
      const finishes: Promise<unknown>[] = [run(agent, method, { memory }), run(agent, method, { memory })];
      // Count a call as finished once the model's delay has passed.
      const tick = setInterval(() => (active = 0), 50);
      await Promise.all(finishes);
      clearInterval(tick);
      expect(model.doGenerateCalls.length + model.doStreamCalls.length).toBe(2);
      expect(maxActive).toBe(1);
    });

    it(`releases the thread after a ${method}() that throws`, async () => {
      const bad = createModel({
        onCall: () => {
          throw new Error('model exploded');
        },
      });
      const agent = build(`throws-${method}`, bad.model);
      await run(agent, method, { memory }).catch(() => {});
      expect(agentThreadStreamRuntime.getThreadState({ resourceId: memory.resource, threadId: memory.thread })).toBe(
        'idle',
      );

      const ok = createModel();
      const next = build(`after-throw-${method}`, ok.model);
      const outcome = await Promise.race([
        run(next, method, { memory }).then(() => 'finished'),
        sleep(3000).then(() => 'hung'),
      ]);
      expect(outcome).toBe('finished');
    });
  }

  it('releases the thread after an aborted generate()', async () => {
    const controller = new AbortController();
    const { model } = createModel({ delayMs: 500 });
    const agent = build('aborted-generate', model);
    const aborted = agent.generate('hi', { memory, abortSignal: controller.signal }).catch(() => 'aborted');
    await sleep(50);
    controller.abort();
    await aborted;

    const next = build('after-abort', createModel().model);
    const outcome = await Promise.race([
      run(next, 'generate', { memory }).then(() => 'finished'),
      sleep(3000).then(() => 'hung'),
    ]);
    expect(outcome).toBe('finished');
  });
});
