import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { setThreadOMMetadata } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import { ObservationalMemory } from '../observational-memory';

type PromptMessage = { role: string; content: unknown };

const threadId = 'thread-state-signals';
const resourceId = 'resource-state-signals';
const observations =
  '- 🔴 User prefers concise answers' +
  ObservationalMemory.createMessageBoundary(new Date('2026-11-16T09:05:00Z')) +
  '- 🟡 Assistant found the build cache was stale';

function createCapturingModel(prompts: PromptMessage[][]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt as PromptMessage[]);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'r1', modelId: 'mock', timestamp: new Date() },
          { type: 'text-start' as const, id: 't1' },
          { type: 'text-delta' as const, id: 't1', delta: 'ok' },
          { type: 'text-end' as const, id: 't1' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 1, totalTokens: 11 },
          },
        ]),
      };
    },
  });
}

async function setup({ stateSignals }: { stateSignals?: boolean }) {
  const prompts: PromptMessage[][] = [];
  const storage = new InMemoryStore();
  const memory = new Memory({
    storage,
    options: {
      observationalMemory: {
        enabled: true,
        // Keep every run below the thresholds so it only reads the seeded log and hints.
        observation: { model: createCapturingModel([]) as any, messageTokens: 100_000, bufferTokens: false },
        reflection: { model: createCapturingModel([]) as any, observationTokens: 100_000 },
        ...(stateSignals === undefined ? {} : { stateSignals }),
      },
    },
  });
  await memory.createThread({ threadId, resourceId });

  const engine = (await memory.omEngine)!;
  const record = await engine.getOrCreateRecord(threadId, resourceId);
  const store = (await memory.storage.getStore('memory'))!;
  await store.updateActiveObservations({
    id: record.id,
    observations,
    tokenCount: 20,
    lastObservedAt: new Date('2026-11-16T09:10:00.000Z'),
  });

  async function setHints(hints: { currentTask: string; suggestedResponse: string }) {
    const thread = (await memory.getThreadById({ threadId }))!;
    await store.saveThread({ thread: { ...thread, metadata: setThreadOMMetadata(thread.metadata ?? {}, hints) } });
  }
  await setHints({ currentTask: 'Ship the report', suggestedResponse: 'Ask about the deadline' });

  const agent = new Agent({
    id: 'state-agent',
    name: 'state-agent',
    instructions: 'Static instructions',
    model: createCapturingModel(prompts) as any,
    memory,
  });

  async function run(text = 'hello', { readOnly = false }: { readOnly?: boolean } = {}) {
    const stream = await agent.stream(text, {
      memory: { thread: threadId, resource: resourceId, ...(readOnly ? { options: { readOnly: true } } : {}) },
    });
    await stream.consumeStream();
    return prompts.at(-1)!;
  }

  return { run, setHints, memory };
}

function text(message: PromptMessage) {
  if (typeof message.content === 'string') return message.content;
  return (message.content as Array<{ type: string; text?: string }>)
    .map(part => (part.type === 'text' ? part.text : JSON.stringify(part)))
    .join('\n');
}

const system = (prompt: PromptMessage[]) => prompt.filter(m => m.role === 'system').map(text);
const conversation = (prompt: PromptMessage[]) => prompt.filter(m => m.role !== 'system').map(text);

describe('observationalMemory.stateSignals', () => {
  it('keeps the extracted sections in the system prompt by default', async () => {
    const { run } = await setup({});
    const prompt = await run();

    expect(system(prompt).join('\n')).toContain('<current-task>\nShip the report\n</current-task>');
    expect(system(prompt).join('\n')).toContain('<suggested-response>\nAsk about the deadline\n</suggested-response>');
    expect(conversation(prompt).join('\n')).not.toContain('Ship the report');
  });

  it('moves the extracted sections into a state signal and out of the system prompt', async () => {
    const { run } = await setup({ stateSignals: true });
    const prompt = await run();

    const systemPrompt = system(prompt).join('\n');
    expect(systemPrompt).toContain('stale');
    expect(systemPrompt).not.toContain('Ship the report');
    expect(systemPrompt).not.toContain('Ask about the deadline');

    const signal = conversation(prompt).find(m => m.includes('Ship the report'));
    expect(signal).toMatch(/^<observational-memory>/);
    expect(signal).toContain('<current-task>\nShip the report\n</current-task>');
    expect(signal).toContain('<suggested-response>\nAsk about the deadline\n</suggested-response>');
  });

  it('leaves the system prompt unchanged when only the extracted values change', async () => {
    const { run, setHints } = await setup({ stateSignals: true });
    const before = system(await run('first'));

    await setHints({ currentTask: 'Fix the flaky test', suggestedResponse: 'Ask which test' });
    const prompt = await run('second');

    expect(system(prompt)).toEqual(before);
    expect(conversation(prompt).join('\n')).toContain('Fix the flaky test');
  });

  it('keeps the extracted sections out of the system prompt on read-only calls', async () => {
    const { run } = await setup({ stateSignals: true });
    const prompt = await run('hello', { readOnly: true });

    expect(system(prompt).join('\n')).toContain('stale');
    expect(system(prompt).join('\n')).not.toContain('Ship the report');
  });

  it('still returns the sections from Memory.getContext()', async () => {
    const { memory } = await setup({ stateSignals: true });
    const context = await memory.getContext({ threadId, resourceId });

    expect(JSON.stringify(context)).toContain('Ship the report');
  });
});
