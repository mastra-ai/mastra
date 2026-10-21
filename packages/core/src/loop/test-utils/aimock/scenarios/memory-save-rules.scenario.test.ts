import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import type { InputProcessor } from '../../../../processors';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: what a run writes to the memory thread.
 *
 * - readOnly memory recalls history but must not save the new turn.
 * - An input processor that throws must leave the user message plus an
 *   assistant message carrying the error, so the thread shows why it failed.
 * - A TripWire is a deliberate stop, not a failure: no error parts are saved.
 */
describeForAllEngines('AIMock loop scenario: memory save rules', engine => {
  const getMock = useLoopScenarioAimock();

  async function newThread(memory: MockMemory, threadId: string, resourceId: string) {
    await memory.createThread({ threadId, resourceId });
  }

  it('does not save the turn when memory is readOnly', async () => {
    const memory = new MockMemory();
    const threadId = 'readonly-thread';
    const resourceId = 'readonly-resource';
    await newThread(memory, threadId, resourceId);

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'READONLY_PROMPT',
      memory,
      threadId,
      resourceId,
      memoryOptions: { readOnly: true },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'READONLY_REPLY' });
      },
    });

    expect(await output.text).toBe('READONLY_REPLY');
    const { messages } = await memory.recall({ threadId, resourceId });
    expect(messages).toEqual([]);
  });

  it('saves the user message and the error when an input processor throws', async () => {
    for (const rotate of [false, true]) {
      const memory = new MockMemory();
      const threadId = `processor-error-thread-${rotate}`;
      const resourceId = 'processor-error-resource';
      await newThread(memory, threadId, resourceId);
      const failing: InputProcessor = {
        id: 'failing-processor',
        processInputStep: async ({ rotateResponseMessageId }) => {
          if (rotate) rotateResponseMessageId?.();
          throw new Error('PROCESSOR_FAILURE');
        },
      };

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'PROCESSOR_PROMPT',
        memory,
        threadId,
        resourceId,
        inputProcessors: [failing],
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'unreachable' });
        },
      });

      expect(requests).toHaveLength(0);
      await expect
        .poll(async () => (await memory.recall({ threadId, resourceId })).messages.map(m => m.role))
        .toEqual(['user', 'assistant']);
      const { messages } = await memory.recall({ threadId, resourceId });
      expect(JSON.stringify(messages[0]?.content)).toContain('PROCESSOR_PROMPT');
      const parts = messages[1]?.content.parts ?? [];
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({ type: 'error' });
      expect(JSON.stringify(parts[0])).toContain('PROCESSOR_FAILURE');
    }
  });

  it('does not save error parts when an input processor trips a TripWire', async () => {
    const memory = new MockMemory();
    const threadId = 'tripwire-thread';
    const resourceId = 'tripwire-resource';
    await newThread(memory, threadId, resourceId);
    const tripwire: InputProcessor = {
      id: 'tripwire-processor',
      processInput: async ({ abort, messages }) => {
        abort('blocked');
        return messages;
      },
    };

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'TRIPWIRE_PROMPT',
      memory,
      threadId,
      resourceId,
      inputProcessors: [tripwire],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'unreachable' });
      },
    });

    expect(requests).toHaveLength(0);
    const { messages } = await memory.recall({ threadId, resourceId });
    expect(messages.flatMap(m => m.content.parts ?? []).some(p => p.type === 'error')).toBe(false);
  });
});
