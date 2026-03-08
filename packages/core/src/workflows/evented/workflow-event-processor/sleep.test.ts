import { describe, expect, it, vi } from 'vitest';
import type { PubSub } from '../../../events';
import type { WorkflowRunState } from '../../types';
import { processWorkflowWaitForEvent } from './sleep';
import type { ProcessorArgs } from '.';

function createMockPubSub(): PubSub {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  } as unknown as PubSub;
}

function createMockWorkflowData(overrides: Partial<ProcessorArgs> = {}): ProcessorArgs {
  return {
    workflow: {
      id: 'test-workflow',
      stepGraph: [{ type: 'step', step: { id: 'wait-step' } }],
    } as any,
    workflowId: 'test-workflow',
    runId: 'run-1',
    executionPath: [0],
    stepResults: {},
    resumeSteps: [],
    prevResult: { status: 'success', output: {}, payload: {}, startedAt: 0, endedAt: 0 },
    requestContext: {},
    activeSteps: {},
    ...overrides,
  };
}

function createMockState(overrides: Partial<WorkflowRunState> = {}): WorkflowRunState {
  return {
    runId: 'run-1',
    status: 'suspended',
    value: {},
    context: {
      'wait-step': { status: 'suspended', payload: {}, startedAt: 0, suspendedAt: 0 },
    },
    serializedStepGraph: [],
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: { 'wait-step': [0] },
    resumeLabels: {},
    waitingPaths: {},
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('processWorkflowWaitForEvent', () => {
  it('resumes the workflow when event name matches and no conditions exist', async () => {
    const pubsub = createMockPubSub();
    const workflowData = createMockWorkflowData();
    const state = createMockState({ waitingPaths: { 'invoice.approved': [0] } });

    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'invoice.approved',
      currentState: state,
    });

    expect(pubsub.publish).toHaveBeenCalledWith(
      'workflows',
      expect.objectContaining({
        type: 'workflow.step.run',
        runId: 'run-1',
      }),
    );
  });

  it('does not resume when event name does not match any waiting path', async () => {
    const pubsub = createMockPubSub();
    const workflowData = createMockWorkflowData();
    const state = createMockState({ waitingPaths: { 'invoice.approved': [0] } });

    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'invoice.rejected',
      currentState: state,
    });

    expect(pubsub.publish).not.toHaveBeenCalled();
  });

  it('resumes when match condition passes', async () => {
    const pubsub = createMockPubSub();
    const workflowData = createMockWorkflowData();
    const state = createMockState({
      waitingPaths: { 'invoice.approved': [0] },
      waitingPathConditions: {
        'invoice.approved': {
          match: 'invoiceId',
          suspendContext: { invoiceId: 'inv-42' },
        },
      },
    });

    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'invoice.approved',
      eventData: { invoiceId: 'inv-42', approvedBy: 'manager' },
      currentState: state,
    });

    expect(pubsub.publish).toHaveBeenCalledWith('workflows', expect.objectContaining({ type: 'workflow.step.run' }));
  });

  it('does not resume when match condition fails', async () => {
    const pubsub = createMockPubSub();
    const workflowData = createMockWorkflowData();
    const state = createMockState({
      waitingPaths: { 'invoice.approved': [0] },
      waitingPathConditions: {
        'invoice.approved': {
          match: 'invoiceId',
          suspendContext: { invoiceId: 'inv-42' },
        },
      },
    });

    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'invoice.approved',
      eventData: { invoiceId: 'inv-99', approvedBy: 'manager' },
      currentState: state,
    });

    expect(pubsub.publish).not.toHaveBeenCalled();
  });

  it('resumes when if condition passes', async () => {
    const pubsub = createMockPubSub();
    const workflowData = createMockWorkflowData();
    const state = createMockState({
      waitingPaths: { 'subscription.created': [0] },
      waitingPathConditions: {
        'subscription.created': {
          if: "event.userId == async.userId && event.plan == 'pro'",
          suspendContext: { userId: 'u-1' },
        },
      },
    });

    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'subscription.created',
      eventData: { userId: 'u-1', plan: 'pro' },
      currentState: state,
    });

    expect(pubsub.publish).toHaveBeenCalledWith('workflows', expect.objectContaining({ type: 'workflow.step.run' }));
  });

  it('does not resume when if condition fails', async () => {
    const pubsub = createMockPubSub();
    const workflowData = createMockWorkflowData();
    const state = createMockState({
      waitingPaths: { 'subscription.created': [0] },
      waitingPathConditions: {
        'subscription.created': {
          if: "event.userId == async.userId && event.plan == 'pro'",
          suspendContext: { userId: 'u-1' },
        },
      },
    });

    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'subscription.created',
      eventData: { userId: 'u-1', plan: 'free' },
      currentState: state,
    });

    expect(pubsub.publish).not.toHaveBeenCalled();
  });

  it('requires both match and if to pass when both are specified', async () => {
    const pubsub = createMockPubSub();
    const workflowData = createMockWorkflowData();
    const condition = {
      match: 'userId',
      if: "event.plan == 'enterprise'",
      suspendContext: { userId: 'u-1' },
    };
    const state = createMockState({
      waitingPaths: { upgrade: [0] },
      waitingPathConditions: { upgrade: condition },
    });

    // match passes, if fails
    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'upgrade',
      eventData: { userId: 'u-1', plan: 'free' },
      currentState: state,
    });
    expect(pubsub.publish).not.toHaveBeenCalled();

    // match fails, if passes
    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'upgrade',
      eventData: { userId: 'u-2', plan: 'enterprise' },
      currentState: state,
    });
    expect(pubsub.publish).not.toHaveBeenCalled();

    // both pass
    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'upgrade',
      eventData: { userId: 'u-1', plan: 'enterprise' },
      currentState: state,
    });
    expect(pubsub.publish).toHaveBeenCalledTimes(1);
  });

  it('passes event data as resumeData to the resumed step', async () => {
    const pubsub = createMockPubSub();
    const workflowData = createMockWorkflowData();
    const state = createMockState({ waitingPaths: { 'task.done': [0] } });
    const eventPayload = { taskId: 't-1', result: 'success' };

    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'task.done',
      eventData: eventPayload,
      currentState: state,
    });

    expect(pubsub.publish).toHaveBeenCalledWith(
      'workflows',
      expect.objectContaining({
        data: expect.objectContaining({
          resumeData: eventPayload,
        }),
      }),
    );
  });

  it('falls back to workflowData.resumeData when no eventData is provided', async () => {
    const pubsub = createMockPubSub();
    const workflowData = createMockWorkflowData({ resumeData: { fallback: true } });
    const state = createMockState({ waitingPaths: { notify: [0] } });

    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'notify',
      currentState: state,
    });

    expect(pubsub.publish).toHaveBeenCalledWith(
      'workflows',
      expect.objectContaining({
        data: expect.objectContaining({
          resumeData: { fallback: true },
        }),
      }),
    );
  });

  it('handles nested match paths across event and suspend context', async () => {
    const pubsub = createMockPubSub();
    const workflowData = createMockWorkflowData();
    const state = createMockState({
      waitingPaths: { 'order.shipped': [0] },
      waitingPathConditions: {
        'order.shipped': {
          match: 'details.orderId',
          suspendContext: { details: { orderId: 'ord-7' } },
        },
      },
    });

    await processWorkflowWaitForEvent(workflowData, {
      pubsub,
      eventName: 'order.shipped',
      eventData: { details: { orderId: 'ord-7' }, carrier: 'fedex' },
      currentState: state,
    });

    expect(pubsub.publish).toHaveBeenCalled();
  });
});
