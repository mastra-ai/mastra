import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { RequestContext } from '../../../../request-context';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  runApprovalScenario,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * A support agent can look up orders freely but needs a human to approve refunds. The store wires
 * that up three ways: a per-call approval policy, a `beforeApproval` check that rejects impossible
 * refunds before bothering a human, and an approval UI that lets the reviewer attach a note. Each
 * must behave the same whichever engine runs the agent, or a refund can be issued without review,
 * a reviewer can be asked about an order that does not exist, or the reviewer's note is lost.
 */

const lookupCall = { id: 'call-lookup', name: 'lookupOrder', arguments: { orderId: '4821' } };
const refundCall = { id: 'call-refund', name: 'issueRefund', arguments: { orderId: '4821', amount: 180 } };

function supportTools(beforeApproval?: (input: { orderId: string }) => unknown) {
  const executed: string[] = [];
  const seenResumeData: unknown[] = [];
  const lookupOrder = createTool({
    id: 'lookupOrder',
    description: 'Look up an order.',
    inputSchema: z.object({ orderId: z.string() }),
    execute: async ({ orderId }) => {
      executed.push('lookupOrder');
      return { orderId, status: 'delivered' };
    },
  });
  const issueRefund = createTool({
    id: 'issueRefund',
    description: 'Refund an order.',
    inputSchema: z.object({ orderId: z.string(), amount: z.number() }),
    ...(beforeApproval ? { requireApproval: true, beforeApproval: beforeApproval as any } : {}),
    execute: async ({ orderId, amount }, context) => {
      executed.push('issueRefund');
      seenResumeData.push(context?.agent?.resumeData);
      return { orderId, amount, status: 'refunded' };
    },
  });
  return { tools: { lookupOrder, issueRefund }, executed, seenResumeData };
}

