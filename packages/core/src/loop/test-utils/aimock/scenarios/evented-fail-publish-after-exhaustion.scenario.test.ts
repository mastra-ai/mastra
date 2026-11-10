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
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { createTool } from '../../../../tools';
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

    it('stops after 3 workflow.fail publish attempts and leaves the run to crash recovery', async () => {
      await run(0);
      const controlRequests = getMock().getRequests().length;
      getMock().clearRequests();
      const { outcome, flaky } = await run(3);
      // Bounded give-up: the caller gets no result (same as main), but the
      // processor does not keep republishing or rerunning the model step.
      expect(outcome).toBe('HANG');
      expect(flaky.attempts['workflow.fail']).toBe(3);
      // Publish retries must not add model calls beyond a run whose publish succeeds.
      expect(getMock().getRequests().length).toBe(controlRequests);
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(flaky.attempts['workflow.fail']).toBe(3);
      expect(getMock().getRequests().length).toBe(controlRequests);
    });

    it('retries the workflow.fail publish for a throwing stopWhen without calling it again', async () => {
      // A throwing stopWhen is non-redeliverable, so it goes terminal on the
      // first delivery; the first workflow.fail publish for it then throws.
      const flaky = createFlakyPublishPubSub(new EventEmitterPubSub(), { 'workflow.fail': 1 });
      let stopWhenCalls = 0;
      let toolCalls = 0;
      const step = createTool({
        id: 'step',
        description: 'Advance one step.',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }) => {
          toolCalls++;
          return { done: n };
        },
      });

      const scenario = runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Go.',
        tools: { step },
        pubsub: flaky.pubsub,
        expectStreamError: true,
        maxSteps: 10,
        stopWhen: (() => {
          stopWhenCalls++;
          throw new Error('stopWhen exploded');
        }) as any,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call-1', name: 'step', arguments: { n: 1 } }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
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

      expect(result).not.toBe('HANG');
      const { streamError, requests } = result as Awaited<typeof scenario>;
      expect(flaky.rejected['workflow.fail']).toBe(1);
      // Two workflow.fail publishes happen without rejections; the rejected one is retried once.
      expect(flaky.attempts['workflow.fail']).toBe(3);
      expect(stopWhenCalls).toBe(1);
      expect(toolCalls).toBe(1);
      expect(requests).toHaveLength(1);
      expect(streamError).toMatchObject({ message: 'stopWhen exploded' });
    });
  },
  { skip: ['normal', 'durable', 'fs', 'inngest'] },
);
