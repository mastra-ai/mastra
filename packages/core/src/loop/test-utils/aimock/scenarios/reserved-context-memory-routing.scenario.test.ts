import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../../../request-context';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: reserved request-context memory keys (#27542).
 *
 * Server middleware sets `mastra__threadId` / `mastra__resourceId` on the
 * request context from the authenticated user, and those values must win over
 * whatever thread/resource the request body asked for. Every engine has to
 * route memory reads and writes to the context's thread, otherwise a caller can
 * read and write another user's thread by naming it in the body.
 */
describeForAllEngines('AIMock loop scenario: reserved request-context memory keys', engine => {
  const getMock = useLoopScenarioAimock();

  it('routes memory to the request-context thread and resource over memory options', async () => {
    const memory = new MockMemory();
    const ctxThread = 'reserved-ctx-thread';
    const ctxResource = 'reserved-ctx-resource';
    const bodyThread = 'reserved-body-thread';
    const bodyResource = 'reserved-body-resource';

    for (const [id, resourceId] of [
      [ctxThread, ctxResource],
      [bodyThread, bodyResource],
    ] as const) {
      await memory.saveThread({
        thread: { id, title: id, resourceId, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
      });
    }

    const contextFor = () => {
      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, ctxThread);
      requestContext.set(MASTRA_RESOURCE_ID_KEY, ctxResource);
      return requestContext;
    };

    // Turn 1 seeds a fact. The body names another user's thread; the context wins.
    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My vault code is RESERVED_KEY_4417.',
      memory,
      threadId: bodyThread,
      resourceId: bodyResource,
      requestContext: contextFor(),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Noted.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // Turn 2 must recall turn 1 from the context thread.
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is my vault code?',
      memory,
      threadId: bodyThread,
      resourceId: bodyResource,
      requestContext: contextFor(),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'It is RESERVED_KEY_4417.' });
      },
    });

    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0]?.body?.messages ?? [])).toContain('RESERVED_KEY_4417');

    const ctxMessages = (await memory.recall({ threadId: ctxThread, resourceId: ctxResource })).messages;
    const bodyMessages = (await memory.recall({ threadId: bodyThread, resourceId: bodyResource })).messages;
    expect(JSON.stringify(ctxMessages)).toContain('What is my vault code?');
    expect(bodyMessages).toEqual([]);
  });

  it('keeps routing memory to the memory options thread when no reserved keys are set', async () => {
    const memory = new MockMemory();
    const threadId = 'plain-options-thread';
    const resourceId = 'plain-options-resource';
    await memory.saveThread({
      thread: { id: threadId, title: threadId, resourceId, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
    });

    const requestContext = new RequestContext();
    requestContext.set('tenant', 'acme');

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My locker number is PLAIN_OPTIONS_9021.',
      memory,
      threadId,
      resourceId,
      requestContext,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Noted.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is my locker number?',
      memory,
      threadId,
      resourceId,
      requestContext,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'It is PLAIN_OPTIONS_9021.' });
      },
    });

    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0]?.body?.messages ?? [])).toContain('PLAIN_OPTIONS_9021');
    const messages = (await memory.recall({ threadId, resourceId })).messages;
    expect(JSON.stringify(messages)).toContain('What is my locker number?');
  });
});
