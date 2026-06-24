/**
 * Invariant: the UnixSocketPubSub local-redelivery budget must be at least as
 * large as the consumer's retry budget.
 *
 * The two constants live in different layers (transport vs. workflow engine)
 * because the transport must not depend on the workflow engine. But they share
 * a hard ordering contract — if the transport stops redelivering before the
 * consumer exhausts its budget, the consumer never sees attempt N and never
 * publishes the terminal `workflow.fail`, leaving the run silently hung.
 *
 * This test reads the consumer constant via reflection so changing either side
 * surfaces as a test failure rather than a runtime hang.
 */
import { describe, expect, it } from 'vitest';
import { WorkflowEventProcessor } from '../workflows/evented/workflow-event-processor';
import { MAX_LOCAL_REDELIVERIES } from './unix-socket-pubsub';

describe('UnixSocketPubSub local-redelivery budget', () => {
  it('is at least as large as WorkflowEventProcessor.MAX_DELIVERY_ATTEMPTS', () => {
    // `MAX_DELIVERY_ATTEMPTS` is `private static readonly` on the consumer.
    // Reflection access is intentional — the goal is to pin the cross-layer
    // ordering, not to expose the consumer constant publicly.
    const consumerBudget = (WorkflowEventProcessor as unknown as { MAX_DELIVERY_ATTEMPTS: number })
      .MAX_DELIVERY_ATTEMPTS;

    expect(typeof consumerBudget).toBe('number');
    expect(consumerBudget).toBeGreaterThan(0);
    expect(MAX_LOCAL_REDELIVERIES).toBeGreaterThanOrEqual(consumerBudget);
  });
});
