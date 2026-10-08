/**
 * Tests for `Mastra.recoverAllDurableAgents()` — the boot-time hook that
 * walks every registered `DurableAgent` and re-drives its orphaned RUNNING
 * runs after a process restart (issue #19056).
 *
 * These are focused unit tests: we stub `DurableAgent.recoverActiveRuns()`
 * on each agent so we can pin down the fan-out contract of the
 * Mastra-level API without spinning up real durable workflows. The
 * per-agent recovery behavior itself is covered by
 * `recover-active-runs.test.ts` and `recover-run.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import type { DurableAgent } from '../agent/durable/durable-agent';
import { InMemoryStore } from '../storage';
import { Mastra } from './index';

function makeBaseAgent(id: string) {
  return new Agent({
    id,
    name: id,
    instructions: 'x',
    model: 'openai/gpt-4o',
  });
}

function makeDurable(id: string): DurableAgent {
  return createDurableAgent({ agent: makeBaseAgent(id) });
}

/**
 * Stub `recoverActiveRuns` on a durable agent so the Mastra-level fan-out
 * is observable without exercising storage or the real workflow.
 */
function stubRecover(
  agent: DurableAgent,
  result:
    | {
        recovered: Array<{ runId: string; status: 'success' | 'failed' | 'skipped'; retryAt?: number }>;
        succeeded: number;
        failed: number;
      }
    | { throw: Error },
) {
  if ('throw' in result) {
    return vi.spyOn(agent, 'recoverActiveRuns').mockRejectedValue(result.throw);
  }
  return vi.spyOn(agent, 'recoverActiveRuns').mockResolvedValue(result);
}

describe('Mastra.recoverAllDurableAgents', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zeroed counts when no durable agents are registered', async () => {
    const plainAgent = makeBaseAgent('plain');
    const mastra = new Mastra({
      agents: { plain: plainAgent },
      storage: store,
    });

    const result = await mastra.recoverAllDurableAgents();

    expect(result).toEqual({ agents: 0, recovered: 0, succeeded: 0, failed: 0, skipped: 0 });
  });

  it('only calls recoverActiveRuns on DurableAgent instances', async () => {
    const durable = makeDurable('durable-a');
    const plainAgent = makeBaseAgent('plain');
    const mastra = new Mastra({
      agents: {
        durableA: durable as any,
        plain: plainAgent,
      },
      storage: store,
    });
    const spy = stubRecover(durable, {
      recovered: [{ runId: 'r-1', status: 'success' }],
      succeeded: 1,
      failed: 0,
    });

    const result = await mastra.recoverAllDurableAgents();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ agents: 1, recovered: 1, succeeded: 1, failed: 0, skipped: 0 });
  });

  it('aggregates counts across every durable agent', async () => {
    const a = makeDurable('durable-a');
    const b = makeDurable('durable-b');
    const mastra = new Mastra({
      agents: { a: a as any, b: b as any },
      storage: store,
    });
    stubRecover(a, {
      recovered: [
        { runId: 'a-1', status: 'success' },
        { runId: 'a-2', status: 'failed' },
      ],
      succeeded: 1,
      failed: 1,
    });
    stubRecover(b, {
      recovered: [{ runId: 'b-1', status: 'success' }],
      succeeded: 1,
      failed: 0,
    });

    const result = await mastra.recoverAllDurableAgents();

    expect(result).toEqual({ agents: 2, recovered: 3, succeeded: 2, failed: 1, skipped: 0 });
  });

  it('does not let a single agent failure abort recovery for the rest', async () => {
    const a = makeDurable('durable-a');
    const b = makeDurable('durable-b');
    const mastra = new Mastra({
      agents: { a: a as any, b: b as any },
      storage: store,
    });
    stubRecover(a, { throw: new Error('boom-a') });
    const bSpy = stubRecover(b, {
      recovered: [{ runId: 'b-1', status: 'success' }],
      succeeded: 1,
      failed: 0,
    });

    const result = await mastra.recoverAllDurableAgents();

    expect(bSpy).toHaveBeenCalledTimes(1);
    // Both agents count as registered — the throwing one just contributes 0.
    expect(result).toEqual({ agents: 2, recovered: 1, succeeded: 1, failed: 0, skipped: 0 });
  });

  it('re-checks a run another instance drives once its claim may have lapsed, until it is no longer skipped', async () => {
    vi.useFakeTimers();
    const durable = makeDurable('durable-a');
    const mastra = new Mastra({ agents: { durableA: durable as any }, storage: store });
    const spy = vi
      .spyOn(durable, 'recoverActiveRuns')
      .mockResolvedValueOnce({
        recovered: [
          { runId: 'live-elsewhere', status: 'skipped', reason: 'run-active', retryAt: Date.now() + 30_000 },
          { runId: 'live-here', status: 'skipped', reason: 'run-active-locally' },
          { runId: 'orphan', status: 'success' },
        ],
        succeeded: 1,
        failed: 0,
      })
      .mockResolvedValueOnce({
        recovered: [{ runId: 'live-elsewhere', status: 'skipped', reason: 'run-active', retryAt: Date.now() + 60_000 }],
        succeeded: 0,
        failed: 0,
      })
      .mockResolvedValueOnce({ recovered: [{ runId: 'live-elsewhere', status: 'success' }], succeeded: 1, failed: 0 });

    const result = await mastra.recoverAllDurableAgents();
    expect(result).toEqual({ agents: 1, recovered: 1, succeeded: 1, failed: 0, skipped: 2 });

    // Not before the holder's claim may have lapsed.
    await vi.advanceTimersByTimeAsync(29_999);
    expect(spy).toHaveBeenCalledTimes(1);
    // Within the jitter after it: only the run another instance drove is re-checked.
    await vi.advanceTimersByTimeAsync(5_001);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith({ runId: 'live-elsewhere' });
    // Still skipped: re-checked again at the new retryAt, then never again.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenLastCalledWith({ runId: 'live-elsewhere' });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('shutdown() cancels pending re-checks', async () => {
    vi.useFakeTimers();
    const durable = makeDurable('durable-a');
    const mastra = new Mastra({ agents: { durableA: durable as any }, storage: store });
    const spy = stubRecover(durable, {
      recovered: [{ runId: 'live-elsewhere', status: 'skipped', retryAt: Date.now() + 30_000 }],
      succeeded: 0,
      failed: 0,
    });

    await mastra.recoverAllDurableAgents();
    await mastra.shutdown();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('exposes the recovery config via recoveryConfig (default off)', () => {
    const mastra = new Mastra({ storage: store });
    expect(mastra.recoveryConfig).toEqual({ durableAgents: 'off' });
  });

  it('reflects an explicit recovery.durableAgents = "auto" config', () => {
    const mastra = new Mastra({
      storage: store,
      recovery: { durableAgents: 'auto' },
    });
    expect(mastra.recoveryConfig).toEqual({ durableAgents: 'auto' });
  });

  it('does not auto-invoke recoverAllDurableAgents on construction', async () => {
    const durable = makeDurable('durable-a');
    const spy = vi.spyOn(durable, 'recoverActiveRuns');

    // Even in 'auto' mode, the boot hook is the deployer's job — construction
    // itself must remain side-effect-free so operators can wire recovery
    // wherever they want (cron, leader election, etc.).
    new Mastra({
      agents: { durableA: durable as any },
      storage: store,
      recovery: { durableAgents: 'auto' },
    });

    // Give any microtasks a chance to flush.
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
  });
});
