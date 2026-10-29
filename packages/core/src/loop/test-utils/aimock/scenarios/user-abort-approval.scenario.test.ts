import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

const THREAD = { thread: 'approval-thread', resource: 'approval-user' };

// Aborting a parked run and removing it from the suspended list are covered by
// approve-after-abort and abort-suspended-listing. This scenario covers host detach instead.
describeForAllEngines(
  'User reconnects after the host detaches from a parked tool approval (#26871)',
  engine => {
    const getMock = useLoopScenarioAimock();

    // A local-only detach must preserve the parked approval for reconnection.
    it('can approve from another connection without losing the parked run', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_lookup', name: 'lookup_status', arguments: { query: 'alpha' } }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Status is OK.' });
      const executed: string[] = [];
      const lookup = createTool({
        id: 'lookup_status',
        description: 'Look up a status.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          executed.push(query);
          return { status: `OK:${query}` };
        },
      });
      const { agent } = await createSharedAgent(llm, {
        engine,
        tools: { lookup_status: lookup },
        memory: new MockMemory(),
      });
      const output = await agent.stream('Look up alpha', {
        requireToolApproval: true,
        maxSteps: 5,
        memory: THREAD,
      });
      let approvalSeen = false;
      for await (const chunk of output.fullStream) {
        if (chunk.type === 'tool-call-approval') {
          approvalSeen = true;
          break;
        }
      }
      expect(approvalSeen).toBe(true);
      expect(executed).toEqual([]);

      agent.abortThreadStream({ threadId: THREAD.thread, resourceId: THREAD.resource, localOnly: true });
      const resumed = await agent.approveToolCall({ runId: output.runId, toolCallId: 'call_lookup' });
      let text = '';
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'text-delta') text += chunk.payload.text;
      }

      expect(text).toBe('Status is OK.');
      expect(executed).toEqual(['alpha']);
    }, 30_000);
  },
  { skip: ['normal', 'fs'] },
);
