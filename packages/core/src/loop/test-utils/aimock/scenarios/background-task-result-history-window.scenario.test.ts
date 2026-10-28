import { it, expect } from 'vitest';
import { z } from 'zod';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * A completed background task's result is written back into the original
 * assistant message, which keeps its dispatch-time `createdAt`. Message history
 * loads the newest `lastMessages` rows by `createdAt`, so once enough messages
 * land on the thread while the task runs, the `untilIdle` continuation turn no
 * longer carries the result — while its directive tells the model the result
 * is "now in the conversation" and not to call the tool again.
 */
const RESULT_MARKER = 'SLOW_ADD_RESULT_MARKER';
const THREAD_ID = 'bg-result-window-thread';
const RESOURCE_ID = 'user-1';

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 10_000) {
  const start = Date.now();
  while (!(await condition())) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

function userMessage(index: number): MastraDBMessage {
  return {
    id: `inserted-user-${index}`,
    role: 'user',
    type: 'text',
    threadId: THREAD_ID,
    resourceId: RESOURCE_ID,
    createdAt: new Date(Date.now() + index),
    content: { format: 2, parts: [{ type: 'text', text: `side note ${index}` }] },
  };
}

describeForAllEngines(
  'AIMock loop scenario: background result outside the history window',
  engine => {
    const getMock = useLoopScenarioAimock();

    async function runScenario({ insertedMessages }: { insertedMessages: number }) {
      let releaseTool!: () => void;
      const toolGate = new Promise<void>(resolve => (releaseTool = resolve));
      let toolStarted = false;

      const slowAdd = createTool({
        id: 'slowAdd',
        description: 'Adds two numbers slowly',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        background: { enabled: true, timeoutMs: 30_000 },
        execute: async ({ a, b }) => {
          toolStarted = true;
          await toolGate;
          return { sum: a + b, marker: RESULT_MARKER };
        },
      });

      const memory = new MockMemory({ options: { lastMessages: 3 } });

      const { output, llm } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'What is 1+2?',
        tools: { slowAdd },
        agentBackgroundTasks: { tools: { slowAdd: true } },
        backgroundTasks: { enabled: true },
        memory,
        threadId: THREAD_ID,
        resourceId: RESOURCE_ID,
        streamUntilIdle: true,
        manualStreamConsumption: true,
        fixtures: mock => {
          mock.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_1', name: 'slowAdd', arguments: { a: 1, b: 2 } }] },
          );
          mock.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Working on it.' });
          mock.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'The answer is 3.' });
        },
      });

      const drained = (async () => {
        for await (const _chunk of output.fullStream as AsyncIterable<unknown>) {
          // drain
        }
      })();

      await waitFor(() => toolStarted);
      await waitFor(async () => {
        const { messages } = await memory.recall({ threadId: THREAD_ID, resourceId: RESOURCE_ID });
        return JSON.stringify(messages).includes('Working on it.');
      });

      if (insertedMessages > 0) {
        await memory.saveMessages({
          messages: Array.from({ length: insertedMessages }, (_, index) => userMessage(index)),
        });
      }

      releaseTool();
      await drained;

      const requests = llm.getRequests();
      const continuation = JSON.stringify(requests[requests.length - 1]?.body ?? {});
      const { messages: stored } = await memory.recall({ threadId: THREAD_ID, resourceId: RESOURCE_ID });

      return { requestCount: requests.length, continuation, stored: JSON.stringify(stored) };
    }

    it('continuation carries the result when nothing was added during the task', async () => {
      const { requestCount, continuation, stored } = await runScenario({ insertedMessages: 0 });

      expect(requestCount).toBe(3);
      expect(stored).toContain(RESULT_MARKER);
      expect(continuation).toContain(RESULT_MARKER);
    }, 30_000);

    it('continuation carries the result after more than lastMessages messages were added during the task', async () => {
      const { requestCount, continuation, stored } = await runScenario({ insertedMessages: 4 });
      expect(requestCount).toBe(3);
      expect(stored).toContain(RESULT_MARKER);
      expect(continuation).toContain('Their results are now in the conversation');
      expect(continuation).toContain(RESULT_MARKER);
    }, 30_000);
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
