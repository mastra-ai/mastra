import { Memory } from '@mastra/memory';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage';
import { AgentController } from '../agent-controller';

async function fixture() {
  const storage = new InMemoryStore();
  const memory = new Memory({ storage });
  const agent = new Agent({
    id: 'scheduled-agent',
    name: 'Scheduled',
    instructions: 'No calls.',
    model: 'openai/gpt-4o',
    memory,
  });
  const otherAgent = new Agent({
    id: 'other-agent',
    name: 'Other',
    instructions: 'No calls.',
    model: 'openai/gpt-4o',
    memory,
  });
  const controller = new AgentController({
    id: 'controller',
    agent,
    memory,
    storage,
    modes: [
      { id: 'chat', name: 'Chat', default: true },
      { id: 'other', name: 'Other', agent: otherAgent },
    ],
  });
  await controller.init();
  await memory.createThread({ threadId: 'result', resourceId: 'owner' });
  const options = {
    resourceId: 'owner',
    threadId: 'result',
    scope: 'thread:result',
    existingThreadOnly: true,
    subscriptionAgent: agent,
  };
  return { controller, agent, otherAgent, memory, options };
}

describe('strict scheduled result Session', () => {
  it.each(['missing', 'different'] as const)(
    'does not reuse an active subscription with a %s owning agent',
    async kind => {
      const { controller, options, agent } = await fixture();
      const session = await controller.createSession(options);
      session.thread.cleanupSubscription();
      const subscription = {
        stream: [],
        activeRunId: () => 'running',
        abort: vi.fn(),
        unsubscribe: vi.fn(),
      };
      session.stream.attach({
        subscription: subscription as never,
        key: `${agent.id}:owner:result`,
        ...(kind === 'different'
          ? {
              agent: new Agent({
                id: agent.id,
                name: 'Different instance',
                instructions: 'No calls.',
                model: 'openai/gpt-4o',
              }),
            }
          : {}),
      });
      await expect(controller.createSession(options)).rejects.toThrow('active Session subscription');
      expect(subscription.unsubscribe).not.toHaveBeenCalled();
      session.thread.cleanupSubscription();
    },
  );

  it('concurrent bindings share one Session and one subscription', async () => {
    const { controller, options } = await fixture();
    const sessions = await Promise.all(Array.from({ length: 8 }, () => controller.createSession(options)));
    expect(new Set(sessions).size).toBe(1);
    expect(sessions[0].thread.getId()).toBe('result');
    expect(sessions[0].stream.isOpen()).toBe(true);
  });

  it.each(['missing', 'foreign', 'wrong-agent'] as const)('rejects %s without creating a replacement', async kind => {
    const { controller, memory, options } = await fixture();
    if (kind === 'foreign') await memory.createThread({ threadId: 'foreign', resourceId: 'other-owner' });
    const altered =
      kind === 'wrong-agent'
        ? {
            ...options,
            subscriptionAgent: new Agent({
              id: 'other',
              name: 'Other',
              instructions: 'No calls.',
              model: 'openai/gpt-4o',
            }),
          }
        : { ...options, threadId: kind };
    await expect(controller.createSession(altered)).rejects.toThrow();
    expect(await memory.getThreadById({ threadId: 'missing' })).toBeNull();
    expect((await memory.getThreadById({ threadId: 'result' }))?.resourceId).toBe('owner');
  });

  it('rejects a cached Session switched to another thread', async () => {
    const { controller, options } = await fixture();
    const session = await controller.createSession(options);
    await session.thread.create({ id: 'other' });
    await expect(controller.createSession(options)).rejects.toThrow('another thread');
    expect(session.thread.getId()).toBe('other');
  });

  it('rejects a deleted result thread even when its Session is cached', async () => {
    const { controller, options, memory } = await fixture();
    await controller.createSession(options);
    await memory.deleteThread('result');
    await expect(controller.createSession(options)).rejects.toThrow();
    expect(await memory.getThreadById({ threadId: 'result' })).toBeNull();
  });

  it('keeps saved denials after fresh Session state and does not mutate chat settings', async () => {
    const { controller, options } = await fixture();
    const session = await controller.createSession(options);
    session.setCategoryResolver(() => 'execute');
    await session.state.set({ yolo: true });
    const before = structuredClone(session.state.get());
    const saved = {
      controllerId: controller.id,
      scope: options.scope,
      agentId: options.subscriptionAgent.id,
      threadId: options.threadId,
      resourceId: options.resourceId,
      deniedTools: ['blocked'],
      deniedCategories: [],
    };
    expect(session.resolveToolApproval('blocked', 'auto', saved)).toBe('deny');
    expect(session.resolveToolApproval('allowed', 'auto', saved)).toBe('allow');
    expect(session.resolveToolApproval('allowed', 'manual', saved)).toBe('ask');
    expect(session.resolveToolApproval('blocked')).toBe('allow');
    expect(session.state.get()).toEqual(before);
    expect(session.resolveToolApproval('any', 'auto', { ...saved, deniedCategories: ['execute'] })).toBe('deny');
  });

  it.each(['stop', 'thread', 'resource', 'mode', 'deny'] as const)(
    'handles %s while approval preparation is waiting',
    async action => {
      const { controller, options, agent, otherAgent } = await fixture();
      const session = await controller.createSession(options);
      session.run.setRunId({ runId: 'run' });
      const decision = vi
        .spyOn(agent, 'sendToolApproval')
        .mockResolvedValue({ accepted: true, runId: 'run', toolCallId: 'call' });
      const wrongAgent = vi
        .spyOn(otherAgent, 'sendToolApproval')
        .mockResolvedValue({ accepted: true, runId: 'run', toolCallId: 'call' });
      let release!: () => void;
      let entered!: () => void;
      const waiting = new Promise<void>(resolve => {
        entered = resolve;
      });
      const barrier = new Promise<void>(resolve => {
        release = resolve;
      });
      vi.spyOn(session.machinery, 'buildToolsets').mockImplementation(async () => {
        entered();
        await barrier;
        return {};
      });
      const result = session
        .approveToolCall({ toolCallId: 'call', toolName: 'fixture', toolApprovalPolicy: 'manual' })
        .catch(error => error);
      await waiting;
      if (action === 'stop') session.abort();
      if (action === 'thread') session.thread.set({ threadId: 'different' });
      if (action === 'resource') session.identity.setResourceId({ resourceId: 'different' });
      if (action === 'mode') await session.mode.switch({ modeId: 'other' });
      if (action === 'deny') await session.permissions.setForTool({ toolName: 'fixture', policy: 'deny' });
      release();
      await result;
      expect(wrongAgent).not.toHaveBeenCalled();
      if (action === 'mode')
        expect(decision).toHaveBeenCalledWith(
          expect.objectContaining({ approved: true, threadId: 'result', resourceId: 'owner' }),
        );
      else expect(decision.mock.calls.every(([request]) => request.approved === false)).toBe(true);
    },
  );
});
