import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { WorkflowEventProcessor } from './index';

class TestWorkflowEventProcessor extends WorkflowEventProcessor {
  finish(args: any, status: 'success' | 'failed' | 'suspended') {
    if (status === 'failed') return this.processWorkflowFail(args);
    if (status === 'suspended') return this.processWorkflowSuspend(args);
    return this.processWorkflowEnd(args);
  }
}

describe('evented finish payloads (COR-1454)', () => {
  it.each(['success', 'failed', 'suspended'] as const)(
    'does not serialize parent run history or execution bookkeeping on %s',
    async status => {
      const pubsub = new EventEmitterPubSub();
      const mastra = new Mastra({ logger: false, pubsub });
      const processor = new TestWorkflowEventProcessor({ mastra });
      const events: Event[] = [];
      await pubsub.subscribe('workflows-finish', async event => {
        events.push(event);
      });
      const stepResults = { child: { status, output: { answer: 42 } } };
      const requestContext = { executionClaim: 'claim-1' };
      const state = { count: 3 };
      const prevResult = { status, output: { answer: 42 }, error: status === 'failed' ? 'failure' : undefined };
      try {
        for (const size of [1024, 4 * 1024 * 1024]) {
          const history = 'x'.repeat(size);
          await processor.finish(
            {
              workflowId: 'child',
              runId: 'child-run',
              workflow: { options: { shouldPersistSnapshot: () => false }, stepGraph: [] },
              executionPath: [],
              resumeSteps: [],
              activeStepsPath: {},
              stepResults,
              prevResult,
              requestContext,
              state,
              parentContext: { history },
              resumeData: { history },
              parentWorkflow: {
                workflowId: 'parent',
                runId: 'parent-run',
                stepId: 'nested',
                stepGraph: [],
                executionPath: [],
                stepResults: { history },
                activeStepsPath: {},
                resumeSteps: [],
                parentWorkflow: { workflowId: 'root', runId: 'root-run', stepResults: { history } },
              },
            },
            status,
          );
        }
        expect(events).toHaveLength(2);
        expect(Buffer.byteLength(JSON.stringify(events[1]!.data))).toBeLessThan(2048);
        expect(JSON.stringify(events[1]!.data)).toBe(JSON.stringify(events[0]!.data));
        expect(events[1]!.data).toEqual({
          workflowId: 'child',
          runId: 'child-run',
          stepResults,
          prevResult,
          requestContext,
          state,
          parentWorkflow: {
            workflowId: 'parent',
            runId: 'parent-run',
            parentWorkflow: { workflowId: 'root', runId: 'root-run' },
          },
        });
      } finally {
        await mastra.shutdown();
      }
    },
  );
});
