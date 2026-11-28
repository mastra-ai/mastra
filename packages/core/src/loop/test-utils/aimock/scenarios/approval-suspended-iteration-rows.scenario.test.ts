import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { DurableStepIds } from '../../../../agent/durable/constants';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Guard: the stored rows a resume reads already describe the suspended iteration
 * by the time the approval chunk reaches the client.
 *
 * A resumer in another process can call approve as soon as it sees the approval
 * chunk, with no in-process execution to wait on. Resume restores the suspended
 * iteration's tool calls and pre-approval text from the outer AGENTIC_LOOP row
 * (for the nested run id) and the nested AGENTIC_EXECUTION row (LLM_EXECUTION
 * output and input.accumulatedSteps). The Inngest engine needs to poll for these
 * rows (#27582). The durable and evented engines write them before the approval
 * chunk is published, so no wait is needed there. These tests pin that ordering.
 */
describeForAllEngines(
  'AIMock loop scenario: suspended iteration rows at approval time',
  engine => {
    const getMock = useLoopScenarioAimock();

    function parse(row: any) {
      return typeof row?.snapshot === 'string' ? JSON.parse(row.snapshot) : row?.snapshot;
    }

    async function suspendAtApproval({ twoIterations }: { twoIterations: boolean }) {
      const lookupTool = createTool({
        id: 'lookup',
        description: 'Looks up a user id',
        inputSchema: z.object({ name: z.string() }),
        execute: async ({ name }) => ({ id: `id-${name}` }),
      });
      const emailTool = createTool({
        id: 'email',
        description: 'Finds an email',
        inputSchema: z.object({ id: z.string() }),
        requireApproval: true,
        execute: async ({ id }) => ({ email: `${id}@mail.com` }),
      });
      const llm = getMock();
      const emailStep = {
        content: 'Let me look that up. ',
        toolCalls: [{ id: 'call-email', name: 'emailTool', arguments: { id: 'id-dero' } }],
      };
      if (twoIterations) {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            content: 'Step one. ',
            toolCalls: [{ id: 'call-lookup', name: 'lookupTool', arguments: { name: 'dero' } }],
          },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-lookup', hasToolResult: true }, emailStep);
      } else {
        llm.on({ endpoint: 'chat', hasToolResult: false }, emailStep);
      }
      llm.on({ endpoint: 'chat', toolCallId: 'call-email', hasToolResult: true }, { content: 'Found it.' });

      const shared = await createSharedAgent(llm, { tools: { lookupTool, emailTool }, engine });
      const store = await shared.mastra.getStorage().getStore('workflows');
      if (!store) throw new Error('workflows store missing');

      const output: any = await (shared.agent as any).stream('Find the email of dero', { maxSteps: 5 });
      for await (const chunk of output.fullStream as AsyncIterable<any>) {
        if (chunk.type !== 'tool-call-approval') continue;
        // Read storage the way #loadSuspendedIteration does, at the moment a client sees the approval.
        const outer = await store.getWorkflowRunById({
          runId: output.runId,
          workflowName: DurableStepIds.AGENTIC_LOOP,
        });
        const nestedRunId = parse(outer)?.context?.[DurableStepIds.AGENTIC_EXECUTION]?.metadata?.nestedRunId;
        const nested = await store.getWorkflowRunById({
          runId: nestedRunId ?? output.runId,
          workflowName: DurableStepIds.AGENTIC_EXECUTION,
        });
        return {
          shared,
          store,
          runId: output.runId as string,
          toolCallId: chunk.payload.toolCallId as string,
          outer,
          nested,
        };
      }
      throw new Error('no tool-call-approval chunk');
    }

    for (const twoIterations of [false, true]) {
      const label = twoIterations ? 'second iteration' : 'first iteration';
      const priorText = twoIterations ? ['Step one. '] : [];

      it(`[${label}] the nested row already holds the suspended iteration when the approval chunk arrives`, async () => {
        const { nested } = await suspendAtApproval({ twoIterations });
        const snapshot = parse(nested);
        const llmStep = snapshot?.context?.[DurableStepIds.LLM_EXECUTION];

        expect(llmStep?.status).toBe('success');
        expect(llmStep?.output?.text).toBe('Let me look that up. ');
        expect(llmStep?.output?.toolCalls?.map((call: any) => call.toolCallId)).toEqual(['call-email']);
        expect((snapshot?.context?.input?.accumulatedSteps ?? []).map((step: any) => step.text)).toEqual(priorText);
      });

      it(`[${label}] a resume that reads the rows as they were at approval time keeps the pre-approval text`, async () => {
        const { shared, store, runId, toolCallId, outer, nested } = await suspendAtApproval({ twoIterations });

        // Serve the captured rows to the reads resume makes to restore the iteration, as a
        // resumer in another process would see them. Engine reads still see live storage.
        const original = store.getWorkflowRunById.bind(store);
        const served: string[] = [];
        const read = vi.spyOn(store, 'getWorkflowRunById').mockImplementation(async args => {
          if (new Error().stack?.includes('loadSuspendedIteration')) {
            served.push(args.workflowName);
            return args.workflowName === DurableStepIds.AGENTIC_LOOP ? outer : nested;
          }
          return original(args);
        });

        try {
          const resumed = await shared.agent.approveToolCall({ runId, toolCallId });
          const deltas: string[] = [];
          for await (const chunk of resumed.fullStream) {
            if (chunk.type === 'text-delta') deltas.push(chunk.payload.text);
          }

          expect(served).toEqual([DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]);
          expect(deltas.join('')).toBe('Found it.');
          expect(await resumed.text).toBe(`${priorText.join('')}Let me look that up. Found it.`);
        } finally {
          read.mockRestore();
        }
      });
    }
  },
  // normal and fs don't suspend through the durable rows; Inngest resumes through its own path (#27582).
  { skip: ['normal', 'fs', 'inngest'] },
);
