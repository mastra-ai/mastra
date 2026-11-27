import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Lets a test act while the runner is computing a flush digest. */
const digestHook = vi.hoisted(() => ({ before: undefined as undefined | (() => Promise<void>) }));
vi.mock('../host', async importOriginal => {
  const actual = await importOriginal<typeof import('../host')>();
  return {
    ...actual,
    knowledgeImporterFlushDigest: async (flush: Parameters<typeof actual.knowledgeImporterFlushDigest>[0]) => {
      const before = digestHook.before;
      digestHook.before = undefined;
      await before?.();
      return actual.knowledgeImporterFlushDigest(flush);
    },
  };
});

import { KnowledgeImporter, KnowledgeImporterHostError, KnowledgeImporterSourceError } from '../define';
import type { KnowledgeImporterContext } from '../define';
import { KnowledgeImporterHostConflictError, knowledgeImporterFlushDigest } from '../host';
import type { KnowledgeImporterHost, KnowledgeImporterRunBinding } from '../host';
import { runKnowledgeImport } from '../runner';
import type {
  KnowledgeImporterFinishRequest,
  KnowledgeImporterFlush,
  KnowledgeImporterFlushReceipt,
  KnowledgeImporterRunReceipt,
} from '../types';

const binding: KnowledgeImporterRunBinding = {
  id: 'b1',
  importer: 'cal',
  target: 'org:acme#cal',
  settings: {},
  credentials: {},
};

/** A host that keeps the O1 rules in memory, with knobs to fail the way a remote host can. */
class RecordingHost implements KnowledgeImporterHost {
  flushes: KnowledgeImporterFlush[] = [];
  attempts: KnowledgeImporterFlush[] = [];
  finish?: KnowledgeImporterFinishRequest;
  finishAttempts = 0;
  finishFailures: Error[] = [];
  state: Record<string, string> = {};
  cancel = false;
  heartbeats = 0;
  /** Fail the next n flush attempts with this, before or after committing. */
  failures: Array<{ error: Error; afterCommit?: boolean }> = [];

  /** Sent with a started run as the host's flush limit. */
  maxFlushBytes?: unknown;
  /** startRun never answers: a hung host. */
  hangStart = false;
  startCalls = 0;
  /** heartbeat never answers. */
  hangHeartbeats = false;
  heartbeatTimes: number[] = [];

  async startRun() {
    this.startCalls++;
    if (this.hangStart) return new Promise<never>(() => {});
    return {
      status: 'started' as const,
      runId: 'run-1',
      generation: 1,
      state: { ...this.state },
      lastSeq: 0,
      binding,
      ...(this.maxFlushBytes !== undefined && { maxFlushBytes: this.maxFlushBytes as number }),
    };
  }
  /** Flush attempts that never answer: a hung host. */
  hangFlushes = false;

  async flush(flush: KnowledgeImporterFlush): Promise<KnowledgeImporterFlushReceipt> {
    this.attempts.push(flush);
    if (this.hangFlushes) return new Promise(() => {});
    expect(flush.digest).toBe(await knowledgeImporterFlushDigest(flush));
    const failure = this.failures.shift();
    if (failure && !failure.afterCommit) throw failure.error;
    const committed = this.flushes.find(f => f.seq === flush.seq);
    if (committed) {
      if (committed.digest !== flush.digest) throw new KnowledgeImporterHostConflictError('digest_mismatch', 'other');
    } else {
      if (flush.seq !== this.flushes.length + 1) throw new KnowledgeImporterHostConflictError('seq_mismatch', 'seq');
      this.flushes.push(flush);
      Object.assign(this.state, flush.state);
    }
    if (failure?.afterCommit) throw failure.error;
    // Items whose sourceId starts with `x` are refused, the way a sink refuses an occupied path.
    const refused = flush.ops
      .map(op => (op.op === 'remove' ? op.sourceId : op.item.sourceId))
      .filter(id => id.startsWith('x'))
      .map(sourceId => ({ sourceId, reason: 'occupied' as const }));
    return {
      seq: flush.seq,
      created: flush.ops.length - refused.length,
      updated: 0,
      unchanged: 0,
      moved: 0,
      removed: 0,
      stubbed: 0,
      refused,
    };
  }
  async heartbeat() {
    this.heartbeats++;
    this.heartbeatTimes.push(Date.now());
    if (this.hangHeartbeats) return new Promise<never>(() => {});
    return { cancel: this.cancel };
  }
  async finishRun(request: KnowledgeImporterFinishRequest): Promise<KnowledgeImporterRunReceipt> {
    this.finishAttempts++;
    if (request.lastSeq !== this.flushes.length)
      throw new KnowledgeImporterHostConflictError('seq_mismatch', 'lastSeq');
    if (this.finish && JSON.stringify(this.finish) !== JSON.stringify(request)) {
      throw new KnowledgeImporterHostConflictError('finish_mismatch', 'other finish');
    }
    this.finish = request;
    const failure = this.finishFailures.shift();
    if (failure) throw failure;
    return {
      runId: request.runId,
      outcome: request.outcome,
      backlog: request.backlog,
      lastSeq: request.lastSeq,
      error: request.error
        ? {
            code: request.error.code,
            retryable: request.error.retryable ?? null,
            httpStatus: request.error.httpStatus ?? null,
          }
        : null,
      counts: { created: 0, updated: 0, unchanged: 0, moved: 0, removed: 0, stubbed: 0, refused: 0 },
    };
  }
}

/** An importer class, as a host that keeps bindings itself registers it. */
const importer = (run: (ctx: KnowledgeImporterContext) => Promise<void>) =>
  class Calendar extends KnowledgeImporter({ id: 'cal', label: 'Calendar' }) {
    import(ctx: KnowledgeImporterContext<Record<string, never>, never>) {
      return run(ctx);
    }
  };

