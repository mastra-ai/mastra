import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { TripWireOptions } from '../trip-wire';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const thread = 'tripwire-thread';
const resource = 'tripwire-resource';

/** Calls a tool on its first step, then answers with "blocked answer". */
function makeToolCallingModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      return {
        stream: convertArrayToReadableStream(
          calls === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 'text' },
                { type: 'text-delta', id: 'text', delta: 'blocked answer' },
                { type: 'text-end', id: 'text' },
                { type: 'finish', finishReason: 'stop', usage },
              ],
        ),
      };
    },
  });
}

const lookupTool = createTool({
  id: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({}),
  execute: async () => ({ found: true }),
});

function abortInputStepAt(step: number, options?: TripWireOptions): Processor {
  return {
    id: 'step-guard',
    processInputStep: async ({ stepNumber, abort }) => {
      if (stepNumber === step) abort('stopped', options);
      return {};
    },
  };
}

function abortInput(options?: TripWireOptions): Processor {
  return {
    id: 'input-guard',
    processInput: async ({ abort }) => abort('stopped', options),
  };
}

function abortOutputStream(options?: TripWireOptions): Processor {
  return {
    id: 'output-guard',
    processOutputStream: async ({ part, abort }) => {
      if (part.type === 'text-delta') abort('blocked', options);
      return part;
    },
  };
}

async function runAndRecall(processors: { input?: Processor[]; output?: Processor[] }) {
  const memory = new MockMemory();
  const agent = new Agent({
    id: 'tripwire-persist-agent',
    name: 'tripwire-persist-agent',
    instructions: 'test',
    model: makeToolCallingModel(),
    tools: { lookup: lookupTool },
    inputProcessors: processors.input,
    outputProcessors: processors.output,
    memory,
  });

  const output = await agent.stream('hi', { memory: { thread, resource } });
  await output.consumeStream();
  expect(output.tripwire).toBeDefined();

  const { messages } = await memory.recall({ threadId: thread, resourceId: resource });
  return messages;
}

/** Content parts only; `step-start` boundary markers carry no content. */
function summarize(messages: Awaited<ReturnType<typeof runAndRecall>>) {
  return messages.flatMap(m =>
    (m.content.parts ?? [])
      .filter(p => p.type !== 'step-start')
      .map(p => {
        if (p.type === 'text') return `${m.role}:text:${p.text}`;
        if (p.type === 'tool-invocation') return `${m.role}:tool:${p.toolInvocation.state}`;
        return `${m.role}:${p.type}`;
      }),
  );
}

describe('tripwire persist option', () => {
  it('saves nothing from the turn by default', async () => {
    expect(await runAndRecall({ input: [abortInputStepAt(1)] })).toEqual([]);
  });

  it('saves the user message and finished steps when processInputStep aborts with persist', async () => {
    const saved = summarize(await runAndRecall({ input: [abortInputStepAt(1, { persist: true })] }));
    expect(saved).toEqual(['user:text:hi', 'assistant:tool:result']);
  });

  it('saves the user message when processInputStep aborts with persist on the first step', async () => {
    const saved = summarize(await runAndRecall({ input: [abortInputStepAt(0, { persist: true })] }));
    expect(saved).toEqual(['user:text:hi']);
  });

  it('saves the user message when processInput aborts with persist', async () => {
    const saved = summarize(await runAndRecall({ input: [abortInput({ persist: true })] }));
    expect(saved).toEqual(['user:text:hi']);
  });

  it('saves nothing when processInput aborts without persist', async () => {
    expect(await runAndRecall({ input: [abortInput()] })).toEqual([]);
  });

  it('ignores persist for output-side aborts so blocked content is never saved', async () => {
    const saved = summarize(await runAndRecall({ output: [abortOutputStream({ persist: true })] }));
    expect(saved.some(entry => entry.includes('blocked answer'))).toBe(false);
  });
});
