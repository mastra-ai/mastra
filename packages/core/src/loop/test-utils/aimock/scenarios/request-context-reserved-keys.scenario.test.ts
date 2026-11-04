/**
 * AIMock Scenario: reserved request-context keys choose the memory thread.
 *
 * Server middleware sets `mastra__resourceId` / `mastra__threadId` on the
 * request context so a client cannot write into another user's thread by
 * sending a different `memory` option. The run must save the conversation to
 * the thread named by the reserved keys, on every engine, and never create the
 * thread the caller asked for.
 */

import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../../../request-context';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

const REPLY = 'Saved where the middleware said.';

function middlewareContext() {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, 'middleware-user');
  requestContext.set(MASTRA_THREAD_ID_KEY, 'middleware-thread');
  return requestContext;
}

async function threadTexts(memory: MockMemory, threadId: string) {
  const { messages } = await memory.recall({ threadId, perPage: false });
  return messages.map(m => ({
    role: m.role,
    text: m.content.parts.flatMap(p => (p.type === 'text' ? [p.text] : [])).join(''),
  }));
}

describeForAllEngines('AIMock loop scenario: reserved request-context keys', engine => {
  const getMock = useLoopScenarioAimock();

  it('saves the conversation to the thread and resource named by the reserved keys', async () => {
    const memory = new MockMemory();

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Remember this.',
      memory,
      requestContext: middlewareContext(),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: REPLY });
      },
    });

    expect(await output.text).toBe(REPLY);
    const thread = await memory.getThreadById({ threadId: 'middleware-thread' });
    expect(thread?.resourceId).toBe('middleware-user');
    expect(await threadTexts(memory, 'middleware-thread')).toEqual([
      { role: 'user', text: 'Remember this.' },
      { role: 'assistant', text: REPLY },
    ]);
  });

  it('ignores a memory option that names a different thread and resource', async () => {
    const memory = new MockMemory();

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Remember this.',
      memory,
      threadId: 'body-thread',
      resourceId: 'body-resource',
      requestContext: middlewareContext(),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: REPLY });
      },
    });

    expect(await output.text).toBe(REPLY);
    const thread = await memory.getThreadById({ threadId: 'middleware-thread' });
    expect(thread?.resourceId).toBe('middleware-user');
    expect(await threadTexts(memory, 'middleware-thread')).toEqual([
      { role: 'user', text: 'Remember this.' },
      { role: 'assistant', text: REPLY },
    ]);
    expect(await memory.getThreadById({ threadId: 'body-thread' })).toBeNull();
  });
});