const item = (n: number) => ({ sourceId: `e${n}`, title: `Event ${n}`, body: `body ${n}` });

describe('runKnowledgeImport', () => {
  it("returns each refused item's sourceId and reason on the run receipt, across flushes", async () => {
    const host = new RecordingHost();
    const receipt = await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          await ctx.items.upsert(item(1));
          await ctx.items.upsert({ ...item(2), sourceId: 'x2' });
          await ctx.items.upsert(item(3));
          await ctx.items.upsert({ ...item(4), sourceId: 'x4' });
        }),
      ],
      host,
      bindingId: 'b1',
      bufferSize: 2,
    });
    expect(host.flushes).toHaveLength(2);
    expect(receipt).toMatchObject({
      outcome: 'succeeded',
      refused: [
        { sourceId: 'x2', reason: 'occupied' },
        { sourceId: 'x4', reason: 'occupied' },
      ],
    });
  });

  it('keeps the first 100 refusals on the run receipt', async () => {
    const host = new RecordingHost();
    const receipt = await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          for (let i = 0; i < 150; i++) await ctx.items.upsert({ ...item(i), sourceId: `x${i}` });
        }),
      ],
      host,
      bindingId: 'b1',
      bufferSize: 40,
    });
    expect(receipt).toMatchObject({ outcome: 'succeeded' });
    const refused = (receipt as KnowledgeImporterRunReceipt).refused!;
    expect(refused).toHaveLength(100);
    expect(refused[0]).toEqual({ sourceId: 'x0', reason: 'occupied' });
    expect(refused[99]).toEqual({ sourceId: 'x99', reason: 'occupied' });
  });

  it('flushes when the buffer fills, with state.set, and when sync returns, in seq order', async () => {
    const host = new RecordingHost();
    const receipt = await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          for (let i = 1; i <= 5; i++) await ctx.items.upsert(item(i));
          await ctx.state.set('cursor', 'c5');
          await ctx.items.upsert(item(6));
        }),
      ],
      host,
      bindingId: 'b1',
      bufferSize: 2,
    });
    expect(host.flushes.map(f => [f.seq, f.ops.length, f.state])).toEqual([
      [1, 2, undefined],
      [2, 2, undefined],
      [3, 1, { cursor: 'c5' }],
      [4, 1, undefined],
    ]);
    expect(receipt.outcome).toBe('succeeded');
    expect(host.finish).toMatchObject({ outcome: 'succeeded', lastSeq: 4, backlog: false });
  });

  describe('maxFlushBytes', () => {
    const bytes = (flush: KnowledgeImporterFlush) => new TextEncoder().encode(JSON.stringify(flush)).byteLength;
    const big = (n: number, chars: number, char = 'a') => ({ ...item(n), body: char.repeat(chars) });

    it('sends the buffer before an item would take the request over the bound, so every request fits', async () => {
      const host = new RecordingHost();
      const receipt = await runKnowledgeImport({
        importers: [
          importer(async ctx => {
            for (let i = 1; i <= 10; i++) await ctx.items.upsert(big(i, 3_000));
            await ctx.state.set('cursor', 'c10');
          }),
        ],
        host,
        bindingId: 'b1',
        maxFlushBytes: 10_000,
      });
      expect(receipt).toMatchObject({ outcome: 'succeeded' });
      expect(host.flushes.length).toBeGreaterThan(1);
      for (const flush of host.attempts) expect(bytes(flush)).toBeLessThanOrEqual(10_000);
      expect(host.flushes.flatMap(f => f.ops.map(op => (op.op === 'upsert' ? op.item.sourceId : '')))).toEqual(
        Array.from({ length: 10 }, (_, i) => `e${i + 1}`),
      );
      expect(host.state).toEqual({ cursor: 'c10' });
      // The cursor lands with or after the last item, never before it.
      expect(host.flushes.at(-1)!.state).toEqual({ cursor: 'c10' });
    });

    it("keeps under the host's limit from the start, and under the lower of it and the option", async () => {
      const run = async (hostLimit: unknown, own?: number) => {
        const host = new RecordingHost();
        host.maxFlushBytes = hostLimit;
        const receipt = await runKnowledgeImport({
          importers: [
            importer(async ctx => {
              for (let i = 1; i <= 10; i++) await ctx.items.upsert(big(i, 3_000));
            }),
          ],
          host,
          bindingId: 'b1',
          ...(own !== undefined && { maxFlushBytes: own }),
        });
        expect(receipt).toMatchObject({ outcome: 'succeeded' });
        return Math.max(...host.attempts.map(bytes));
      };
      expect(await run(10_000)).toBeLessThanOrEqual(10_000);
      expect(await run(10_000, 7_000)).toBeLessThanOrEqual(7_000);
      expect(await run(7_000, 10_000)).toBeLessThanOrEqual(7_000);
      // Not a positive whole number: ignored, so the run is unbounded as before.
      for (const ignored of [0, -1, 1.5, '10000', null]) expect(await run(ignored)).toBeGreaterThan(10_000);
    });

    it('packs each request as full as the bound allows, counting every byte of the request', async () => {
      const host = new RecordingHost();
      await runKnowledgeImport({
        // Small ops, many to a request: the commas between them add up to more than one op.
        importers: [
          importer(
            async ctx => void (await Promise.all(Array.from({ length: 600 }, (_, i) => ctx.items.remove(`e${i}`)))),
          ),
        ],
        host,
        bindingId: 'b1',
        maxFlushBytes: 2_000,
        bufferSize: 1_000,
      });
      expect(host.flushes.flatMap(f => f.ops)).toHaveLength(600);
      for (const [i, flush] of host.flushes.entries()) {
        expect(bytes(flush)).toBeLessThanOrEqual(2_000);
        // The runner counts `seq` at its longest (16 digits), so a request may end up to 15 bytes short.
        const next = host.flushes[i + 1]?.ops[0];
        if (next) expect(bytes({ ...flush, ops: [...flush.ops, next] })).toBeGreaterThan(2_000 - 15);
      }
    });

    it('counts multibyte text by its encoded bytes, not its length', async () => {
      const host = new RecordingHost();
      await runKnowledgeImport({
        importers: [
          importer(async ctx => void (await Promise.all([1, 2, 3].map(i => ctx.items.upsert(big(i, 2_000, '€')))))),
        ],
        host,
        bindingId: 'b1',
        maxFlushBytes: 10_000,
      });
      // Each body is 2,000 characters but 6,000 bytes: two don't fit in one request.
      expect(host.flushes.map(f => f.ops.length)).toEqual([1, 1, 1]);
      for (const flush of host.attempts) expect(bytes(flush)).toBeLessThanOrEqual(10_000);
    });

    it('sends the saved state on its own when it no longer fits beside the buffer', async () => {
      const host = new RecordingHost();
      await runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert(big(1, 6_000));
            await ctx.state.set('cursor', 'c'.repeat(6_000));
          }),
        ],
        host,
        bindingId: 'b1',
        maxFlushBytes: 10_000,
      });
      expect(host.flushes.map(f => [f.ops.length, f.state === undefined])).toEqual([
        [1, true],
        [0, false],
      ]);
      for (const flush of host.attempts) expect(bytes(flush)).toBeLessThanOrEqual(10_000);
    });

    it('fails the run flush_too_large before sending an item that cannot fit on its own, keeping the cursor', async () => {
      const host = new RecordingHost();
      host.state = { cursor: 'old' };
      let thrown: unknown;
      const receipt = await runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert(item(1));
            try {
              await ctx.items.upsert(big(2, 20_000));
            } catch (error) {
              thrown = error;
            }
            await ctx.state.set('cursor', 'new').catch(() => {});
          }),
        ],
        host,
        bindingId: 'b1',
        maxFlushBytes: 10_000,
      });
      expect(thrown).toBeDefined();
      expect(host.attempts).toEqual([]);
      expect(host.state).toEqual({ cursor: 'old' });
      expect(receipt).toMatchObject({ outcome: 'failed', error: { code: 'flush_too_large' } });
    });

    it('fails the run flush_too_large when the saved state cannot fit on its own', async () => {
      const host = new RecordingHost();
      const receipt = await runKnowledgeImport({
        importers: [importer(async ctx => await ctx.state.set('cursor', 'c'.repeat(20_000)).catch(() => {}))],
        host,
        bindingId: 'b1',
        maxFlushBytes: 10_000,
      });
      expect(host.attempts).toEqual([]);
      expect(receipt).toMatchObject({ outcome: 'failed', error: { code: 'flush_too_large' } });
    });

    it('sends an op whose request fits the bound exactly, and refuses it one byte under', async () => {
      const body = { ops: [{ op: 'remove' as const, sourceId: 'e1' }] };
      const exact = bytes({
        runId: 'run-1',
        generation: 1,
        seq: 1,
        digest: await knowledgeImporterFlushDigest(body),
        ...body,
      });
      const run = (maxFlushBytes: number) => {
        const host = new RecordingHost();
        return runKnowledgeImport({
          importers: [importer(async ctx => await ctx.items.remove('e1').catch(() => {}))],
          host,
          bindingId: 'b1',
          maxFlushBytes,
        }).then(receipt => ({ host, receipt }));
      };
      const fits = await run(exact);
      expect(fits.receipt).toMatchObject({ outcome: 'succeeded' });
      expect(fits.host.flushes.map(f => f.ops)).toEqual([body.ops]);
      expect(bytes(fits.host.flushes[0]!)).toBe(exact);
      const over = await run(exact - 1);
      expect(over.host.attempts).toEqual([]);
      expect(over.receipt).toMatchObject({ outcome: 'failed', error: { code: 'flush_too_large' } });
    });

    it('saves a state whose request fits the bound exactly, and refuses it one byte under', async () => {
      const body = { ops: [], state: { cursor: 'c1' } };
      const exact = bytes({
        runId: 'run-1',
        generation: 1,
        seq: 1,
        digest: await knowledgeImporterFlushDigest(body),
        ...body,
      });
      const run = (maxFlushBytes: number) => {
        const host = new RecordingHost();
        return runKnowledgeImport({
          importers: [importer(async ctx => await ctx.state.set('cursor', 'c1').catch(() => {}))],
          host,
          bindingId: 'b1',
          maxFlushBytes,
        }).then(receipt => ({ host, receipt }));
      };
      const fits = await run(exact);
      expect(fits.receipt).toMatchObject({ outcome: 'succeeded' });
      expect(fits.host.state).toEqual({ cursor: 'c1' });
      expect(bytes(fits.host.flushes[0]!)).toBe(exact);
      const over = await run(exact - 1);
      expect(over.host.attempts).toEqual([]);
      expect(over.host.state).toEqual({});
      expect(over.receipt).toMatchObject({ outcome: 'failed', error: { code: 'flush_too_large' } });
    });

    it('fails the run flush_too_large rather than send an empty settle flush over the bound', async () => {
      const host = new RecordingHost();
      const receipt = await runKnowledgeImport({
        importers: [importer(async () => {})],
        host,
        bindingId: 'b1',
        maxFlushBytes: 1,
      });
      expect(host.attempts).toEqual([]);
      expect(receipt).toMatchObject({ outcome: 'failed', error: { code: 'flush_too_large' } });
    });

    it('sends what was handed over, so an item changed after upsert cannot grow the request', async () => {
      const host = new RecordingHost();
      const receipt = await runKnowledgeImport({
        importers: [
          importer(async ctx => {
            const page = big(1, 100);
            await ctx.items.upsert(page);
            page.body = 'a'.repeat(30_000);
            await ctx.state.set('cursor', 'c1');
          }),
        ],
        host,
        bindingId: 'b1',
        maxFlushBytes: 10_000,
      });
      expect(receipt).toMatchObject({ outcome: 'succeeded' });
      for (const flush of host.attempts) expect(bytes(flush)).toBeLessThanOrEqual(10_000);
      const sent = host.flushes.flatMap(f => f.ops);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ op: 'upsert', item: { body: 'a'.repeat(100) } });
      expect(host.state).toEqual({ cursor: 'c1' });
    });

    it('refuses a bound that is not a positive number of bytes', async () => {
      for (const maxFlushBytes of [0, -1, Number.NaN, 1.5]) {
        await expect(
          runKnowledgeImport({
            importers: [importer(async () => {})],
            host: new RecordingHost(),
            bindingId: 'b1',
            maxFlushBytes,
          }),
        ).rejects.toThrow(TypeError);
      }
    });
  });

  it('reads back the state the last committed flush left', async () => {
    const host = new RecordingHost();
    host.state = { cursor: 'old' };
    let seen: string | undefined;
    await runKnowledgeImport({
      importers: [importer(async ctx => void (seen = await ctx.state.get('cursor')))],
      host,
      bindingId: 'b1',
    });
    expect(seen).toBe('old');
  });

  it('resends the same seq and digest after a 5xx or network error, and gets the stored receipt after a lost ack', async () => {
    const host = new RecordingHost();
    host.failures = [
      { error: new KnowledgeImporterHostError('bad gateway', 502) },
      { error: new KnowledgeImporterHostError('network') },
      { error: new KnowledgeImporterHostError('lost ack', 503), afterCommit: true },
    ];
    await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          await ctx.items.upsert(item(1));
        }),
      ],
      host,
      bindingId: 'b1',
      retryDelayMs: () => 0,
    });
    expect(host.attempts.map(a => [a.seq, a.digest])).toEqual(Array(4).fill([1, host.flushes[0]!.digest]));
    expect(host.flushes).toHaveLength(1);
    expect(host.finish).toMatchObject({ outcome: 'succeeded', lastSeq: 1 });
  });

  it('ends the run on a host refusal or a non-retryable host status, without resending', async () => {
    for (const error of [
      new KnowledgeImporterHostConflictError('stale_generation', 'moved on'),
      new KnowledgeImporterHostError('forbidden', 403),
    ]) {
      const host = new RecordingHost();
      host.failures = [{ error }];
      await runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert(item(1));
          }),
        ],
        host,
        bindingId: 'b1',
        retryDelayMs: () => 0,
      });
      expect(host.attempts).toHaveLength(1);
      expect(host.finish).toMatchObject({ outcome: 'failed', lastSeq: 0, error: { code: 'importer_error' } });
    }
  });

  it('maps a source error to its fixed code and never sends the message', async () => {
    const host = new RecordingHost();
    await runKnowledgeImport({
      importers: [
        importer(async () => {
          throw new KnowledgeImporterSourceError('token sk-secret rejected', 401);
        }),
      ],
      host,
      bindingId: 'b1',
    });
    expect(host.finish).toEqual({
      runId: 'run-1',
      generation: 1,
      outcome: 'failed',
      backlog: false,
      lastSeq: 0,
      error: { code: 'source_auth_failed', retryable: false, httpStatus: 401 },
    });
  });

  it('runs another pass while the importer reports backlog, up to the pass cap', async () => {
    const host = new RecordingHost();
    let passes = 0;
    await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          passes++;
          await ctx.state.set('cursor', String(passes));
          ctx.reportBacklog();
        }),
      ],
      host,
      bindingId: 'b1',
      maxPasses: 3,
    });
    expect(passes).toBe(3);
    expect(host.finish).toMatchObject({ outcome: 'succeeded', backlog: true, lastSeq: 3 });
  });

  it('stops on cancel from a heartbeat: aborts the signal, refuses state.set, finishes canceled', async () => {
    const host = new RecordingHost();
    let aborted = false;
    let upsertError: unknown;
    let setError: unknown;
    await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          await ctx.items.upsert(item(1));
          await ctx.state.set('cursor', 'c1');
          host.cancel = true;
          await new Promise<void>(resolve => ctx.signal.addEventListener('abort', () => resolve()));
          aborted = ctx.signal.aborted;
          upsertError = await ctx.items.upsert(item(2)).catch(e => e);
          setError = await ctx.state.set('cursor', 'c2').catch(e => e);
        }),
      ],
      host,
      bindingId: 'b1',
      heartbeatMs: 5,
    });
    expect(aborted).toBe(true);
    expect(upsertError).toBeInstanceOf(Error);
    expect(setError).toBeInstanceOf(Error);
    expect(host.state).toEqual({ cursor: 'c1' });
    expect(host.flushes).toHaveLength(1);
    expect(host.finish).toMatchObject({ outcome: 'canceled', lastSeq: 1 });
  });

  it('stops at the hard deadline: aborts the signal and finishes failed with stopped', async () => {
    const host = new RecordingHost();
    await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          await new Promise<void>(resolve => ctx.signal.addEventListener('abort', () => resolve()));
        }),
      ],
      host,
      bindingId: 'b1',
      budgetMs: 5,
      graceMs: 5,
    });
    expect(host.finish).toMatchObject({ outcome: 'failed', error: { code: 'stopped' } });
  });

  it("aborts a fetch at the run's deadline even when the importer passes its own signal", async () => {
    const host = new RecordingHost();
    let fetchSignal: AbortSignal | undefined;
    const own = new AbortController();
    await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          await ctx.fetch('https://source.test/items', { signal: own.signal }).catch(() => undefined);
        }),
      ],
      host,
      bindingId: 'b1',
      budgetMs: 5,
      graceMs: 5,
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          fetchSignal = init?.signal ?? undefined;
          fetchSignal?.addEventListener('abort', () => reject(fetchSignal!.reason));
        }),
    });
    expect(fetchSignal?.aborted).toBe(true);
    expect(own.signal.aborted).toBe(false);
    expect(host.finish).toMatchObject({ outcome: 'failed', error: { code: 'stopped' } });
  });

  it("aborts a fetch when the importer's own signal aborts, before the run ends", async () => {
    const host = new RecordingHost();
    const own = new AbortController();
    let aborted = false;
    await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          const pending = ctx.fetch('https://source.test/items', { signal: own.signal }).catch(() => {
            aborted = true;
          });
          own.abort();
          await pending;
        }),
      ],
      host,
      bindingId: 'b1',
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          if (init?.signal?.aborted) return reject(init.signal.reason);
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    });
    expect(aborted).toBe(true);
    expect(host.finish).toMatchObject({ outcome: 'succeeded' });
  });

  it('finishes credential_missing and importer_missing_from_deploy without running import', async () => {
    let ran = false;
    class WithSlot extends KnowledgeImporter({
      id: 'cal',
      label: 'Calendar',
      credentials: { TOKEN: { description: 'API token' } },
    }) {
      async import() {
        ran = true;
      }
    }
    const host = new RecordingHost();
    await runKnowledgeImport({ importers: [WithSlot], host, bindingId: 'b1' });
    expect(host.finish).toMatchObject({ outcome: 'failed', error: { code: 'credential_missing' } });
    const other = new RecordingHost();
    await runKnowledgeImport({ importers: [], host: other, bindingId: 'b1' });
    expect(other.finish).toMatchObject({ outcome: 'failed', error: { code: 'importer_missing_from_deploy' } });
    expect(ran).toBe(false);
  });

  it('finishes the run failed with importer_error when setup throws, and rethrows the original error', async () => {
    const throwing = {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        jsonSchema: { input: () => ({ type: 'object' }), output: () => ({ type: 'object' }) },
        validate: () => {
          throw new Error('validator blew up');
        },
      },
    };
    class Strict extends KnowledgeImporter({ id: 'cal', label: 'Calendar', settings: throwing }) {
      async import() {}
    }
    const host = new RecordingHost();
    await expect(runKnowledgeImport({ importers: [Strict], host, bindingId: 'b1' })).rejects.toThrow(
      'validator blew up',
    );
    expect(host.finish).toMatchObject({ outcome: 'failed', backlog: false, error: { code: 'importer_error' } });

    // A finish that fails doesn't replace the importer's own error.
    const down = new RecordingHost();
    down.finishFailures = [new KnowledgeImporterHostConflictError('run_not_active', 'gone')];
    await expect(runKnowledgeImport({ importers: [Strict], host: down, bindingId: 'b1' })).rejects.toThrow(
      'validator blew up',
    );

    class Broken extends KnowledgeImporter({ id: 'cal', label: 'Calendar' }) {
      constructor(b: never) {
        super(b);
        throw new Error('constructor blew up');
      }
      async import() {}
    }
    const other = new RecordingHost();
    await expect(runKnowledgeImport({ importers: [Broken], host: other, bindingId: 'b1' })).rejects.toThrow(
      'constructor blew up',
    );
    expect(other.finish).toMatchObject({ outcome: 'failed', error: { code: 'importer_error' } });
  });

  it('settles a flush whose outcome stayed unknown before finishing, so lastSeq is never stale', async () => {
    const host = new RecordingHost();
    // Committed, then every retry fails: the runner can't tell whether seq 1 landed.
    host.failures = Array.from({ length: 10 }, (_, i) => ({
      error: new KnowledgeImporterHostError('unavailable', 503),
      afterCommit: i === 0,
    }));
    const receipt = await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          await ctx.items.upsert(item(1));
        }),
      ],
      host,
      bindingId: 'b1',
      retryDelayMs: () => 0,
      maxRetries: 3,
    });
    expect(host.flushes).toHaveLength(1);
    expect(host.finish).toMatchObject({
      outcome: 'failed',
      lastSeq: 1,
      error: { code: 'importer_error', retryable: true },
    });
    expect(receipt).toMatchObject({ outcome: 'failed', lastSeq: 1 });
  });

  it('resends the identical finish after a lost ack and accepts the stored receipt', async () => {
    const host = new RecordingHost();
    host.finishFailures = [new KnowledgeImporterHostError('lost ack', 502)];
    const receipt = await runKnowledgeImport({
      importers: [
        importer(async ctx => {
          await ctx.items.upsert(item(1));
        }),
      ],
      host,
      bindingId: 'b1',
      retryDelayMs: () => 0,
    });
    expect(host.finishAttempts).toBe(2);
    expect(receipt).toMatchObject({ outcome: 'succeeded', lastSeq: 1 });
  });

  it('leaves the run to the host when the host stays unreachable for the finish', async () => {
    const host = new RecordingHost();
    host.finishFailures = Array(10).fill(new KnowledgeImporterHostError('down'));
    const result = await runKnowledgeImport({
      importers: [importer(async () => {})],
      host,
      bindingId: 'b1',
      retryDelayMs: () => 0,
      maxRetries: 2,
    });
    // The importer flushed nothing, so the runner's one empty settle flush is seq 1.
    expect(result).toEqual({ status: 'unfinished', runId: 'run-1', lastSeq: 1 });
  });

  it('returns without finishing when the host skips the run', async () => {
    const host = new RecordingHost();
    host.startRun = async () => ({ status: 'skipped', runId: 'run-2' }) as any;
    const result = await runKnowledgeImport({ importers: [importer(async () => {})], host, bindingId: 'b1' });
    expect(result).toEqual({ status: 'skipped', runId: 'run-2' });
    expect(host.finish).toBeUndefined();
  });

  describe('stop wakes the runner (O3 part 1 review)', () => {
    const never = () => new Promise<void>(() => {});

    /** Timers still armed (not fired, not cleared) with at least `minMs`, while `run` executes. */
    async function armedTimersAfter(run: () => Promise<unknown>, minMs: number) {
      const armed = new Map<unknown, number>();
      const realSet = globalThis.setTimeout;
      const realClear = globalThis.clearTimeout;
      const set = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
        const id: unknown = realSet(() => {
          armed.delete(id);
          fn();
        }, ms);
        armed.set(id, ms ?? 0);
        return id;
      }) as typeof setTimeout);
      const clear = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id: unknown) => {
        armed.delete(id);
        realClear(id as ReturnType<typeof setTimeout>);
      }) as typeof clearTimeout);
      try {
        await run();
      } finally {
        set.mockRestore();
        clear.mockRestore();
      }
      const left = [...armed].filter(([, ms]) => ms >= minMs);
      for (const [id] of left) realClear(id as ReturnType<typeof setTimeout>);
      return left.map(([, ms]) => ms);
    }

    it("doesn't wait past the hard deadline for the last flush of a pass", async () => {
      const host = new RecordingHost();
      host.hangFlushes = true;
      const startedAt = Date.now();
      // One item, below bufferSize: it goes out in the flush after import returns.
      const result = await runKnowledgeImport({
        importers: [importer(async ctx => ctx.items.upsert(item(1)))],
        host,
        bindingId: 'b1',
        budgetMs: 50,
        graceMs: 50,
        hostCallTimeoutMs: 60_000,
      });
      expect(Date.now() - startedAt).toBeLessThan(1000);
      expect(host.attempts).toHaveLength(1);
      expect(result).toMatchObject({ outcome: 'failed', lastSeq: 0, error: { code: 'stopped' } });
    }, 3000);

    it('sends no flush when cancel arrives while its digest is computed', async () => {
      const host = new RecordingHost();
      digestHook.before = async () => {
        host.cancel = true;
        // Wait for a heartbeat to hand the cancel back, then let the runner act on it.
        const seen = host.heartbeats;
        while (host.heartbeats === seen) await new Promise(resolve => setTimeout(resolve, 1));
        await new Promise(resolve => setTimeout(resolve, 0));
      };
      const result = await runKnowledgeImport({
        importers: [importer(async ctx => ctx.items.upsert(item(1)))],
        host,
        bindingId: 'b1',
        heartbeatMs: 5,
      });
      expect(host.attempts).toEqual([]);
      expect(result).toMatchObject({ outcome: 'canceled', lastSeq: 0 });
    }, 3000);

    it('leaves no deadline timer armed after a canceled run returns', async () => {
      const host = new RecordingHost();
      const left = await armedTimersAfter(
        () =>
          runKnowledgeImport({
            importers: [
              importer(async ctx => {
                await ctx.items.upsert(item(1));
                host.cancel = true;
                await never();
              }),
            ],
            host,
            bindingId: 'b1',
            heartbeatMs: 5,
            budgetMs: 60_000,
            graceMs: 60_000,
          }),
        1000,
      );
      expect(left).toEqual([]);
    }, 3000);

    it("bounds startRun and doesn't resend it", async () => {
      const host = new RecordingHost();
      host.hangStart = true;
      await expect(
        runKnowledgeImport({ importers: [importer(async () => {})], host, bindingId: 'b1', hostCallTimeoutMs: 20 }),
      ).rejects.toBeInstanceOf(KnowledgeImporterHostError);
      expect(host.startCalls).toBe(1);
    }, 3000);

    it('sends no new heartbeat while one is still unanswered, across several host timeouts', async () => {
      const host = new RecordingHost();
      host.hangHeartbeats = true;
      await runKnowledgeImport({
        importers: [importer(async () => new Promise(resolve => setTimeout(resolve, 200)))],
        host,
        bindingId: 'b1',
        heartbeatMs: 5,
        hostCallTimeoutMs: 20,
      });
      // 200ms of run is 10 host timeouts and 40 heartbeat ticks; the first heartbeat never settles.
      expect(host.heartbeats).toBe(1);
    }, 3000);

    it('sends the next heartbeat once the previous one has settled', async () => {
      const host = new RecordingHost();
      await runKnowledgeImport({
        importers: [importer(async () => new Promise(resolve => setTimeout(resolve, 100)))],
        host,
        bindingId: 'b1',
        heartbeatMs: 5,
      });
      expect(host.heartbeats).toBeGreaterThan(3);
    }, 3000);

    it('returns on cancel while sync ignores its abort signal', async () => {
      const host = new RecordingHost();
      const startedAt = Date.now();
      const result = await runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert(item(1));
            await ctx.state.set('cursor', 'c1');
            host.cancel = true;
            await never();
          }),
        ],
        host,
        bindingId: 'b1',
        heartbeatMs: 5,
        budgetMs: 60_000,
        graceMs: 60_000,
      });
      expect(Date.now() - startedAt).toBeLessThan(1000);
      expect(result).toMatchObject({ outcome: 'canceled', lastSeq: 1 });
    }, 3000);

    it("doesn't wait past the hard deadline for a flush the host never answers", async () => {
      const host = new RecordingHost();
      host.hangFlushes = true;
      const startedAt = Date.now();
      const result = await runKnowledgeImport({
        importers: [importer(async ctx => ctx.items.upsert(item(1)))],
        host,
        bindingId: 'b1',
        bufferSize: 1,
        budgetMs: 50,
        graceMs: 50,
        hostCallTimeoutMs: 60_000,
      });
      expect(Date.now() - startedAt).toBeLessThan(1000);
      // The flush may still commit: the finish names the seq the host holds (here none landed).
      expect(host.attempts).toHaveLength(1);
      expect(result).toMatchObject({ outcome: 'failed', lastSeq: 0, error: { code: 'stopped' } });
    }, 3000);

    it('bounds one host call: a flush that never answers is treated as unacknowledged and resent', async () => {
      const host = new RecordingHost();
      host.hangFlushes = true;
      const result = await runKnowledgeImport({
        importers: [importer(async ctx => ctx.items.upsert(item(1)))],
        host,
        bindingId: 'b1',
        hostCallTimeoutMs: 20,
        maxRetries: 2,
        retryDelayMs: () => 1,
      });
      expect(host.attempts.map(a => [a.seq, a.digest])).toEqual(
        Array.from({ length: 3 }, () => [1, host.attempts[0]!.digest]),
      );
      expect(result).toMatchObject({ outcome: 'failed', lastSeq: 0, error: { code: 'importer_error' } });
    }, 3000);

    it('sends no flush retry after stop', async () => {
      const host = new RecordingHost();
      host.failures = [{ error: new KnowledgeImporterHostError('down', 503) }];
      const result = await runKnowledgeImport({
        importers: [
          importer(async ctx => {
            host.cancel = true;
            await ctx.items.upsert(item(1));
          }),
        ],
        host,
        bindingId: 'b1',
        bufferSize: 1,
        heartbeatMs: 5,
        retryDelayMs: () => 200,
      });
      expect(host.attempts).toHaveLength(1);
      expect(result).toMatchObject({ outcome: 'canceled', lastSeq: 0 });
    }, 3000);
  });

  describe('timed flush', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    /** A promise the test resolves, so an import can sit between items while time passes. */
    const gate = () => {
      let open!: () => void;
      const opened = new Promise<void>(resolve => (open = resolve));
      return { opened, open };
    };

    /** Lets real async work (the flush digest) run while fake time stands still. */
    async function until(done: () => boolean) {
      for (let i = 0; i < 500 && !done(); i++) await new Promise(resolve => setImmediate(resolve));
      expect(done()).toBe(true);
    }

    it('writes slow items once the oldest has waited flushAfterMs, without saving the cursor', async () => {
      const host = new RecordingHost();
      host.state = { cursor: 'c0' };
      const [second, done] = [gate(), gate()];
      let pushed = 0;
      const run = runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert(item(1));
            pushed++;
            await second.opened;
            await ctx.items.upsert(item(2));
            pushed++;
            await done.opened;
            await ctx.state.set('cursor', 'c2');
          }),
        ],
        host,
        bindingId: 'b1',
        flushAfterMs: 30_000,
      });
      await until(() => pushed === 1);
      await vi.advanceTimersByTimeAsync(10_000);
      second.open();
      await until(() => pushed === 2);
      // The timer runs from the oldest item, not the latest: 29.999s after item 1, nothing yet.
      await vi.advanceTimersByTimeAsync(19_999);
      expect(host.attempts).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      await until(() => host.flushes.length === 1);
      expect(host.flushes.map(f => [f.seq, f.ops.map(op => op.op === 'upsert' && op.item.sourceId), f.state])).toEqual([
        [1, ['e1', 'e2'], undefined],
      ]);
      expect(host.state).toEqual({ cursor: 'c0' });
      done.open();
      const result = await run;
      expect(host.flushes.map(f => [f.seq, f.ops.length, f.state])).toEqual([
        [1, 2, undefined],
        [2, 0, { cursor: 'c2' }],
      ]);
      expect(result).toMatchObject({ outcome: 'succeeded', lastSeq: 2 });
    });

    it('starts the timer for ops left behind by a byte split while the split flush waits for its ack', async () => {
      const ack = gate();
      class SlowAckHost extends RecordingHost {
        override async flush(flush: KnowledgeImporterFlush) {
          const receipt = await super.flush(flush);
          if (flush.seq === 1) await ack.opened;
          return receipt;
        }
      }
      const host = new SlowAckHost();
      const done = gate();
      let pushed = 0;
      const run = runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert({ ...item(1), body: 'a'.repeat(6_000) });
            pushed++;
            await ctx.items.upsert({ ...item(2), body: 'b'.repeat(6_000) });
            pushed++;
            await done.opened;
          }),
        ],
        host,
        bindingId: 'b1',
        maxFlushBytes: 10_000,
        flushAfterMs: 30_000,
        hostCallTimeoutMs: 120_000,
      });
      await until(() => host.flushes.length === 1);
      // Item 2 waits in the buffer from the split on; the split's ack comes 45s later.
      await vi.advanceTimersByTimeAsync(45_000);
      ack.open();
      await until(() => pushed === 2);
      // Item 2 has waited past flushAfterMs, so it goes as soon as the ack is in, not 30s after it.
      await until(() => host.flushes.length === 2);
      expect(host.flushes.map(f => f.ops.map(op => op.op === 'upsert' && op.item.sourceId))).toEqual([['e1'], ['e2']]);
      done.open();
      expect(await run).toMatchObject({ outcome: 'succeeded' });
    });

    it('starts the timer over after a size flush', async () => {
      const host = new RecordingHost();
      const [rest, done] = [gate(), gate()];
      let pushed = 0;
      const run = runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert(item(1));
            pushed++;
            await rest.opened;
            await ctx.items.upsert(item(2)); // fills the buffer: size flush
            await ctx.items.upsert(item(3)); // the new oldest item, at 20s
            pushed += 2;
            await done.opened;
          }),
        ],
        host,
        bindingId: 'b1',
        bufferSize: 2,
        flushAfterMs: 30_000,
      });
      await until(() => pushed === 1);
      await vi.advanceTimersByTimeAsync(20_000);
      rest.open();
      await until(() => pushed === 3 && host.flushes.length === 1);
      // At 30s a timer left over from item 1 would fire; item 3 has waited only 10s.
      await vi.advanceTimersByTimeAsync(10_000);
      await vi.advanceTimersByTimeAsync(19_999);
      expect(host.attempts).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      await until(() => host.flushes.length === 2);
      expect(host.flushes.map(f => f.ops.map(op => op.op === 'upsert' && op.item.sourceId))).toEqual([
        ['e1', 'e2'],
        ['e3'],
      ]);
      done.open();
      await expect(run).resolves.toMatchObject({ outcome: 'succeeded', lastSeq: 2 });
    });

    it('queues a timed flush behind one in flight, so flushes never overlap', async () => {
      const host = new RecordingHost();
      const answer = gate();
      let inFlight = 0;
      let most = 0;
      let calls = 0;
      const flushOnce = host.flush.bind(host);
      host.flush = async flush => {
        calls++;
        inFlight++;
        most = Math.max(most, inFlight);
        try {
          if (flush.seq === 1) await answer.opened;
          return await flushOnce(flush);
        } finally {
          inFlight--;
        }
      };
      const [second, done] = [gate(), gate()];
      let pushed = 0;
      const run = runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert(item(1));
            pushed++;
            await second.opened;
            await ctx.items.upsert(item(2));
            pushed++;
            await done.opened;
          }),
        ],
        host,
        bindingId: 'b1',
        flushAfterMs: 30_000,
        hostCallTimeoutMs: 600_000,
      });
      await until(() => pushed === 1);
      await vi.advanceTimersByTimeAsync(30_000);
      await until(() => calls === 1); // e1 sent; its answer is held
      second.open();
      await until(() => pushed === 2);
      await vi.advanceTimersByTimeAsync(30_000); // e2's timed flush waits behind seq 1
      for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
      expect(calls).toBe(1);
      answer.open();
      await until(() => host.flushes.length === 2);
      done.open();
      const result = await run;
      expect(most).toBe(1);
      expect(host.flushes.map(f => [f.seq, f.ops.map(op => op.op === 'upsert' && op.item.sourceId)])).toEqual([
        [1, ['e1']],
        [2, ['e2']],
      ]);
      expect(result).toMatchObject({ outcome: 'succeeded', lastSeq: 2 });
    });

    it('fails the run when a timed flush is rejected, so no later cursor skips its items', async () => {
      const host = new RecordingHost();
      host.state = { cursor: 'c0' };
      const after = gate();
      let pushed = false;
      let setError: unknown;
      const run = runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert(item(1));
            await ctx.items.upsert({ ...item(2), sourceId: '' }); // the host can't take this batch
            pushed = true;
            await after.opened;
            await ctx.items.upsert(item(3)).catch(() => {});
            await ctx.state.set('cursor', 'c3').catch(error => (setError = error));
          }),
        ],
        host,
        bindingId: 'b1',
        flushAfterMs: 30_000,
      });
      await until(() => pushed);
      await vi.advanceTimersByTimeAsync(30_000);
      for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
      after.open();
      const result = await run;
      // The run ends without waiting on the importer; its cursor save is refused when it gets there.
      await until(() => setError !== undefined);
      expect(host.attempts).toEqual([]);
      expect(host.state).toEqual({ cursor: 'c0' });
      expect(result).toMatchObject({ outcome: 'failed', error: { code: 'importer_error' }, lastSeq: 0 });
    });

    it('fails the run when a batch the importer waited on is rejected, even if the importer catches it', async () => {
      const host = new RecordingHost();
      host.state = { cursor: 'c0' };
      const result = await runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert({ ...item(1), sourceId: '' });
            await ctx.state.set('cursor', 'c1').catch(() => {});
            await ctx.state.set('cursor', 'c2').catch(() => {});
          }),
        ],
        host,
        bindingId: 'b1',
        flushAfterMs: 30_000,
      });
      expect(host.attempts).toEqual([]);
      expect(host.state).toEqual({ cursor: 'c0' });
      expect(result).toMatchObject({ outcome: 'failed', error: { code: 'importer_error' }, lastSeq: 0 });
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 31])(
      'rejects flushAfterMs %s before starting a run',
      async ms => {
        const host = new RecordingHost();
        const startRun = vi.spyOn(host, 'startRun');
        await expect(
          runKnowledgeImport({ importers: [importer(async () => {})], host, bindingId: 'b1', flushAfterMs: ms }),
        ).rejects.toThrow(/flushAfterMs/);
        expect(startRun).not.toHaveBeenCalled();
      },
    );

    it('fires nothing after the run finishes', async () => {
      const host = new RecordingHost();
      const result = await runKnowledgeImport({
        importers: [importer(async ctx => ctx.items.upsert(item(1)))],
        host,
        bindingId: 'b1',
        flushAfterMs: 30_000,
      });
      expect(result).toMatchObject({ outcome: 'succeeded', lastSeq: 1 });
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(host.attempts).toHaveLength(1);
    });

    it('fires nothing after the run is canceled', async () => {
      const host = new RecordingHost();
      const run = runKnowledgeImport({
        importers: [
          importer(async ctx => {
            await ctx.items.upsert(item(1));
            host.cancel = true;
            await new Promise<void>(() => {});
          }),
        ],
        host,
        bindingId: 'b1',
        heartbeatMs: 5_000,
        flushAfterMs: 30_000,
      });
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(run).resolves.toMatchObject({ outcome: 'canceled', lastSeq: 0 });
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(host.attempts).toEqual([]);
    });
  });
});
