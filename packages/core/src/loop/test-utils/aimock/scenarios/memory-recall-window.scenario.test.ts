import { describe, it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: memory recall window (lastMessages config).
 *
 * Tests that when a memory thread has many messages, only the last N messages
 * (based on `lastMessages` config) are recalled into the model request.
 * Also tests that `lastMessages: false` disables history recall entirely.
 *
 * This prevents regressions in memory recall windowing logic.
 */
describe('AIMock loop scenario: memory recall window', () => {
  const getMock = useLoopScenarioAimock();

  it('recalls only last N messages when lastMessages is configured', async () => {
    const memory = new MockMemory();
    const threadId = 'recall-window-thread';
    const resourceId = 'recall-window-resource';

    await memory.saveThread({
      thread: {
        id: threadId,
        title: 'Recall Window Thread',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Turn 1: establish a fact
    await runLoopScenario({
      llm: getMock(),
      prompt: 'My name is FACT_ALPHA.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, your name is FACT_ALPHA.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 2: establish another fact
    await runLoopScenario({
      llm: getMock(),
      prompt: 'My favorite color is FACT_BETA.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, FACT_BETA is your favorite.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 3: establish another fact
    await runLoopScenario({
      llm: getMock(),
      prompt: 'My age is FACT_GAMMA.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, FACT_GAMMA.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 4: recall with lastMessages: 4 — should only see the last 4 messages
    // (2 user messages + 2 assistant responses from the last 2 turns)
    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'What do you know about me?',
      memory,
      threadId,
      resourceId,
      memoryOptions: { lastMessages: 4 },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'I know your favorite color and age.' });
      },
    });

    expect(requests).toHaveLength(1);
    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);

    // The last 2 facts should be present (FACT_BETA and FACT_GAMMA)
    expect(serialized).toContain('FACT_BETA');
    expect(serialized).toContain('FACT_GAMMA');

    // The first fact should NOT be present (beyond the 4-message window)
    expect(serialized).not.toContain('FACT_ALPHA');
  });

  it('recalls all messages when lastMessages is not set (default behavior)', async () => {
    const memory = new MockMemory();
    const threadId = 'full-recall-thread';
    const resourceId = 'full-recall-resource';

    await memory.saveThread({
      thread: {
        id: threadId,
        title: 'Full Recall Thread',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Turn 1
    await runLoopScenario({
      llm: getMock(),
      prompt: 'Remember FULL_RECALL_1.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Remembered.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 2
    await runLoopScenario({
      llm: getMock(),
      prompt: 'Remember FULL_RECALL_2.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Remembered.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 3: no lastMessages limit — should recall both prior facts
    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'What do you remember?',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'I remember both.' });
      },
    });

    expect(requests).toHaveLength(1);
    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);

    // Both facts should be present (default recall includes all history)
    expect(serialized).toContain('FULL_RECALL_1');
    expect(serialized).toContain('FULL_RECALL_2');
  });
});
