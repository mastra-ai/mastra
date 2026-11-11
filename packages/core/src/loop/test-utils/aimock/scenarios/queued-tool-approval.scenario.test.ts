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
describeForAllEngines(
  'AIMock loop scenario: queued approvals survive re-suspension',
  engine => {
    const getMock = useLoopScenarioAimock();

    it.each(['forward', 'reverse', 'concurrent', 'one-by-one'] as const)(
      'finishes both calls approved in %s order',
      async order => {
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
        const threadId = `queued-${engine}-${order}`;
        const resourceId = 'reviewer';
        const chunks: any[] = [];
        const subscription = await agent.subscribeToThread({ threadId, resourceId });
        const drain = (async () => {
          for await (const chunk of subscription.stream) chunks.push(chunk);
        })();
        let initial: { runId: string; cleanup?: () => void } | undefined;
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
          if (order === 'one-by-one') {
            // Approving call-a must not run call-b. The resumed stream ends once the run parks on call-b (#27925).
            const resumed = await agent.resumeStream(
              { confirmed: true },
              { runId: initial.runId, toolCallId: 'call-a' },
            );
            for await (const _ of resumed.fullStream) {
              // drain
            }
            expect(committed).toEqual(['A']);
          }
          const ids =
            order === 'reverse' ? ['call-b', 'call-a'] : order === 'one-by-one' ? ['call-b'] : ['call-a', 'call-b'];
          const approve = (toolCallId: string) =>
            agent.sendToolApproval({
              threadId,
              resourceId,
              toolCallId,
              approved: true,
              resumeData: { confirmed: true },
            });
          const decisions = [];
          if (order === 'concurrent') decisions.push(...(await Promise.all(ids.map(approve))));
          else for (const id of ids) decisions.push(await approve(id));
          expect(decisions.map(d => d.toolCallId)).toEqual(ids);
          await vi.waitFor(
            () => {
              expect(
                chunks
                  .filter(c => c.type === 'text-delta')
                  .map(c => c.payload.text)
                  .join(''),
              ).toBe('Both done.');
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
        } finally {
          initial?.cleanup?.();
          subscription.unsubscribe();
          await drain;
          if (engine !== 'inngest') await mastra.shutdown({ drainTimeout: 1000 });
        }
      },
      30_000,
    );

    // Technical: approval tools run one at a time, so call-b first parks while call-a's approval runs
    // and publishes its own suspension. InngestAgent's resume() stream stays open across it, so a
    // second report of call-b would reach onSuspended.
    (engine === 'inngest' ? it : it.skip)(
      'reports a call that first parks during a resume once',
      async () => {
        const llm = getMock();
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call-a', name: 'archive', arguments: { item: 'A' } },
              { id: 'call-b', name: 'archive', arguments: { item: 'B' } },
            ],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Both done.' });
        const archive = createTool({
          id: 'archive',
          description: 'Archive an item.',
          inputSchema: z.object({ item: z.string() }),
          requireApproval: true,
          execute: async ({ item }) => ({ item }),
        });
        const { agent } = await createSharedAgent(llm, { engine, memory: new MockMemory(), tools: { archive } });
        const memory = { thread: 'sequential-approvals', resource: 'reviewer' };
        const initial = await agent.stream('Archive both items.', { maxSteps: 4, memory });
        for await (const chunk of initial.fullStream) if (chunk.type === 'tool-call-approval') break;

        const suspended: string[] = [];
        const inngestAgent = agent as unknown as {
          resume: (
            runId: string,
            resumeData: unknown,
            options: { toolCallId: string; onSuspended: (data: { toolCallId: string }) => void },
          ) => Promise<{ output: { fullStream: AsyncIterable<{ type: string }> }; cleanup?: () => void }>;
        };
        const resumed = await inngestAgent.resume(
          initial.runId,
          { approved: true },
          { toolCallId: 'call-a', onSuspended: data => suspended.push(data.toolCallId) },
        );
        try {
          for await (const chunk of resumed.output.fullStream) if (chunk.type === 'tool-call-approval') break;
          // A second report would follow the first; only waiting can show it never comes.
          await new Promise(resolve => setTimeout(resolve, 3000));
          expect(suspended).toEqual(['call-b']);
        } finally {
          resumed.cleanup?.();
          initial.cleanup?.();
        }
      },
      30_000,
    );
  },
  { skip: ['fs'] },
);
