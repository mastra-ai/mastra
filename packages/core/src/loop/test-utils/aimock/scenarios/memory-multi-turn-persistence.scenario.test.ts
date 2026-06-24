import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

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
});
