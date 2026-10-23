/**
 * AIMock Scenario: workflow.fail publish fails after retry exhaustion
 *
 * When an event exhausts its delivery budget the evented workflow processor
 * publishes `workflow.fail`. If that publish throws, the failure must still
 * reach the caller on a later redelivery; otherwise `agent.stream()` never
 * finishes.
 *
 * Only the evented engine runs this: it is the only variant whose loop is
 * driven by the evented workflow processor over `mastra.pubsub`. The normal
 * and fs variants run the loop in-process, and durable runs on the default
 * execution engine, so none of them publish `workflow.step.end` /
 * `workflow.fail` through a PubSub that this scenario can make fail.
 */

import { it, expect } from 'vitest';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { createFlakyPublishPubSub } from '../../../../workflows/evented/test-utils/flaky-publish-pubsub';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

const HANG_MS = 8000;

describeForAllEngines(
  'AIMock loop scenario: evented workflow.fail publish fails after retry exhaustion',
  engine => {
    const getMock = useLoopScenarioAimock();

    async function run(failPublishRejections: number) {
      // Every step-end publish of the first step throws until the event's
      // delivery budget (3 attempts) is spent, then workflow.fail is rejected
      // `failPublishRejections` times.
      const flaky = createFlakyPublishPubSub(new EventEmitterPubSub(), {
        'workflow.step.end': 3,
        'workflow.fail': failPublishRejections,
      });

      const scenario = runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Say hello.',
        pubsub: flaky.pubsub,
        expectStreamError: true,
        fixtures: llm => {
          llm.onMessage(/.*/, { content: 'hello' });
        },
      });

      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        scenario,
        new Promise<'HANG'>(resolve => {
          timer = setTimeout(() => resolve('HANG'), HANG_MS);
        }),
      ]);
      clearTimeout(timer);
      if (result === 'HANG') return { outcome: 'HANG', flaky };
      // The failed step reaches the caller as a rejected stream / finishReason.
      const outcome = await (result as any).output.finishReason.then(
        (reason: string) => `finish:${reason}`,
        (error: Error) => `error:${error.message}`,
      );
      return { outcome, flaky };
    }

    it('control: the run ends with an error when workflow.fail publishes', async () => {
      const { outcome, flaky } = await run(0);
      expect(flaky.rejected['workflow.step.end']).toBe(3);
      expect(outcome).toBe('error:injected publish failure for workflow.step.end');
    });

    it('the run ends with an error when the first workflow.fail publish throws', async () => {
      const { outcome, flaky } = await run(1);
      expect(flaky.rejected['workflow.fail']).toBe(1);
      expect(outcome).toBe('error:injected publish failure for workflow.step.end');
    });
  },
  { skip: ['normal', 'durable', 'fs', 'inngest'] },
);
