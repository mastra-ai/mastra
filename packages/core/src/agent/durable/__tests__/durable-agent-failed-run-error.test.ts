/**
 * A workflow-level failure the loop itself didn't catch resolves `run.start()`
 * with `status: 'failed'` — it does NOT reject. Both engines must map that
 * terminal status to an ERROR event on the agent-stream topic, otherwise the
 * caller's stream never terminates: no chunk was ever published, so the
 * consumer just hangs (#17727's idle-start gap, ported to the durable
 * transport in Phase 2 Item 5).
 *
 * DurableAgent handled this in executeWorkflow from the start; EventedAgent's
 * fire-and-forget `.then` only cleaned up snapshots. This pins both.
 */

import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { DurableAgent } from '../durable-agent';
import { EventedAgent } from '../evented-agent';

describe('durable workflow failed-status error surfacing', () => {
  it.each([
    ['DurableAgent', DurableAgent],
    ['EventedAgent', EventedAgent],
  ] as const)('%s publishes an ERROR stream event when the run resolves with status failed', async (_, AgentType) => {
    const pubsub = new EventEmitterPubSub();
    const baseAgent = new Agent({
      id: 'failed-run-agent',
      name: 'failed-run-agent',
      instructions: 'test',
      model: { provider: 'test', modelId: 'test', specificationVersion: 'v1' } as any,
    });
    const agent = new AgentType({ agent: baseAgent, pubsub });
    vi.spyOn(agent, 'getWorkflow').mockReturnValue({
      createRun: vi.fn().mockResolvedValue({
        start: vi.fn().mockResolvedValue({ status: 'failed', error: { message: 'preparation exploded' } }),
      }),
      deleteWorkflowRunById: vi.fn().mockResolvedValue(undefined),
    } as any);

    const runId = 'failed-status-run';
    const received: any[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      received.push(event);
    });

    try {
      await (agent as any).executeWorkflow(runId, {} as any);
      // EventedAgent's start is fire-and-forget, so the ERROR event lands
      // after executeWorkflow returns.
      await vi.waitFor(() => {
        expect(received.some(event => event.type === AgentStreamEventTypes.ERROR)).toBe(true);
      });
      const errorEvent = received.find(event => event.type === AgentStreamEventTypes.ERROR);
      expect(errorEvent.data.error.message).toBe('preparation exploded');
    } finally {
      await pubsub.close();
    }
  });
});
