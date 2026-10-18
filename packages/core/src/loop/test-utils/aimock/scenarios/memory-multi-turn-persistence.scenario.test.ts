import { describe, it, expect, vi } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { StreamErrorRetryProcessor } from '../../../../processors';
import type { InputProcessor } from '../../../../processors';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { isDurableEngineVariant } from '../types';

// Same processor id as the shipped default, so it replaces it: the failure is terminal at once
// instead of waiting out the default 3s backoff.
const noStreamRetries = () => [new StreamErrorRetryProcessor({ maxRetries: 0 })];

/**
 * Regression class: multi-turn message persistence and recall.
 *
 * Extends memory-history.scenario.test.ts to cover:
 * - Multi-turn conversations with 3+ turns
 * - Resource isolation (different users' conversations stay separate)
 * - Message ordering across multiple saves
 * - Tool call results persisted and recalled correctly
 */
describeForAllEngines('AIMock loop scenario: multi-turn memory persistence', engine => {
  const getMock = useLoopScenarioAimock();

  it('persists and recalls 3+ turns with correct ordering', async () => {
    const memory = new MockMemory();
    const threadId = 'multi-turn-thread';
    const resourceId = 'multi-turn-resource';

    await memory.saveThread({
      thread: {
        id: threadId,
        title: 'Multi-turn Thread',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Turn 1
    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My name is Alice.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Hello Alice, nice to meet you.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 2
    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'I am 28 years old.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, you are 28.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 3 - verify all prior turns are recalled
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Tell me what you know about me.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'You are Alice and 28 years old.' });
      },
    });

    expect(requests).toHaveLength(1);
    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);

    // User messages should be present in the conversation history
    expect(serialized).toContain('My name is Alice');
    expect(serialized).toContain('I am 28 years old');
    expect(serialized).toContain('Tell me what you know about me');

    // Messages should be in correct order (earlier turns before later turns)
    const alicePos = serialized.indexOf('My name is Alice');
    const agePos = serialized.indexOf('I am 28 years old');
    const questionPos = serialized.indexOf('Tell me what you know');
    expect(alicePos).toBeLessThan(agePos);
    expect(agePos).toBeLessThan(questionPos);

    // Should have system message + 3 user messages + 2 assistant messages (even if empty)
    const messages = requests[0]?.body?.messages ?? [];
    expect(messages.length).toBeGreaterThanOrEqual(5);
  });

  it('isolates conversations by resourceId', async () => {
    const memory = new MockMemory();

    // User 1's conversation
    const thread1 = 'user1-thread';
    const resource1 = 'user-1';

    await memory.saveThread({
      thread: {
        id: thread1,
        title: 'User 1 Thread',
        resourceId: resource1,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My favorite food is PIZZA_USER1.',
      memory,
      threadId: thread1,
      resourceId: resource1,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, you like pizza.' });
      },
    });

    // User 2's conversation
    const thread2 = 'user2-thread';
    const resource2 = 'user-2';

    await memory.saveThread({
      thread: {
        id: thread2,
        title: 'User 2 Thread',
        resourceId: resource2,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My favorite food is SUSHI_USER2.',
      memory,
      threadId: thread2,
      resourceId: resource2,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, you like sushi.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // User 1 asks what we know - should NOT see User 2's data
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What do you know about my food preferences?',
      memory,
      threadId: thread1,
      resourceId: resource1,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'You like pizza.' });
      },
    });

    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);

    // User 1's data should be present
    expect(serialized).toContain('PIZZA_USER1');

    // User 2's data should NOT be present (resource isolation)
    expect(serialized).not.toContain('SUSHI_USER2');
  });

  it('recalls tool call results across turns', async () => {
    const memory = new MockMemory();
    const threadId = 'tool-results-thread';
    const resourceId = 'tool-results-resource';

    await memory.saveThread({
      thread: {
        id: threadId,
        title: 'Tool Results Thread',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Turn 1: agent calls a tool
    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is the weather in Tokyo?',
      memory,
      threadId,
      resourceId,
      tools: {
        get_weather: {
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' },
            },
            required: ['city'],
          },
          execute: async ({ city }: { city: string }) => {
            return { temperature: 22, condition: 'sunny', city };
          },
        },
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', userMessage: /What is the weather/ },
          {
            toolCalls: [
              {
                id: 'call_weather_1',
                name: 'get_weather',
                arguments: { city: 'Tokyo' },
              },
            ],
          },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          {
            content: 'The weather in Tokyo is sunny and 22 degrees.',
          },
        );
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 2: verify tool results are recalled
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What did you say about Tokyo weather?',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'I mentioned Tokyo is sunny and 22 degrees.' });
      },
    });

    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);

    // Tool result should be in history with full details
    expect(serialized).toContain('temperature');
    expect(serialized).toContain('22');
    expect(serialized).toContain('sunny');
    expect(serialized).toContain('Tokyo');

    // Tool call structure should be present (even if name/args are empty due to memory serialization)
    expect(serialized).toContain('tool_calls');
    expect(serialized).toContain('call_weather_1');
  });

  // A turn that fails must still leave a record in the thread: the user's message plus an
  // assistant message carrying the error, so a reload shows what went wrong and the next turn
  // doesn't see a dangling user message. A guardrail block is not a failure and saves no error.
  describe('failed turns', () => {
    const threadId = 'failed-turn-thread';
    const resourceId = 'failed-turn-resource';
    // The in-process loop (normal, fs) diverges from the durable engines on two failures below;
    // see the comments on those tests and #27427.
    const itFailsOnInProcessLoop = isDurableEngineVariant(engine) ? it : it.fails;

    async function savedTurn(memory: MockMemory, expectedRoles = ['user', 'assistant']) {
      await vi.waitFor(async () => {
        const { messages } = await memory.recall({ threadId, resourceId });
        expect(messages.map(m => m.role)).toEqual(expectedRoles);
      });
      const { messages } = await memory.recall({ threadId, resourceId });
      return messages;
    }

    it('saves the error as the assistant reply when the provider fails', async () => {
      const memory = new MockMemory();

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Summarize my account.',
        memory,
        threadId,
        resourceId,
        maxRetries: 0,
        errorProcessors: noStreamRetries(),
        fixtures: llm => {
          llm.onMessage(/.*/, {
            error: { message: 'PROVIDER_DOWN_27401', type: 'server_error', code: 'internal_error' },
            status: 500,
          });
        },
      });

      const messages = await savedTurn(memory);
      expect(messages[1]!.content.parts).toHaveLength(1);
      expect(messages[1]!.content.parts[0]).toMatchObject({ type: 'error' });
      expect(JSON.stringify(messages[1]!.content.parts[0])).toContain('PROVIDER_DOWN_27401');
    });

    // In-process loop: streamed text is only materialized on `text-end`, so a socket drop
    // mid-reply saves the error alone and loses the text the user already saw.
    itFailsOnInProcessLoop(
      'keeps the partial reply and appends the error when the stream drops mid-reply',
      async () => {
        const memory = new MockMemory();
        const partialReply = 'Your balance is forty-two dollars and the last payment was';

        await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'What is my balance?',
          memory,
          threadId,
          resourceId,
          maxRetries: 0,
          errorProcessors: noStreamRetries(),
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat' },
              { content: partialReply },
              { chunkSize: 5, latency: 20, disconnectAfterMs: 150 },
            );
          },
        });

        const messages = await savedTurn(memory);
        const parts = messages[1]!.content.parts;
        const text = parts
          .filter(p => p.type === 'text')
          .map(p => p.text)
          .join('');
        expect(text.length).toBeGreaterThan(0);
        expect(partialReply.startsWith(text)).toBe(true);
        expect(parts.at(-1)).toMatchObject({ type: 'error' });
      },
    );

    // In-process loop: a non-TripWire throw from processInputStep is rethrown before any terminal
    // error is recorded, so neither the user message nor the error is saved.
    itFailsOnInProcessLoop(
      'saves the error when an input processor throws, including after rotating the response id',
      async () => {
        for (const rotate of [false, true]) {
          const memory = new MockMemory();
          const errorMessage = `input processor failure (rotate=${rotate})`;
          const failingProcessor: InputProcessor = {
            id: 'failing-input-processor',
            processInputStep: async ({ rotateResponseMessageId }) => {
              if (rotate) rotateResponseMessageId?.();
              throw new Error(errorMessage);
            },
          };

          const { requests } = await runLoopScenario({
            engine,
            llm: getMock(),
            prompt: 'Hello there.',
            memory,
            threadId,
            resourceId,
            inputProcessors: [failingProcessor],
            fixtures: llm => {
              llm.on({ endpoint: 'chat' }, { content: 'unreachable' });
            },
          });

          expect(requests).toHaveLength(0);
          const messages = await savedTurn(memory);
          expect(messages[1]!.content.parts).toHaveLength(1);
          expect(messages[1]!.content.parts[0]).toMatchObject({ type: 'error' });
          expect(JSON.stringify(messages[1]!.content.parts[0])).toContain(errorMessage);
        }
      },
    );

    it('saves no error when an input guardrail blocks the turn', async () => {
      const memory = new MockMemory();
      const guardrail: InputProcessor = {
        id: 'blocking-guardrail',
        processInput: async ({ abort, messages }) => {
          abort('blocked by guardrail');
          return messages;
        },
      };

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Tell me something forbidden.',
        memory,
        threadId,
        resourceId,
        inputProcessors: [guardrail],
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'unreachable' });
        },
      });

      expect(requests).toHaveLength(0);
      const { messages } = await memory.recall({ threadId, resourceId });
      expect(messages.flatMap(m => m.content.parts).some(p => p.type === 'error')).toBe(false);
    });
  });
});
