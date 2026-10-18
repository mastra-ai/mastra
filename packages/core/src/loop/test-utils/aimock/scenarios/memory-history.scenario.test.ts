import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: conversation-history recall across turns.
 *
 * The loop is run twice against the same memory thread. Turn 1 establishes a
 * fact in the conversation; turn 2 is a fresh `agent.stream` on the same thread.
 * The loop must recall the prior user + assistant messages from memory and
 * include them in the turn-2 model request. A memory-wiring regression (history
 * not loaded, wrong thread, dropped messages) is caught by asserting the prior
 * turn's content appears in the second request.
 */
describeForAllEngines('AIMock loop scenario: memory conversation history', engine => {
  const getMock = useLoopScenarioAimock();

  it('recalls prior thread messages into the next request', async () => {
    const memory = new MockMemory();
    const threadId = 'memory-history-thread';
    const resourceId = 'memory-history-resource';

    await memory.saveThread({
      thread: {
        id: threadId,
        title: 'History Thread',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Turn 1: user shares a fact, model acknowledges. This conversation is
    // persisted to the memory thread.
    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My favorite color is MEMORY_TEAL.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, I will remember that.' });
      },
    });

    // Clear the request journal so the assertion only sees the second turn.
    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 2: a new run on the SAME thread. The loop should recall turn 1.
    const { requests, output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is my favorite color?',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Your favorite color is MEMORY_TEAL.' });
      },
    });

    expect(requests).toHaveLength(1);

    // The recalled history (turn-1 user message + assistant reply) must be in
    // the turn-2 request, ahead of the new user question.
    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);
    expect(serialized).toContain('MEMORY_TEAL');
    expect(serialized).toContain('What is my favorite color?');

    const text = await output.text;
    expect(text).toContain('MEMORY_TEAL');
  });

  // A readOnly turn still sees the thread's history but must not add to it, so a reload shows
  // only the turns that were saved.
  it('recalls history on a readOnly turn without saving that turn', async () => {
    const memory = new MockMemory();
    const threadId = 'memory-readonly-thread';
    const resourceId = 'memory-readonly-resource';

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My favorite color is MEMORY_TEAL.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Got it, I will remember that.' });
      },
    });

    const { messages: savedBefore } = await memory.recall({ threadId, resourceId });
    expect(savedBefore.map(m => m.role)).toEqual(['user', 'assistant']);

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    const readOnlyOptions = { readOnly: true, lastMessages: 10 };
    const { requests, output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is my favorite color? READONLY_QUESTION',
      memory,
      threadId,
      resourceId,
      memoryOptions: readOnlyOptions,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Your favorite color is MEMORY_TEAL. READONLY_ANSWER' });
      },
    });

    expect(await output.text).toContain('READONLY_ANSWER');
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0]?.body?.messages ?? [])).toContain('MEMORY_TEAL');

    // Give any (wrong) background save a chance to land before checking nothing was written.
    await new Promise(resolve => setTimeout(resolve, 100));
    const { messages: savedAfter } = await memory.recall({ threadId, resourceId });
    expect(savedAfter.map(m => m.id)).toEqual(savedBefore.map(m => m.id));
    const serializedAfter = JSON.stringify(savedAfter);
    expect(serializedAfter).not.toContain('READONLY_QUESTION');
    expect(serializedAfter).not.toContain('READONLY_ANSWER');
  });
});
