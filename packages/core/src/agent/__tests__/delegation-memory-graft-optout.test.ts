import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';

/**
 * Coverage for `DelegationConfig.inheritMemory`.
 *
 * When a supervisor delegates to a sub-agent with no memory of its own, the
 * parent grafts its own `Memory` instance onto the (possibly shared/singleton)
 * sub-agent instance via an internal setter. `inheritMemory: false` opts out
 * of that graft, and a one-time `logger.warn` names both agents the first
 * time a graft actually mutates a sub-agent instance.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/21625
 */

/** Sub-agent with no memory of its own, answering directly with fixed text. */
function buildMemorylessSubAgent(id = 'sub-agent', name = 'Sub Agent') {
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sub-1', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'sub-t' },
        { type: 'text-delta', id: 'sub-t', delta: 'Sub-agent result.' },
        { type: 'text-end', id: 'sub-t' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ] as any),
    }),
  });

  return new Agent({
    id,
    name,
    description: 'Answers directly, no own memory.',
    instructions: 'Answer directly.',
    model,
  });
}

/**
 * Supervisor whose first turn delegates once to the sub-agent, then reports
 * completion on the following turn once the delegation's tool result is seen.
 */
function buildSupervisor(subAgent: Agent, memory: MockMemory) {
  let step = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      step += 1;
      const chunks =
        step === 1
          ? [
              {
                type: 'tool-call',
                toolCallId: 'sup-tc-1',
                toolName: 'agent-subAgent',
                input: JSON.stringify({ prompt: 'Delegate this.' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 'sup-final-t' },
              { type: 'text-delta', id: 'sup-final-t', delta: 'Sub-agent result acknowledged.' },
              { type: 'text-end', id: 'sup-final-t' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `sup-${step}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'Delegate to the sub agent.',
    model,
    memory,
    agents: { subAgent },
  });
}

function buildSupervisorAgent(subAgent: Agent, memory: MockMemory, storage: InMemoryStore = new InMemoryStore()) {
  const sup = buildSupervisor(subAgent, memory);
  const mastra = new Mastra({ agents: { supervisor: sup }, logger: false, storage });
  return mastra.getAgent('supervisor');
}

async function drain(stream: AsyncIterable<unknown>) {
  for await (const _chunk of stream) {
    // Drain the stream so the delegation runs to completion.
  }
}

describe('DelegationConfig.inheritMemory', () => {
  it('by default, the parent grafts its memory onto a memory-less sub-agent (existing behavior)', async () => {
    const subAgent = buildMemorylessSubAgent();
    expect(subAgent.hasOwnMemory()).toBe(false);

    const memory = new MockMemory();
    const supervisor = buildSupervisorAgent(subAgent, memory);

    const stream = await supervisor.stream('Delegate this.', { maxSteps: 4 });
    await drain(stream.fullStream);

    expect(subAgent.hasOwnMemory()).toBe(true);
  });

  it('inheritMemory: false prevents the graft — the sub-agent stays memory-less', async () => {
    const subAgent = buildMemorylessSubAgent();
    expect(subAgent.hasOwnMemory()).toBe(false);

    const memory = new MockMemory();
    const supervisor = buildSupervisorAgent(subAgent, memory);

    const stream = await supervisor.stream('Delegate this.', {
      maxSteps: 4,
      delegation: { inheritMemory: false },
    });
    await drain(stream.fullStream);

    expect(subAgent.hasOwnMemory()).toBe(false);
  });

  it('emits a one-time warning naming both agents when a graft mutates the sub-agent', async () => {
    const subAgent = buildMemorylessSubAgent('sub-agent', 'Sub Agent');
    const memory = new MockMemory();
    const supervisor = buildSupervisorAgent(subAgent, memory);
    const warnSpy = vi.fn();
    // @ts-expect-error - internal test hook into the Mastra logger for assertions
    supervisor.logger.warn = warnSpy;

    const stream = await supervisor.stream('Delegate this.', { maxSteps: 4 });
    await drain(stream.fullStream);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message, meta] = warnSpy.mock.calls[0]!;
    expect(message).toMatch(/grafted parent memory/i);
    expect(meta).toMatchObject({ parentAgent: 'Supervisor', subAgent: 'Sub Agent' });
  });

  it('does not warn again on a second delegation to the same already-grafted sub-agent', async () => {
    const subAgent = buildMemorylessSubAgent('sub-agent-repeat', 'Sub Agent Repeat');
    const memory = new MockMemory();

    // First supervisor delegates once and grafts memory onto the shared sub-agent instance.
    const firstSupervisor = buildSupervisorAgent(subAgent, memory);
    const warnSpy1 = vi.fn();
    // @ts-expect-error - internal test hook into the Mastra logger for assertions
    firstSupervisor.logger.warn = warnSpy1;
    await drain((await firstSupervisor.stream('Delegate this.', { maxSteps: 4 })).fullStream);
    expect(warnSpy1).toHaveBeenCalledTimes(1);

    // Sub-agent already has memory now, so a second, independent supervisor
    // delegating to the SAME sub-agent instance must not warn again — both
    // because hasOwnMemory() is now true (no further graft happens) and
    // because the one-time-per-instance guard would suppress it regardless.
    const secondMemory = new MockMemory();
    const secondSupervisor = buildSupervisorAgent(subAgent, secondMemory);
    const warnSpy2 = vi.fn();
    // @ts-expect-error - internal test hook into the Mastra logger for assertions
    secondSupervisor.logger.warn = warnSpy2;
    await drain((await secondSupervisor.stream('Delegate this.', { maxSteps: 4 })).fullStream);

    expect(warnSpy2).not.toHaveBeenCalled();
  });
});
