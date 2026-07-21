import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { DurableAgent } from '../durable-agent';
import { EventedAgent } from '../evented-agent';

describe('durable workflow actor forwarding', () => {
  it.each([
    ['DurableAgent', DurableAgent, 'start'],
    ['EventedAgent', EventedAgent, 'startAsync'],
  ] as const)('%s forwards the initial actor', async (_, AgentType, startMethod) => {
    const pubsub = new EventEmitterPubSub();
    const actor = { actorKind: 'system' as const, sourceWorkflow: 'initial-run' };
    const baseAgent = new Agent({
      id: 'actor-test-agent',
      name: 'actor-test-agent',
      instructions: 'test',
      model: { provider: 'test', modelId: 'test', specificationVersion: 'v1' } as any,
    });
    const durableAgent = new AgentType({ agent: baseAgent, pubsub });
    const start = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(durableAgent, 'getWorkflow').mockReturnValue({
      createRun: vi.fn().mockResolvedValue({ [startMethod]: start }),
    } as any);

    try {
      await (durableAgent as any).executeWorkflow('actor-test-run', { options: { actor } });
      expect(start).toHaveBeenCalledWith(expect.objectContaining({ actor }));
    } finally {
      await pubsub.close();
    }
  });
});
