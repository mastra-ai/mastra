import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: working-memory persistence + injection across turns.
 *
 * When memory has working memory enabled and a thread/resource is supplied, the
 * loop auto-injects the `updateWorkingMemory` tool. In turn 1 the model calls it
 * to persist a fact. The loop must (a) execute that tool so the value is stored,
 * and (b) inject the stored working memory into the system prompt on a later
 * turn. A regression in working-memory wiring (tool not injected, value not
 * persisted, or not re-injected) is caught here.
 */
describeForAllEngines('AIMock loop scenario: working memory', engine => {
  const getMock = useLoopScenarioAimock();

  it('persists working memory in turn 1 and injects it into a later request', async () => {
    const memory = new MockMemory({
      enableWorkingMemory: true,
      workingMemoryTemplate: `# User Profile\n- **Name**:\n- **Preference**:\n`,
    });
    const threadId = 'working-memory-thread';
    const resourceId = 'working-memory-resource';

    await memory.saveThread({
      thread: {
        id: threadId,
        title: 'WM Thread',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const storedMemory = '# User Profile\n- **Name**: Ada\n- **Preference**: WM_DARK_MODE\n';

    // Turn 1: model calls updateWorkingMemory, then turn 2 of the inner loop
    // (with the tool result) emits final text.
    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Remember that my name is Ada and I prefer WM_DARK_MODE.',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call_wm',
                name: 'updateWorkingMemory',
                arguments: { memory: storedMemory },
              },
            ],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Saved your profile.' });
      },
    });

    // The working memory must be persisted to the thread.
    const savedWorkingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(savedWorkingMemory).toContain('WM_DARK_MODE');

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 2: a fresh run on the same thread. The stored working memory must be
    // injected into the request (system prompt) so the model can use it.
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What do you know about me?',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'You are Ada and you prefer dark mode.' });
      },
    });

    expect(requests).toHaveLength(1);
    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);
    expect(serialized).toContain('WM_DARK_MODE');
  });
});
