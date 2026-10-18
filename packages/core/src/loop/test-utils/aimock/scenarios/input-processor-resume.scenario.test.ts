import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { TaskSignalProvider } from '../../../../signals/task-signal-provider';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * A support agent loads the store's refund policy into the prompt with an input processor, then
 * asks a human to approve a refund before issuing it. After the approval, the agent writes the
 * customer's confirmation. That reply must be written under the same policy as the request that
 * asked for approval: if the resumed run drops the processor's system message, the model answers
 * without the policy, and every provider prompt cache is invalidated on every approval because the
 * system prefix changed.
 */

const POLICY_NOTE = 'Store policy: refunds over $100 require manager approval and take 5 business days.';

const storePolicy: Processor = {
  id: 'store-policy',
  processInput: async ({ messageList }) => {
    messageList.addSystem(POLICY_NOTE, 'store-policy');
    return messageList;
  },
};

describeForAllEngines('Support agent refund that waits for human approval', engine => {
  const getMock = useLoopScenarioAimock();

  // Technical: prepare-memory-step skips processInput when `isResume` (#24844). The resumed run
  // must still send the system messages from the run it resumes, restored from the suspended
  // snapshot, so the system prefix (and the provider prompt cache) stays the same across the
  // approval. Uses approveToolCall, the path from the issue report.
  // The issue's exact setup: core's TaskSignalProvider auto-registers TaskStateProcessor, whose
  // task-list instruction is added in processInput. On the plain Agent (normal/fs) that
  // instruction went missing after approval while user input processors survived; durable/evented
  // keep both. Untagged system messages (TaskStateProcessor's) were reset to the pre-resume
  // snapshot captured when the plain loop was built, before the saved message list was restored.
  const cases = [
    { setup: 'store policy processor', withTasks: false },
    { setup: 'store policy processor + TaskSignalProvider', withTasks: true },
  ];
  for (const { setup, withTasks } of cases) {
    it(`the refund confirmation after approval keeps the same system prompt (${setup}, #24844)`, async () => {
      let refunds = 0;
      const issueRefund = createTool({
        id: 'issueRefund',
        description: 'Refund an order.',
        inputSchema: z.object({ orderId: z.string(), amount: z.number() }),
        requireApproval: true,
        execute: async ({ orderId, amount }) => {
          refunds += 1;
          return { orderId, amount, status: 'refunded' };
        },
      });

      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        engine,
        tools: { issueRefund },
        memory,
        inputProcessors: [storePolicy],
        ...(withTasks ? { signals: [new TaskSignalProvider()] } : {}),
      });

      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Please refund order #4821, it was $180.',
        memory,
        threadId: 'thread-24844',
        resourceId: 'customer-4821',
        stopWhen: stepCountIs(5),
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call-refund', name: 'issueRefund', arguments: { orderId: '4821', amount: 180 } }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your $180 refund is on its way.' });
        },
      });

      const approval = chunks!.find(c => c.type === 'tool-call-approval');
      expect(approval).toBeDefined();
      expect(refunds).toBe(0);

      const resumed = await shared.agent.approveToolCall({
        runId: output.runId,
        toolCallId: (approval as any).payload.toolCallId,
      });
      for await (const _ of resumed.fullStream) {
        // drain
      }

      expect(refunds).toBe(1);
      const requests = getMock().getRequests();
      expect(requests).toHaveLength(2);
      const systemPrefix = (i: number) =>
        ((requests[i]!.body as any).messages as { role: string; content: unknown }[]).filter(m => m.role === 'system');
      expect(systemPrefix(0)).toContainEqual({ role: 'system', content: POLICY_NOTE });
      if (withTasks) {
        expect(JSON.stringify(systemPrefix(0))).toContain('<current-task-list');
      }
      expect(systemPrefix(1)).toEqual(systemPrefix(0));
    });
  }
});
