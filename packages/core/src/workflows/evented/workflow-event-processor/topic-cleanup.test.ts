import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { WorkflowEventProcessor } from './index';

class TestWorkflowEventProcessor extends WorkflowEventProcessor {
  callProcessWorkflowEnd(args: any) {
    return this.processWorkflowEnd(args);
  }
  callProcessWorkflowFail(args: any) {
    return this.processWorkflowFail(args);
  }
  callProcessWorkflowStart(args: any) {
    return this.processWorkflowStart(args);
  }
}

async function persistRunStatus(mastra: Mastra, status: string) {
  const workflowsStore = await mastra.getStorage()!.getStore('workflows');
  await workflowsStore!.persistWorkflowSnapshot({
    workflowName: 'wf',
    runId: 'run-1',
    snapshot: { status, context: {}, activePaths: [], timestamp: Date.now(), value: {}, runId: 'run-1' } as any,
  });
}

function setup(topicCleanupDelayMs?: number) {
  const pubsub = new EventEmitterPubSub();
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: {} as any,
    pubsub,
  });
  const processor = new TestWorkflowEventProcessor({ mastra, topicCleanupDelayMs });
  const clearTopicSpy = vi.spyOn(pubsub, 'clearTopic');
  return { mastra, processor, clearTopicSpy };
}

const baseArgs = {
  workflowId: 'wf',
  runId: 'run-1',
  executionPath: [],
  resumeSteps: [],
  stepResults: {},
  activeStepsPath: {},
  requestContext: {},
  prevResult: { status: 'success' },
};

describe('WorkflowEventProcessor per-run topic cleanup', () => {
  it('clears the workflow.events.v2 topic after a terminal workflow.end', async () => {
    const { mastra, processor, clearTopicSpy } = setup(10);

    await processor.callProcessWorkflowEnd({ ...baseArgs });

    // Deletion is delayed so watchers can drain the terminal event first.
    expect(clearTopicSpy).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(clearTopicSpy).toHaveBeenCalledWith('workflow.events.v2.run-1');
    });

    await mastra.shutdown();
  });

  it('clears the workflow.events.v2 topic after workflow.fail', async () => {
    const { mastra, processor, clearTopicSpy } = setup(10);

    await processor.callProcessWorkflowFail({
      ...baseArgs,
      prevResult: { status: 'failed', error: 'boom' },
    });

    await vi.waitFor(() => {
      expect(clearTopicSpy).toHaveBeenCalledWith('workflow.events.v2.run-1');
    });

    await mastra.shutdown();
  });

  it('does not clear the topic for a per-step (paused) workflow.end', async () => {
    const { mastra, processor, clearTopicSpy } = setup(10);

    await processor.callProcessWorkflowEnd({ ...baseArgs, perStep: true });

    // The run is only paused: it keeps writing to its topic when the next
    // step executes, so cleanup must not be scheduled.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(clearTopicSpy).not.toHaveBeenCalled();

    await mastra.shutdown();
  });

  it('disables topic cleanup when topicCleanupDelayMs is 0', async () => {
    const { mastra, processor, clearTopicSpy } = setup(0);

    await processor.callProcessWorkflowEnd({ ...baseArgs });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(clearTopicSpy).not.toHaveBeenCalled();

    await mastra.shutdown();
  });

  it('skips deletion when the run is active again at fire time (cross-process restart)', async () => {
    const { mastra, processor, clearTopicSpy } = setup(10);

    await processor.callProcessWorkflowEnd({ ...baseArgs });
    // Simulate a timeTravel/restart picked up by a different worker process:
    // the local timer is still pending, but shared storage says the run is
    // executing again.
    await persistRunStatus(mastra, 'running');

    await new Promise(resolve => setTimeout(resolve, 60));
    expect(clearTopicSpy).not.toHaveBeenCalled();

    await mastra.shutdown();
  });

  it('proceeds with deletion when the persisted status is terminal', async () => {
    const { mastra, processor, clearTopicSpy } = setup(10);

    await persistRunStatus(mastra, 'failed');
    await processor.callProcessWorkflowFail({
      ...baseArgs,
      prevResult: { status: 'failed', error: 'boom' },
    });

    await vi.waitFor(() => {
      expect(clearTopicSpy).toHaveBeenCalledWith('workflow.events.v2.run-1');
    });

    await mastra.shutdown();
  });

  it('cancels a pending cleanup when the run restarts in-process', async () => {
    const { mastra, processor, clearTopicSpy } = setup(30);

    await processor.callProcessWorkflowEnd({ ...baseArgs });

    // A timeTravel/restart re-enters through processWorkflowStart with the
    // same runId. The minimal workflow here may make later phases of start
    // throw — the cancellation happens first and is what's under test.
    await processor
      .callProcessWorkflowStart({
        ...baseArgs,
        workflow: { id: 'wf', options: {}, stepGraph: [] },
      })
      .catch(() => {});

    // Force the persisted status terminal so the fire-time status guard would
    // NOT protect the topic. Only the in-process timer cancellation can
    // prevent deletion here — this isolates the layer under test.
    await persistRunStatus(mastra, 'success');

    await new Promise(resolve => setTimeout(resolve, 80));
    expect(clearTopicSpy).not.toHaveBeenCalled();

    await mastra.shutdown();
  });
});
