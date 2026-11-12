/**
 * A sleep is woken by a timer in the process that started it, so it used to be
 * lost when that process stopped (#30012). Its wake time is stored now, and a
 * restart of the run, from any instance, wakes it when that time comes.
 *
 * Replicas are separate Mastra instances, each with its own pubsub, sharing
 * one store the way pods share one database. Leases use a short TTL here, read
 * when core loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import { InMemoryStore } from '../../storage/mock';
import { runLivenessKey } from './leases';
import {
  Num,
  crash,
  interceptWorkflowEvents,
  isStepRunAt,
  observe,
  runStatus,
  scanning,
  sleepStatuses,
  sleepingFor,
  sleepingRunId,
  startInBackground,
  startReplica,
  stopReplicas,
  work,
} from './test-utils/lease-replicas';
import type { Built } from './test-utils/lease-replicas';
import { createStep, createWorkflow } from '.';

afterEach(stopReplicas);

describe('recovery of evented runs in a sleep (#30012)', () => {
  it('keeps the state a sleep duration function set when another replica wakes the run', async () => {
    const storage = new InMemoryStore();
    const seen: Record<string, unknown> = {};
    const build = () =>
      createWorkflow({
        id: 'leased',
        inputSchema: Num,
        outputSchema: z.any(),
        stateSchema: z.object({ scheduled: z.boolean().optional() }),
      })
        .then(work('before', async () => {}))
        .sleep(async ({ setState }) => {
          await setState({ scheduled: true });
          return 300;
        })
        .then(
          createStep({
            id: 'after',
            inputSchema: z.any(),
            outputSchema: z.any(),
            stateSchema: z.object({ scheduled: z.boolean().optional() }),
            execute: async ({ inputData, state }) => {
              seen.state = state;
              return inputData;
            },
          }),
        )
        .commit() as unknown as Built;
    // Each delivery gets its own copy of the event, as from a broker. An in-process pubsub hands on
    // the objects the in-memory store keeps, so a state change there would reach the store unwritten.
    const brokered = () =>
      new Proxy(new EventEmitterPubSub(), {
        get(target, prop) {
          if (prop === 'publish') {
            return (topic: string, event: Event, options?: { localOnly?: boolean }) =>
              target.publish(topic, JSON.parse(JSON.stringify(event)), options);
          }

          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }) as PubSub;
    const a = await startReplica(storage, build(), { pubsub: brokered() });
    await startReplica(storage, build(), { pubsub: brokered(), recovery: scanning });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await sleepingRunId(storage, run.runId);

    // The duration function ran on A only; B resumes the stored sleep without calling it again.
    await crash(a, storage, [runLivenessKey(run.runId)]);

    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 10_000 });
    expect(seen.state).toMatchObject({ scheduled: true });
  }, 20_000);

  it('restart() continues a run whose sleep woke but whose next step event was lost, under any sleep id', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    const lost = Promise.withResolvers<void>();
    const pubsubA = interceptWorkflowEvents(new EventEmitterPubSub(), event =>
      isStepRunAt(event, [2]) ? { divert: () => lost.resolve() } : undefined,
    );
    const a = await startReplica(storage, sleepingFor(300)(seen.reporter('A')), { pubsub: pubsubA });
    const b = await startReplica(storage, sleepingFor(300)(seen.reporter('B')), { recovery: { workflows: 'off' } });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await lost.promise;
    await crash(a, storage, [runLivenessKey(run.runId)]);

    const result = await (await b.workflow.createRun({ runId: run.runId })).restart();

    expect(result.status).toBe('success');
    expect(seen.executions).toEqual(['A:before', 'B:after']);
    expect(sleepStatuses(result.steps)).toEqual(['success']);
  }, 20_000);

  it('wakes a sleep again from another instance when publishing the step after it failed', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    let rejected = false;
    const pubsubA = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (rejected || !isStepRunAt(event, [2])) {
        return undefined;
      }

      rejected = true;
      return { reject: new Error('broker unavailable') };
    });
    const a = await startReplica(storage, sleepingFor(300)(seen.reporter('A')), { pubsub: pubsubA });
    await startReplica(storage, sleepingFor(300)(seen.reporter('B')), { recovery: scanning });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });

    // The failed wake puts the sleep back to waiting, and B's recovery loop restarts the run.
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 10_000 });
    expect(rejected).toBe(true);
    expect(seen.executions).toEqual(['A:before', 'B:after']);
  }, 20_000);
});
