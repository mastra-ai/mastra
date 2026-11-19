import { describe, expect, it } from 'vitest';

import { defineKnowledgeImporter, KnowledgeImporterHostError, KnowledgeImporterSourceError } from '../define';
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

  async startRun() {
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
    return {
      seq: flush.seq,
      created: flush.ops.length,
      updated: 0,
      unchanged: 0,
      moved: 0,
      removed: 0,
      stubbed: 0,
      refused: [],
    };
  }
  async heartbeat() {
    this.heartbeats++;
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

const importer = (sync: (ctx: KnowledgeImporterContext) => Promise<void>) =>
  defineKnowledgeImporter({ id: 'cal', label: 'Calendar', sync });

const item = (n: number) => ({ sourceId: `e${n}`, title: `Event ${n}`, body: `body ${n}` });

describe('runKnowledgeImport', () => {
  it('flushes when the buffer fills, with state.set, and when sync returns, in seq order', async () => {
    const host = new RecordingHost();
    const receipt = await runKnowledgeImport({
      definitions: [
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
      definitions: [importer(async ctx => void (seen = await ctx.state.get('cursor')))],
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
      definitions: [importer(async ctx => void (await ctx.items.upsert(item(1))))],
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
        definitions: [importer(async ctx => void (await ctx.items.upsert(item(1))))],
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
      definitions: [
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
      definitions: [
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
      definitions: [
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
      definitions: [
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

  it('finishes credential_missing and importer_missing_from_deploy without running sync', async () => {
    let ran = false;
    const withSlot = defineKnowledgeImporter({
      id: 'cal',
      label: 'Calendar',
      credentials: { TOKEN: { description: 'API token' } },
      sync: async () => void (ran = true),
    });
    const host = new RecordingHost();
    await runKnowledgeImport({ definitions: [withSlot], host, bindingId: 'b1' });
    expect(host.finish).toMatchObject({ outcome: 'failed', error: { code: 'credential_missing' } });
    const other = new RecordingHost();
    await runKnowledgeImport({ definitions: [], host: other, bindingId: 'b1' });
    expect(other.finish).toMatchObject({ outcome: 'failed', error: { code: 'importer_missing_from_deploy' } });
    expect(ran).toBe(false);
  });

  it('settles a flush whose outcome stayed unknown before finishing, so lastSeq is never stale', async () => {
    const host = new RecordingHost();
    // Committed, then every retry fails: the runner can't tell whether seq 1 landed.
    host.failures = Array.from({ length: 10 }, (_, i) => ({
      error: new KnowledgeImporterHostError('unavailable', 503),
      afterCommit: i === 0,
    }));
    const receipt = await runKnowledgeImport({
      definitions: [importer(async ctx => void (await ctx.items.upsert(item(1))))],
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
      definitions: [importer(async ctx => void (await ctx.items.upsert(item(1))))],
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
      definitions: [importer(async () => {})],
      host,
      bindingId: 'b1',
      retryDelayMs: () => 0,
      maxRetries: 2,
    });
    expect(result).toEqual({ status: 'unfinished', runId: 'run-1', lastSeq: 0 });
  });

  it('returns without finishing when the host skips the run', async () => {
    const host = new RecordingHost();
    host.startRun = async () => ({ status: 'skipped', runId: 'run-2' }) as any;
    const result = await runKnowledgeImport({ definitions: [importer(async () => {})], host, bindingId: 'b1' });
    expect(result).toEqual({ status: 'skipped', runId: 'run-2' });
    expect(host.finish).toBeUndefined();
  });

  describe('stop wakes the runner (O3 part 1 review)', () => {
    const never = () => new Promise<void>(() => {});

    it('returns on cancel while sync ignores its abort signal', async () => {
      const host = new RecordingHost();
      const startedAt = Date.now();
      const result = await runKnowledgeImport({
        definitions: [
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
        definitions: [importer(async ctx => ctx.items.upsert(item(1)))],
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
        definitions: [importer(async ctx => ctx.items.upsert(item(1)))],
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
        definitions: [
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