describeForAllEngines('Support agent refund approvals', engine => {
  const getMock = useLoopScenarioAimock();

  // Technical: function-form `requireToolApproval` is evaluated per tool call with the real
  // toolName and parsed args, so only the matching call suspends.
  it('only the refund waits for a human; the order lookup runs straight away', async () => {
    const { tools, executed } = supportTools();
    const policy = vi.fn(({ toolName }: { toolName: string }) => toolName === 'issueRefund');

    const { output, chunks, approvals } = await runApprovalScenario({
      engine,
      llm: getMock(),
      tools,
      prompt: 'Order #4821 arrived broken, please refund the $180.',
      stopWhen: stepCountIs(5),
      requireToolApproval: policy,
      decision: () => true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [lookupCall, refundCall] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your $180 refund is on its way.' });
      },
    });

    const askedFor = chunks.filter(c => c.type === 'tool-call-approval').map(c => (c.payload as any).toolName);
    expect(askedFor).toEqual(['issueRefund']);
    expect(approvals).toHaveLength(1);
    expect(policy.mock.calls.map(([ctx]) => [ctx.toolName, ctx.args])).toEqual(
      expect.arrayContaining([
        ['lookupOrder', lookupCall.arguments],
        ['issueRefund', refundCall.arguments],
      ]),
    );
    expect(executed.sort()).toEqual(['issueRefund', 'lookupOrder']);
    expect(await output.text).toBe('Your $180 refund is on its way.');
  });

  // Technical: a throwing policy must fail safe and require approval rather than running the tool.
  it('a broken approval policy still asks a human before refunding', async () => {
    const { tools, executed } = supportTools();

    const { chunks, approvals } = await runApprovalScenario({
      engine,
      llm: getMock(),
      tools,
      prompt: 'Please refund order #4821, it was $180.',
      stopWhen: stepCountIs(5),
      requireToolApproval: () => {
        throw new Error('policy service down');
      },
      decision: () => false,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [refundCall] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The refund was not approved.' });
      },
    });

    expect(chunks.some(c => c.type === 'tool-call-approval')).toBe(true);
    expect(approvals).toEqual(['decline:call-refund']);
    expect(executed).toEqual([]);
  });

  // Technical: `beforeApproval` returning `{ proceed: false, output }` resolves the call with that
  // output as the tool result: no suspension, no execution, and the model sees the rejection (#26772).
  it('a refund for an unknown order is rejected without asking a human (#26772)', async () => {
    const beforeApproval = vi.fn(async ({ orderId }: { orderId: string }) => ({
      proceed: false as const,
      output: { error: `Order ${orderId} not found` },
    }));
    const { tools, executed } = supportTools(beforeApproval);

    const { chunks, approvals } = await runApprovalScenario({
      engine,
      llm: getMock(),
      tools,
      prompt: 'Please refund order #4821, it was $180.',
      stopWhen: stepCountIs(5),
      requireToolApproval: false,
      decision: () => true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [refundCall] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: "I couldn't find that order." });
      },
    });

    expect(beforeApproval).toHaveBeenCalledWith(
      refundCall.arguments,
      expect.objectContaining({ toolCallId: 'call-refund', toolName: 'issueRefund' }),
    );
    expect(approvals).toEqual([]);
    expect(chunks.some(c => c.type === 'tool-call-approval')).toBe(false);
    expect(executed).toEqual([]);
    expect(JSON.stringify(getMock().getRequests()[1]!.body)).toContain('Order 4821 not found');
  });

  // Technical: when `beforeApproval` lets the call through, the run suspends; resuming must not
  // run the hook a second time (#26772).
  it('a valid refund waits for a human and is checked only once (#26772)', async () => {
    const beforeApproval = vi.fn(async () => undefined);
    const { tools, executed } = supportTools(beforeApproval);

    const { approvals } = await runApprovalScenario({
      engine,
      llm: getMock(),
      tools,
      prompt: 'Please refund order #4821, it was $180.',
      stopWhen: stepCountIs(5),
      requireToolApproval: false,
      decision: () => true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [refundCall] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your $180 refund is on its way.' });
      },
    });

    expect(approvals).toEqual(['approve:call-refund']);
    expect(beforeApproval).toHaveBeenCalledTimes(1);
    expect(executed).toEqual(['issueRefund']);
  });

  // Technical: resume data with keys beyond `approved` is forwarded to the tool as
  // `context.agent.resumeData`; a bare `{ approved }` is not (#24561).
  const notes = [
    { label: 'a reviewer note reaches the refund tool', resumeData: { approved: true, note: 'goodwill' } },
    { label: 'a plain approval passes no resume data to the tool', resumeData: { approved: true } },
  ];
  for (const { label, resumeData } of notes) {
    it(`${label} (#24561)`, async () => {
      const { tools, seenResumeData } = supportTools(async () => undefined);
      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), { engine, tools, memory });

      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Please refund order #4821, it was $180.',
        memory,
        threadId: 'thread-24561',
        resourceId: 'customer-4821',
        stopWhen: stepCountIs(5),
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [refundCall] });
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your $180 refund is on its way.' });
        },
      });

      const approval = chunks!.find(c => c.type === 'tool-call-approval');
      expect(approval).toBeDefined();
      const resumed = await shared.agent.resumeStream(resumeData, {
        runId: output.runId,
        toolCallId: (approval as any).payload.toolCallId,
      });
      for await (const _ of resumed.fullStream) {
        // drain
      }

      expect(seenResumeData).toEqual([Object.keys(resumeData).length > 1 ? resumeData : undefined]);
    });
  }

  // Technical: `sendToolApproval({ approved, resumeData })` merges the separate approval decision
  // into custom resume data before forwarding it to the tool (#24561).
  it('a reviewer note sent from the approval UI reaches the refund tool with the decision (#24561)', async () => {
    const { tools, seenResumeData } = supportTools(async () => undefined);
    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), { engine, tools, memory });
    const thread = { threadId: 'thread-ui-approval', resourceId: 'customer-4821' };

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Please refund order #4821, it was $180.',
      memory,
      ...thread,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [refundCall] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your $180 refund is on its way.' });
      },
    });
    expect(chunks!.some(c => c.type === 'tool-call-approval')).toBe(true);

    let finished!: () => void;
    const done = new Promise<void>(resolve => (finished = resolve));
    await shared.agent.sendToolApproval({
      ...thread,
      toolCallId: 'call-refund',
      approved: true,
      resumeData: { note: 'goodwill' },
      streamOptions: { onFinish: () => finished() },
    });
    await done;

    expect(seenResumeData).toEqual([{ approved: true, note: 'goodwill' }]);
  });

  // Technical: a function policy re-evaluated on resume must see the resume call's requestContext,
  // not the one captured when the run first suspended.
  it("a re-checked policy sees the approver's request context, not the original caller's", async () => {
    const { tools } = supportTools();
    const memory = new MockMemory();
    const policy = vi.fn((_ctx: { toolName: string; requestContext?: unknown }) => true);
    const shared = await createSharedAgent(getMock(), { engine, tools, memory });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Please refund order #4821, it was $180.',
      memory,
      threadId: 'thread-tenant',
      resourceId: 'customer-4821',
      stopWhen: stepCountIs(5),
      requireToolApproval: policy,
      requestContext: new RequestContext([['tenantId', 'storefront']]),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [refundCall] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your $180 refund is on its way.' });
      },
    });
    const approval = chunks!.find(c => c.type === 'tool-call-approval');
    expect(approval).toBeDefined();

    policy.mockClear();
    const resumed = await shared.agent.approveToolCall({
      runId: output.runId,
      toolCallId: (approval as any).payload.toolCallId,
      requireToolApproval: policy,
      requestContext: new RequestContext([['tenantId', 'back-office']]),
    } as any);
    for await (const _ of resumed.fullStream) {
      // drain
    }

    // The policy receives the request context as a plain object snapshot.
    expect(policy).toHaveBeenCalledTimes(1);
    expect(policy).toHaveBeenCalledWith(
      expect.objectContaining({ requestContext: expect.objectContaining({ tenantId: 'back-office' }) }),
    );
  });
});
