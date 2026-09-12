import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

describe('DurableAgent background error emission', () => {
  it('logs instead of rejecting when the pubsub refuses the publish', async () => {
    // Fire-and-forget call sites use this helper, so a publish failure during
    // shutdown must not become an unhandledRejection.
    const pubsub = new EventEmitterPubSub();
    vi.spyOn(pubsub, 'publish').mockRejectedValue(new Error('cannot publish on closed client'));
    const warn = vi.fn();
    const baseAgent = new Agent({
      id: 'emit-error-agent',
      name: 'Emit Error Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2() as any,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    vi.spyOn(durableAgent as any, 'logger', 'get').mockReturnValue({ warn });

    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      (durableAgent as any).emitErrorInBackground('run-1', new Error('step failed'));
      await new Promise(r => setTimeout(r, 10));
    } finally {
      process.off('unhandledRejection', unhandled);
    }

    expect(unhandled).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });
});
