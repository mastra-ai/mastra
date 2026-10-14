import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runApprovalScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Per-tool `beforeApproval` hook (#26772), driven through a real Agent and HTTP model mock.
 */
describe('AIMock loop scenario: beforeApproval hook', () => {
  const getMock = useLoopScenarioAimock();

  const makeRefundTool = (
    beforeApproval: (input: { orderId: string }) => unknown,
    execute = vi.fn(async ({ orderId }: { orderId: string }) => ({ refunded: orderId })),
    extra: Record<string, unknown> = {},
  ) => ({
    execute,
    tool: createTool({
      id: 'issue_refund',
      description: 'Refund an order.',
      inputSchema: z.object({ orderId: z.string() }),
      requireApproval: true,
      beforeApproval: beforeApproval as any,
      execute,
      ...extra,
    }),
  });

  const toolResultsSentToModel = (requests: unknown[]) => JSON.stringify(requests);

  it('a rejection skips approval and execute, and the model sees the hook output', async () => {
    const beforeApproval = vi.fn(async ({ orderId }: { orderId: string }) =>
      orderId === 'missing' ? { proceed: false as const, output: { error: 'ORDER_NOT_FOUND_missing' } } : undefined,
    );
    const { tool, execute } = makeRefundTool(beforeApproval);

    const { output, approvals, chunks, requests } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Refund order missing.',
      tools: { issue_refund: tool },
      stopWhen: stepCountIs(5),
      decision: () => true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_refund', name: 'issue_refund', arguments: { orderId: 'missing' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'That order does not exist.' });
      },
    });

    expect(beforeApproval).toHaveBeenCalledTimes(1);
    expect(approvals).toHaveLength(0);
    expect(chunks.some(c => c.type === 'tool-call-approval')).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect(toolResultsSentToModel(requests)).toContain('ORDER_NOT_FOUND_missing');
    expect(await output.text).toContain('does not exist');
  });

  it('a pass-through suspends for approval, runs execute once on approve, and does not re-run the hook', async () => {
    const beforeApproval = vi.fn(async () => undefined);
    const { tool, execute } = makeRefundTool(beforeApproval);

    const { approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Refund order o-1.',
      tools: { issue_refund: tool },
      stopWhen: stepCountIs(5),
      decision: () => true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_refund', name: 'issue_refund', arguments: { orderId: 'o-1' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Refunded.' });
      },
    });

    expect(approvals).toEqual(['approve:call_refund']);
    expect(beforeApproval).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(toolResultsSentToModel(requests)).toContain('refunded');
  });

  it('a pass-through that is declined never executes', async () => {
    const { tool, execute } = makeRefundTool(async () => undefined);

    const { approvals } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Refund order o-1.',
      tools: { issue_refund: tool },
      stopWhen: stepCountIs(5),
      decision: () => false,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_refund', name: 'issue_refund', arguments: { orderId: 'o-1' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Not refunded.' });
      },
    });

    expect(approvals).toEqual(['decline:call_refund']);
    expect(execute).not.toHaveBeenCalled();
  });

  it('a throwing hook falls through to the approval gate (fail-safe)', async () => {
    const { tool, execute } = makeRefundTool(async () => {
      throw new Error('lookup service down');
    });

    const { approvals } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Refund order o-1.',
      tools: { issue_refund: tool },
      stopWhen: stepCountIs(5),
      decision: () => true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_refund', name: 'issue_refund', arguments: { orderId: 'o-1' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Refunded.' });
      },
    });

    expect(approvals).toEqual(['approve:call_refund']);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('only the rejected call is short-circuited when siblings run in the same step', async () => {
    const beforeApproval = vi.fn(async ({ orderId }: { orderId: string }) =>
      orderId === 'missing' ? { proceed: false as const, output: 'ORDER_NOT_FOUND' } : undefined,
    );
    const { tool, execute } = makeRefundTool(beforeApproval);

    const { approvals } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Refund orders missing and o-2.',
      tools: { issue_refund: tool },
      stopWhen: stepCountIs(5),
      decision: () => true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_missing', name: 'issue_refund', arguments: { orderId: 'missing' } },
              { id: 'call_ok', name: 'issue_refund', arguments: { orderId: 'o-2' } },
            ],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    expect(approvals).toEqual(['approve:call_ok']);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![0]).toEqual({ orderId: 'o-2' });
  });

  it('does not run when needsApproval decides the call needs no approval', async () => {
    const beforeApproval = vi.fn(async () => ({ proceed: false as const, output: 'rejected' }));
    const { tool, execute } = makeRefundTool(beforeApproval, undefined, {
      requireApproval: async ({ orderId }: { orderId: string }) => orderId !== 'small',
    });

    const { approvals } = await runApprovalScenario({
      llm: getMock(),
      prompt: 'Refund order small.',
      tools: { issue_refund: tool },
      requireToolApproval: false,
      stopWhen: stepCountIs(5),
      decision: () => true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_refund', name: 'issue_refund', arguments: { orderId: 'small' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Refunded.' });
      },
    });

    expect(approvals).toHaveLength(0);
    expect(beforeApproval).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
