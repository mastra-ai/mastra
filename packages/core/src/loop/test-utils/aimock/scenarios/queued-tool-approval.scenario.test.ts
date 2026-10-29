import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { DurableStepIds } from '../../../../agent/durable/constants';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

// #25831: approving one of two suspended calls must not strand the queued approval
// when the first resume re-suspends. Exercise the public thread approval queue.
// #27925: on Inngest, one approval resumed both parked calls and two approvals
// raced each other, repeating the final answer.
describeForAllEngines(
  'AIMock loop scenario: queued approvals survive re-suspension',
  engine => {
    const getMock = useLoopScenarioAimock();

    /** Starts a run that parks two `confirm` calls for approval. */
    const parkTwoApprovals = async (threadId: string) => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        {
          toolCalls: [
            { id: 'call-a', name: 'confirm', arguments: { item: 'A' } },
            { id: 'call-b', name: 'confirm', arguments: { item: 'B' } },
          ],
        },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Both done.' });
      const committed: string[] = [];
      const confirm = createTool({
        id: 'confirm',
        description: 'Confirm an item before committing it.',
        inputSchema: z.object({ item: z.string() }),
        execute: async ({ item }, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({ item });
          committed.push(item);
          return { item, confirmed: true };
        },
      });
      const { agent, mastra } = await createSharedAgent(llm, {
        engine,
        memory: new MockMemory(),
        tools: { confirm },
      });
      const resourceId = 'reviewer';
      const chunks: any[] = [];
      const subscription = await agent.subscribeToThread({ threadId, resourceId });
      const drain = (async () => {
        for await (const chunk of subscription.stream) chunks.push(chunk);
      })();
      let initial: { runId: string; cleanup?: () => void } | undefined;
      const close = async () => {
        initial?.cleanup?.();
        subscription.unsubscribe();
        await drain;
        if (engine !== 'inngest') await mastra.shutdown({ drainTimeout: 1000 });
      };
      try {
        initial = await agent.stream('Confirm both items.', {
          maxSteps: 4,
          memory: { thread: threadId, resource: resourceId },
        });
        await vi.waitFor(() => expect(chunks.filter(c => c.type === 'tool-call-suspended')).toHaveLength(2), {
          timeout: 10_000,
        });
        if (isDurableEngineVariant(engine) && engine !== 'inngest') {
          const workflows = await mastra.getStorage().getStore('workflows');
          await vi.waitFor(
            async () => {
              const persisted = await workflows.getWorkflowRunById({
                workflowName: DurableStepIds.AGENTIC_LOOP,
                runId: initial!.runId,
              });
              const snapshot =
                typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
              expect(snapshot?.status).toBe('suspended');
            },
            { timeout: 10_000 },
          );
        }
      } catch (error) {
        await close();
        throw error;
      }
      const approve = (toolCallId: string) =>
        agent.sendToolApproval({
          threadId,
          resourceId,
          toolCallId,
          approved: true,
          resumeData: { confirmed: true },
        });
      const text = () =>
        chunks
          .filter(c => c.type === 'text-delta')
          .map(c => c.payload.text)
          .join('');
      const expectBothDoneOnce = async () => {
        await vi.waitFor(
          () => {
            expect(text()).toBe('Both done.');
            expect(chunks.some(c => c.type === 'finish' && c.payload.stepResult?.reason === 'stop')).toBe(true);
          },
          { timeout: 10_000 },
        );
        expect(committed.sort()).toEqual(['A', 'B']);
        expect(
          chunks
            .filter(c => c.type === 'tool-result')
            .map(c => c.payload.toolCallId)
            .sort(),
        ).toEqual(['call-a', 'call-b']);
        expect(chunks.filter(c => c.type === 'tool-error' || c.type === 'error')).toEqual([]);
        const lastRequest = llm.getRequests().at(-1)!;
        expect(
          lastRequest.body.messages
            .filter((m: any) => m.role === 'tool')
            .map((m: any) => m.tool_call_id)
            .sort(),
        ).toEqual(['call-a', 'call-b']);
      };
      return { llm, committed, chunks, text, approve, expectBothDoneOnce, close };
    };

    it.each(['forward', 'reverse', 'concurrent'] as const)(
      'finishes both calls approved in %s order',
      async order => {
        const run = await parkTwoApprovals(`queued-${engine}-${order}`);
        try {
          const ids = order === 'reverse' ? ['call-b', 'call-a'] : ['call-a', 'call-b'];
          const decisions =
            order === 'concurrent'
              ? await Promise.all(ids.map(run.approve))
              : [await run.approve(ids[0]!), await run.approve(ids[1]!)];
          expect(decisions.map(d => d.toolCallId)).toEqual(ids);
          await run.expectBothDoneOnce();
        } finally {
          await run.close();
        }
      },
      30_000,
    );

    it('approving one call leaves its sibling parked until it is approved', async () => {
      const run = await parkTwoApprovals(`queued-${engine}-single`);
      try {
        await run.approve('call-a');
        await vi.waitFor(() => expect(run.committed).toEqual(['A']), { timeout: 10_000 });
        // Give a wrongly resumed sibling time to run before asserting it didn't.
        await new Promise(resolve => setTimeout(resolve, 1_500));
        expect(run.committed).toEqual(['A']);
        expect(run.text()).toBe('');
        expect(run.llm.getRequests()).toHaveLength(1);

        await run.approve('call-b');
        await run.expectBothDoneOnce();
        expect(run.llm.getRequests()).toHaveLength(2);
      } finally {
        await run.close();
      }
    }, 30_000);
  },
  { skip: ['fs'] },
);
