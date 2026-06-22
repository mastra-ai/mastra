import { describe, it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: memory thread switching mid-conversation.
 *
 * An agent with memory may serve multiple threads interleaved. This scenario
 * proves that:
 * 1. Thread A's history stays in Thread A's requests — it never leaks into Thread B.
 * 2. Switching back to Thread A after a Thread B turn still recalls Thread A's full history.
 * 3. Thread IDs correctly partition memory state.
 */
describe('AIMock loop scenario: memory thread switching mid-conversation', () => {
  const getMock = useLoopScenarioAimock();

  it('switching threads keeps conversation histories isolated', async () => {
    const memory = new MockMemory();
    const threadA = 'thread-a';
    const threadB = 'thread-b';
    const resourceId = 'thread-switch-resource';

    // Pre-create both threads
    await memory.saveThread({
      thread: {
        id: threadA,
        title: 'Thread A',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await memory.saveThread({
      thread: {
        id: threadB,
        title: 'Thread B',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Turn 1: Thread A — establish a fact
    await runLoopScenario({
      llm: getMock(),
      prompt: 'My secret code is ALPHA_7749.',
      memory,
      threadId: threadA,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, your code is ALPHA_7749.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 2: Thread B — establish a different fact
    await runLoopScenario({
      llm: getMock(),
      prompt: 'My secret code is BRAVO_3312.',
      memory,
      threadId: threadB,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, your code is BRAVO_3312.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 3: Thread A — should recall Thread A's history but NOT Thread B's
    const { requests: requestsA } = await runLoopScenario({
      llm: getMock(),
      prompt: 'What is my secret code?',
      memory,
      threadId: threadA,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Your code is ALPHA_7749.' });
      },
    });

    expect(requestsA).toHaveLength(1);
    const serializedA = JSON.stringify(requestsA[0]?.body?.messages ?? []);
    expect(serializedA).toContain('ALPHA_7749');
    expect(serializedA).not.toContain('BRAVO_3312');

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 4: Thread B — should recall Thread B's history but NOT Thread A's
    const { requests: requestsB } = await runLoopScenario({
      llm: getMock(),
      prompt: 'What is my secret code?',
      memory,
      threadId: threadB,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Your code is BRAVO_3312.' });
      },
    });

    expect(requestsB).toHaveLength(1);
    const serializedB = JSON.stringify(requestsB[0]?.body?.messages ?? []);
    expect(serializedB).toContain('BRAVO_3312');
    expect(serializedB).not.toContain('ALPHA_7749');
  });

  it('switching to a brand new thread has no prior history', async () => {
    const memory = new MockMemory();
    const threadOld = 'thread-old';
    const threadNew = 'thread-new';
    const resourceId = 'thread-new-resource';

    await memory.saveThread({
      thread: {
        id: threadOld,
        title: 'Old Thread',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Establish history on old thread
    await runLoopScenario({
      llm: getMock(),
      prompt: 'Remember LEGACY_DATA_99.',
      memory,
      threadId: threadOld,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Remembering LEGACY_DATA_99.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Pre-create new thread
    await memory.saveThread({
      thread: {
        id: threadNew,
        title: 'New Thread',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Switch to brand new thread — should have no prior history
    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Hello, fresh start here.',
      memory,
      threadId: threadNew,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Welcome!' });
      },
    });

    expect(requests).toHaveLength(1);
    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);

    // Old thread's data should NOT leak
    expect(serialized).not.toContain('LEGACY_DATA_99');
    // Only the new user message should be present
    expect(serialized).toContain('Hello, fresh start here.');
  });
});
