import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTestSession } from '../../../../agent-controller/test-utils';
import type { AgentControllerEvent } from '../../../../agent-controller/types';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

const ask = createTool({
  id: 'ask',
  description: 'Ask the user a question',
  inputSchema: z.object({ q: z.string() }),
  suspendSchema: z.object({ q: z.string() }),
  resumeSchema: z.object({ a: z.string() }),
  execute: async ({ q }, context) => {
    const answer = context?.agent?.resumeData as { a: string } | undefined;
    if (!answer) return context?.agent?.suspend?.({ q });
    return { answer: answer.a };
  },
});

describeForAllEngines('Controller answers a tool suspension from another thread', engine => {
  const getMock = useLoopScenarioAimock();

  it('returns once the resumed run on the source thread ends', async () => {
    const llm = getMock();
    const { agent } = await createSharedAgent(llm, { engine, tools: { ask } });
    const { controller, session } = await createTestSession({ agent });
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    await session.permissions.setForTool({ toolName: 'ask', policy: 'allow' });
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'ask-call', name: 'ask', arguments: { q: 'Ok?' } }] },
    );
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Thanks.' });

    try {
      await session.sendMessage({ content: 'Ask me something.' });
      const suspended = events.find(
        (event): event is Extract<AgentControllerEvent, { type: 'tool_suspended' }> =>
          event.type === 'tool_suspended' && event.toolCallId === 'ask-call',
      );
      expect(suspended).toBeDefined();
      const address = {
        threadId: suspended!.threadId!,
        resourceId: suspended!.resourceId!,
        runId: suspended!.runId!,
        toolCallId: suspended!.toolCallId,
      };

      await session.thread.create();
      expect(session.thread.getId()).not.toBe(address.threadId);

      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        session.respondToToolSuspension({ resumeData: { a: 'yes' }, address }).then(() => 'settled'),
        new Promise<string>(resolve => {
          timer = setTimeout(() => resolve('timed out'), 8_000);
        }),
      ]).finally(() => clearTimeout(timer));

      expect(outcome).toBe('settled');
      const requests = llm.getRequests();
      expect(requests).toHaveLength(2);
      expect(JSON.stringify(requests[1]?.body)).toContain('yes');
    } finally {
      await controller.destroy();
    }
  }, 20_000);
});
