import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Scenario: tool input is validated before a person is asked to approve the call
 * (#26771, PR #26973).
 *
 * A refund tool requires approval. The model first calls it with `amount: "a lot"`. Before the
 * fix, that call was shown to a person for approval, and after approval it failed schema
 * validation anyway. The approval was wasted, and approval UIs that assume valid input broke.
 *
 * Now invalid input goes back to the model as the validation error, without an approval
 * request, a suspension, or `beforeApproval`. The model can correct itself, and only the valid
 * call reaches the approval gate. `beforeApproval` receives the parsed input with schema
 * defaults applied.
 */

const INVALID_ARGS = { orderId: 'ord-1', amount: 'a lot' };
const VALID_ARGS = { orderId: 'ord-1', amount: 25 };

function makeRefundTool(calls: { beforeApproval: unknown[]; execute: unknown[] }) {
  return createTool({
    id: 'issue_refund',
    description: 'Refund an order',
    inputSchema: z.object({
      orderId: z.string(),
      amount: z.number(),
      currency: z.string().default('USD'),
    }),
    requireApproval: true,
    beforeApproval: async input => {
      calls.beforeApproval.push(input);
      return undefined;
    },
    execute: async input => {
      calls.execute.push(input);
      return { refunded: input.amount };
    },
  });
}

function toolMessagesFor(request: { body: unknown } | undefined, toolCallId: string) {
  return ((request?.body as any)?.messages ?? []).filter(
    (m: any) => m.role === 'tool' && m.tool_call_id === toolCallId,
  );
}

describeForAllEngines(
  'AIMock scenario: tool input validated before approval',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('returns invalid input to the model, then approves and runs only the corrected call', async () => {
      const calls = { beforeApproval: [] as unknown[], execute: [] as unknown[] };
      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        tools: { issue_refund: makeRefundTool(calls) },
        memory,
        engine,
      });
      const threadId = `approval-validation-${engine}`;
      const resourceId = 'support-agent';

      const { output, chunks, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Refund order ord-1',
        memory,
        threadId,
        resourceId,
        stopWhen: stepCountIs(5),
        collectChunks: true,
        fixtures: llm => {
          // 1st call: invalid amount.
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call-invalid', name: 'issue_refund', arguments: INVALID_ARGS }] },
          );
          // 2nd call: the model saw the validation error and retries with a number.
          llm.on(
            { endpoint: 'chat', predicate: req => !JSON.stringify(req).includes('call-valid') },
            { toolCalls: [{ id: 'call-valid', name: 'issue_refund', arguments: VALID_ARGS }] },
          );
          // 3rd call (after approval + execution): final answer.
          llm.on(
            { endpoint: 'chat', predicate: req => JSON.stringify(req).includes('call-valid') },
            {
              content: 'Refunded $25.',
            },
          );
        },
      });

      // The invalid call went straight back to the model; nobody was asked to approve it.
      expect(requests).toHaveLength(2);
      const invalidResult = toolMessagesFor(requests[1], 'call-invalid');
      expect(invalidResult).toHaveLength(1);
      expect(invalidResult[0].content).toMatch(/validation/i);
      expect(invalidResult[0].content).toContain('amount');

      // Only the corrected call reached the approval gate.
      const approvals = (chunks ?? []).filter(c => c.type === 'tool-call-approval') as any[];
      expect(approvals.map(c => c.payload.toolCallId)).toEqual(['call-valid']);
      expect(approvals[0].payload.args).toMatchObject(VALID_ARGS);

      // beforeApproval ran once, for the valid call, with schema defaults applied.
      expect(calls.beforeApproval).toEqual([{ ...VALID_ARGS, currency: 'USD' }]);
      expect(calls.execute).toHaveLength(0);

      // Approving runs the tool and the loop finishes.
      const resumed = await shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'call-valid' });
      for await (const _chunk of resumed.fullStream) {
        // drain
      }
      expect(await resumed.text).toBe('Refunded $25.');
      expect(calls.execute).toEqual([{ ...VALID_ARGS, currency: 'USD' }]);
      expect(getMock().getRequests()).toHaveLength(3);
    });

    it('never suspends when every call is invalid (no stray approval request)', async () => {
      const calls = { beforeApproval: [] as unknown[], execute: [] as unknown[] };

      const { output, chunks, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Refund order ord-1',
        tools: { issue_refund: makeRefundTool(calls) },
        stopWhen: stepCountIs(5),
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call-invalid', name: 'issue_refund', arguments: INVALID_ARGS }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'I need a numeric amount to refund.' });
        },
      });

      expect((chunks ?? []).filter(c => c.type === 'tool-call-approval')).toHaveLength(0);
      expect((chunks ?? []).some(c => c.type === 'tool-call-suspended')).toBe(false);
      expect(calls.beforeApproval).toHaveLength(0);
      expect(calls.execute).toHaveLength(0);
      expect(requests).toHaveLength(2);
      expect(await output.text).toBe('I need a numeric amount to refund.');
      expect(await output.finishReason).toBe('stop');
    });
  },
  { skip: ['fs'] },
);
