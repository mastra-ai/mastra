import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

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

describe('EventedAgent.executeWorkflow terminal error emission', () => {
  it('logs instead of rejecting when the run rejects and the pubsub refuses the publish', async () => {
    // executeWorkflow() fires the run without awaiting it and routes a rejected
    // run through emitErrorInBackground() in its `.catch`. A publish failure
    // during shutdown must not become an unhandledRejection (#24071).
    const pubsub = new EventEmitterPubSub();
    vi.spyOn(pubsub, 'publish').mockRejectedValue(new Error('cannot publish on closed client'));
    const warn = vi.fn();
    const baseAgent = new Agent({
      id: 'evented-emit-error-agent',
      name: 'Evented Emit Error Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2() as any,
    });
    const eventedAgent = createEventedAgent({ agent: baseAgent, pubsub });
    vi.spyOn(eventedAgent as any, 'logger', 'get').mockReturnValue({ warn });
    // Drive the fire-and-forget run so start() rejects, exercising the `.catch`
    // handler that this fix routes through emitErrorInBackground().
    vi.spyOn(eventedAgent as any, 'getWorkflow').mockReturnValue({
      createRun: async () => ({
        start: () => Promise.reject(new Error('run failed')),
      }),
    });

    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      await (eventedAgent as any).executeWorkflow('run-1', {});
      await new Promise(r => setTimeout(r, 10));
    } finally {
      process.off('unhandledRejection', unhandled);
    }

    expect(unhandled).not.toHaveBeenCalled();
    // Scope to the publish-failure warning: this hostless EventedAgent also
    // (correctly) warns about falling back to the default in-process engine.
    const publishWarnings = warn.mock.calls.filter((c: any[]) =>
      String(c[0]).includes('Failed to publish error event'),
    );
    expect(publishWarnings).toHaveLength(1);
  });
});
