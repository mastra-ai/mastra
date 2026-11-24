import { describe, expect, it, vi } from 'vitest';

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

  /** startRun never answers: a hung host. */
  hangStart = false;
  startCalls = 0;
  /** heartbeat never answers. */
  hangHeartbeats = false;
  heartbeatTimes: number[] = [];

  async startRun() {
    this.startCalls++;
    if (this.hangStart) return new Promise<never>(() => {});
    return { status: 'started' as const, runId: 'run-1', generation: 1, state: { ...this.state }, lastSeq: 0, binding };
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
});
