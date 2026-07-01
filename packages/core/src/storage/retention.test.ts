import { describe, it, expect, vi } from 'vitest';
import { MastraCompositeStore } from './base';
import type { StorageDomains } from './base';
import type { PruneOptions, PruneResult, TableRetentionPolicy } from './retention';

/**
 * Composite-level orchestration tests for `prune()`.
 *
 * These exercise the domain-agnostic wiring in MastraCompositeStore using mock
 * domains: policy routing, unset = keep forever, and cooperative abort. The
 * physical batched-delete behavior is covered by the LibSQL reference
 * implementation's own tests.
 */

type PruneCall = { policies: Record<string, TableRetentionPolicy>; options?: PruneOptions };

function makePruneDomain(results: PruneResult[]) {
  const calls: PruneCall[] = [];
  const prune = vi.fn(async (policies: Record<string, TableRetentionPolicy>, options?: PruneOptions) => {
    calls.push({ policies, options });
    return results;
  });
  return { prune, calls };
}

/**
 * Builds a composite with injected `stores` and `retention` without needing a
 * full adapter. `retention` is protected on the base, so a tiny subclass sets it.
 */
class TestComposite extends MastraCompositeStore {
  constructor(id: string, stores: Partial<StorageDomains>, retention: unknown) {
    super({ id });
    this.stores = stores as StorageDomains;
    // @ts-expect-error protected field set for test injection
    this.retention = retention;
  }
}

describe('MastraCompositeStore.prune()', () => {
  it('returns [] and prunes nothing when no retention is configured', async () => {
    const memory = makePruneDomain([]);
    const composite = new TestComposite('c1', { memory: memory as any }, undefined);

    const results = await composite.prune();

    expect(results).toEqual([]);
    expect(memory.prune).not.toHaveBeenCalled();
  });

  it('routes each domain its own table policies and aggregates results', async () => {
    const memoryResult: PruneResult = {
      domain: 'memory',
      table: 'mastra_messages',
      deleted: 5,
      done: true,
    };
    const obsResult: PruneResult = {
      domain: 'observability',
      table: 'mastra_ai_spans',
      deleted: 2,
      done: true,
    };
    const memory = makePruneDomain([memoryResult]);
    const observability = makePruneDomain([obsResult]);

    const composite = new TestComposite(
      'c2',
      { memory: memory as any, observability: observability as any },
      {
        memory: { messages: { maxAge: '30d' } },
        observability: { spans: { maxAge: '7d' } },
      },
    );

    const results = await composite.prune();

    expect(results).toEqual([memoryResult, obsResult]);
    expect(memory.calls[0]!.policies).toEqual({ messages: { maxAge: '30d' } });
    expect(observability.calls[0]!.policies).toEqual({ spans: { maxAge: '7d' } });
  });

  it('skips domains that are configured in retention but absent from stores', async () => {
    const observability = makePruneDomain([]);
    const composite = new TestComposite(
      'c3',
      { observability: observability as any },
      {
        memory: { messages: { maxAge: '30d' } }, // no memory domain wired
        observability: { spans: { maxAge: '7d' } },
      },
    );

    const results = await composite.prune();

    expect(results).toEqual([]);
    expect(observability.prune).toHaveBeenCalledTimes(1);
  });

  it('skips domains whose policy map is empty', async () => {
    const memory = makePruneDomain([]);
    const composite = new TestComposite('c4', { memory: memory as any }, { memory: {} });

    await composite.prune();

    expect(memory.prune).not.toHaveBeenCalled();
  });

  it('short-circuits before invoking any domain when the signal is already aborted', async () => {
    const memory = makePruneDomain([]);
    const composite = new TestComposite(
      'c5',
      { memory: memory as any },
      {
        memory: { messages: { maxAge: '30d' } },
      },
    );

    const controller = new AbortController();
    controller.abort();

    const results = await composite.prune({ signal: controller.signal });

    expect(results).toEqual([]);
    expect(memory.prune).not.toHaveBeenCalled();
  });

  it('forwards prune options through to the domain', async () => {
    const memory = makePruneDomain([]);
    const composite = new TestComposite(
      'c6',
      { memory: memory as any },
      {
        memory: { messages: { maxAge: '30d' } },
      },
    );

    const options: PruneOptions = { maxRows: 100, maxBatches: 2, pauseMs: 10 };
    await composite.prune(options);

    expect(memory.calls[0]!.options).toBe(options);
  });
});
