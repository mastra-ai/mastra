import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockLanguageModelV3 } from 'ai/test';
import { simulateReadableStream } from 'ai';
import { Memory } from '@mastra/memory';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';

describe.each([
  { durable: false, existingSession: false },
  { durable: false, existingSession: true },
  { durable: true, existingSession: false },
  { durable: true, existingSession: true },
])('scheduled approval durable=$durable existingSession=$existingSession', ({ durable, existingSession }) => {
  it.each(['approve', 'decline', 'automatic'] as const)(
    'preserves %s across two tool calls',
    async decision => {
      const storage = new InMemoryStore({ id: 'schedule-approval' });
      const memory = new Memory({ storage });
      let effects = 0;
      let modelCalls = 0;
      const usage = {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      };
      const model = new MockLanguageModelV3({
        doStream: async () => {
          modelCalls++;
          return {
            stream: simulateReadableStream({
              chunks:
                modelCalls <= 2
                  ? [
                      {
                        type: 'tool-call' as const,
                        toolCallType: 'function' as const,
                        toolCallId: `scheduled-action-${modelCalls}`,
                        toolName: 'proof_action',
                        input: '{}',
                        providerExecuted: false,
                      },
                      {
                        type: 'finish' as const,
                        finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' },
                        usage,
                      },
                    ]
                  : [
                      { type: 'text-start' as const, id: 'done' },
                      { type: 'text-delta' as const, id: 'done', delta: 'Completed.' },
                      { type: 'text-end' as const, id: 'done' },
                      { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: 'stop' }, usage },
                    ],
            }),
          };
        },
      });
      const baseAgent = new Agent({
        id: 'approval-agent',
        name: 'Approval proof',
        instructions: 'Use the action.',
        model,
        memory,
        tools: {
          proof_action: createTool({
            id: 'proof_action',
            description: 'Count an approved action.',
            inputSchema: z.object({}),
            execute: async () => ({ count: ++effects }),
          }),
        },
        defaultOptions: { maxSteps: 4 },
      });
      const agent = durable ? (createDurableAgent({ agent: baseAgent }) as unknown as Agent) : baseAgent;
      const controller = new AgentController({
        id: 'approval-controller',
        agent,
        storage,
        memory,
        modes: [{ id: 'chat', name: 'Chat', metadata: { default: true } }],
        disableBuiltinTools: [
          'ask_user',
          'submit_plan',
          'task_write',
          'task_update',
          'task_complete',
          'task_check',
          'subagent',
        ],
      });
      const mastra = new Mastra({ storage, agents: { proof: agent }, agentControllers: { proof: controller } });
      try {
        await controller.init();
        const thread = await memory.createThread({ resourceId: 'approval-user', title: 'Approval test' });
        if (existingSession) {
          const session = await controller.createSession({
            resourceId: 'approval-user',
            threadId: thread.id,
            ownerId: controller.id,
          });
          await session.state.set({ yolo: true });
        }
        const schedule = await mastra.schedules.create({
          agentId: agent.id,
          resourceId: 'approval-user',
          threadId: thread.id,
          name: 'Approval proof',
          prompt: 'Use proof_action.',
          cron: '0 9 * * *',
          timezone: 'Asia/Riyadh',
          status: 'paused',
          ifIdle: { behavior: 'wake', streamOptions: decision === 'automatic' ? {} : { toolApprovalPolicy: 'manual' } },
        });
        await mastra.startWorkers();
        await mastra.schedules.run(schedule.id);
        if (decision === 'automatic') {
          await expect.poll(() => effects, { timeout: 10000 }).toBe(2);
          await expect.poll(() => modelCalls, { timeout: 10000 }).toBe(3);
          return;
        }
        await expect.poll(() => modelCalls, { timeout: 10000 }).toBe(1);
        await expect
          .poll(
            async () =>
              (await agent.listSuspendedRuns({ threadId: thread.id, resourceId: 'approval-user' })).runs.length,
            { timeout: 10000 },
          )
          .toBe(1);
        expect(effects).toBe(0);
        const session = await controller.createSession({
          resourceId: 'approval-user',
          threadId: thread.id,
          ownerId: controller.id,
        });
        for (let step = 1; step <= 2; step++) {
          const toolCallId = `scheduled-action-${step}`;
          await expect
            .poll(() => session.displayState.get().pendingApproval, { timeout: 5000 })
            .toMatchObject({ toolCallId });
          expect(effects).toBe(decision === 'approve' ? step - 1 : 0);
          session.respondToToolApproval({ decision, toolCallId });
        }
        await expect.poll(() => modelCalls, { timeout: 10000 }).toBe(3);
        await expect.poll(() => session.run.isRunning(), { timeout: 10000 }).toBe(false);
        expect(effects).toBe(decision === 'approve' ? 2 : 0);
        expect(session.displayState.get().pendingApproval).toBeNull();
      } finally {
        await mastra.shutdown();
      }
    },
    30000,
  );
});

describe('manual run approval precedence', () => {
  async function createPolicySession() {
    const storage = new InMemoryStore();
    const controller = new AgentController({
      id: 'policy-controller',
      storage,
      agent: new Agent({ name: 'Policy test', instructions: 'No model calls.', model: 'openai/gpt-4o' }),
      modes: [{ id: 'chat', name: 'Chat', metadata: { default: true } }],
    });
    await controller.init();
    return controller.createSession({ resourceId: 'policy-user', id: 'policy-session', ownerId: controller.id });
  }
  it.each(['yolo', 'tool-policy', 'category-policy', 'tool-grant', 'category-grant'] as const)(
    'requires a decision despite %s allowance',
    async allowance => {
      const session = await createPolicySession();
      session.setCategoryResolver(() => 'execute');
      if (allowance === 'yolo') await session.state.set({ yolo: true });
      if (allowance === 'tool-policy') await session.permissions.setForTool({ toolName: 'action', policy: 'allow' });
      if (allowance === 'category-policy')
        await session.permissions.setForCategory({ category: 'execute', policy: 'allow' });
      if (allowance === 'tool-grant') session.grantTool('action');
      if (allowance === 'category-grant') session.grantCategory('execute');
      expect(session.resolveToolApproval('action')).toBe('allow');
      expect(session.resolveToolApproval('action', 'manual')).toBe('ask');
    },
  );

  it.each(['tool', 'category'] as const)('preserves an explicit %s deny', async kind => {
    const session = await createPolicySession();
    session.setCategoryResolver(() => 'execute');
    await session.state.set({ yolo: true });
    if (kind === 'tool') await session.permissions.setForTool({ toolName: 'action', policy: 'deny' });
    else await session.permissions.setForCategory({ category: 'execute', policy: 'deny' });
    expect(session.resolveToolApproval('action', 'manual')).toBe('deny');
  });

  it('leaves legacy yolo and per-tool precedence unchanged without a run policy', async () => {
    const session = await createPolicySession();
    session.setCategoryResolver(() => 'execute');
    await session.permissions.setForCategory({ category: 'execute', policy: 'deny' });
    await session.state.set({ yolo: true });
    expect(session.resolveToolApproval('action')).toBe('allow');
    await session.state.set({ yolo: false });
    await session.permissions.setForTool({ toolName: 'action', policy: 'allow' });
    expect(session.resolveToolApproval('action')).toBe('allow');
  });
});
