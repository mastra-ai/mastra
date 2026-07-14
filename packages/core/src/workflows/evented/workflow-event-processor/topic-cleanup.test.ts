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
});
