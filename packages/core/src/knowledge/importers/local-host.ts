import { randomUUID } from 'node:crypto';
import type { KnowledgeStorage } from '../../storage/domains/knowledge/base';
import { KnowledgeImporterRunStateError } from '../../storage/domains/knowledge/importers';
import type { KnowledgeImportersStorage, KnowledgeImporterRunRecord } from '../../storage/domains/knowledge/importers';
import type { KnowledgeHostWriter } from '../host-writes';
import { KnowledgeImporterHostError } from './define';
import {
  KnowledgeImporterHostConflictError,
  canonicalJson,
  knowledgeImporterFlushDigest,
  normalizeKnowledgeImporterFinish,
  parseKnowledgeImporterFlushBody,
} from './host';
import type {
  KnowledgeImporterHost,
  KnowledgeImporterRunBinding,
  KnowledgeImporterRunStart,
  KnowledgeImporterStartRunOptions,
  NormalizedKnowledgeImporterFinish,
} from './host';
import { applyKnowledgeImportFlush, knowledgeImportTargetsOverlap, parseKnowledgeImportTarget } from './sink';
import type { KnowledgeImportEmbedJob } from './sink';
import type {
  KnowledgeImportCounts,
  KnowledgeImporterFinishRequest,
  KnowledgeImporterFlush,
  KnowledgeImporterFlushReceipt,
  KnowledgeImporterRunReceipt,
} from './types';

/** @experimental */
export interface LocalKnowledgeImporterHostOptions {
  /**
   * The bindings this host applies flushes for: a list, or a function read at each run start, so a
   * host that keeps bindings in its own config picks up changes without a new host.
   */
  bindings: readonly KnowledgeImporterRunBinding[] | (() => Promise<readonly KnowledgeImporterRunBinding[]>);
  /** Recorded as the writer of imported pages. Default `importer:<bindingId>`. */
  author?: (binding: KnowledgeImporterRunBinding) => string;
  /**
   * How long one flush may spend in its transaction, from the wait for a connection to the last
   * statement, before it rolls back and the runner resends it. Also capped by the run's deadline.
   * Enforced only on stores with `enforcesTransactionDeadline` (PostgreSQL); COMMIT itself isn't
   * bounded. Default 45 seconds, under the runner's 60-second host-call timeout.
   */
  flushBudgetMs?: number;
  /**
   * A running run whose last heartbeat (or start, before its first) is older than this is taken
   * to have lost its runner: the next start of its binding ends it as `failed` (`stopped`) and
   * starts. A run past its deadline is reclaimed the same way. Default 5 minutes.
   */
  staleRunAfterMs?: number;
  /**
   * Wall-clock budget for one flush's settle slice; it stops before the next node once this has
   * passed. Default 10 seconds, well inside `flushBudgetMs`. Settle work is also capped at 200
   * nodes examined and 50 moves per flush.
   */
  settleBudgetMs?: number;
}

const DEFAULT_FLUSH_BUDGET_MS = 45_000;
const DEFAULT_STALE_RUN_AFTER_MS = 5 * 60_000;
const DEFAULT_SETTLE_BUDGET_MS = 10_000;
const SETTLE_CANDIDATES = 200;
const SETTLE_MOVES = 50;
/** Settle flushes in a row that may time out before a run stops settling (O3 §C″). */
const SETTLE_MAX_TIMEOUTS = 3;

/**
 * Host bookkeeping kept beside the importer's own state, under a prefix the importer can't write:
 * where the settle pass stopped, and `<runId>:<n>` settle timeouts in a row for the current run.
 */
const RESERVED_STATE_PREFIX = 'mastra:';
const SETTLE_CURSOR_KEY = 'mastra:settle:cursor';
const SETTLE_TIMEOUTS_KEY = 'mastra:settle:timeouts';

const settleTimeouts = (state: Record<string, string>, runId: string): number => {
  const value = state[SETTLE_TIMEOUTS_KEY] ?? '';
  const at = value.lastIndexOf(':');
  return at > 0 && value.slice(0, at) === runId ? Number(value.slice(at + 1)) || 0 : 0;
};

const SETTLE_TIMEOUT_RECORD_MS = 5_000;

const timedOut = (error: unknown): boolean => {
  const e = error as { name?: string; code?: string; cause?: unknown } | undefined;
  if (!e) return false;
  if (e.name === 'KnowledgeTransactionDeadlineError' || e.name === 'TransactionDeadlineError') return true;
  if (e.code === '57014' || e.code === '55P03') return true;
  return e.cause !== undefined && e.cause !== error && timedOut(e.cause);
};
/** Re-index rounds after a page changed under its embed; a page rewritten faster than this is left to its own writes' jobs. */
const MAX_REINDEX_ROUNDS = 3;

const conflict = (code: KnowledgeImporterHostConflictError['code'], message: string) =>
  new KnowledgeImporterHostConflictError(code, message);

/** O2 run-state refusals as the host contract names them. */
function runStateConflict(error: KnowledgeImporterRunStateError): KnowledgeImporterHostConflictError {
  switch (error.reason) {
    case 'seq':
      return conflict('seq_mismatch', 'The flush seq is not the committed seq + 1.');
    case 'generation':
    case 'stale_guard':
      return conflict('stale_generation', 'The run belongs to an older writer generation.');
    default:
      return conflict('run_not_active', 'The run is not running.');
  }
}

/** Failures a resend can get past: lock and serialization aborts, deadlines, lost connections. */
function transient(error: unknown): boolean {
  const e = error as { name?: string; code?: string } | undefined;
  return (
    e?.name === 'KnowledgeTransactionDeadlineError' ||
    e?.name === 'TransactionRolledBackError' ||
    ['40001', '40P01', '55P03', '57014', '08006', '08003', 'SQLITE_BUSY', 'ECONNRESET'].includes(e?.code ?? '')
  );
}

function hostError(error: unknown): unknown {
  if (error instanceof KnowledgeImporterHostConflictError || error instanceof KnowledgeImporterHostError) return error;
  if (error instanceof KnowledgeImporterRunStateError) return runStateConflict(error);
  const failure = new KnowledgeImporterHostError(
    'The importer host could not apply the request; nothing was applied.',
    transient(error) ? 503 : 422,
  );
  (failure as { cause?: unknown }).cause = error;
  return failure;
}

const receiptCounts = (counts: Record<string, number>): KnowledgeImportCounts => ({
  created: counts.created ?? 0,
  updated: counts.updated ?? 0,
  unchanged: counts.unchanged ?? 0,
  moved: counts.moved ?? 0,
  removed: counts.removed ?? 0,
  stubbed: counts.stubbed ?? 0,
  refused: counts.refused ?? 0,
});

/** A run's stored finish: the normalized request, compared on replay, and the host's chaining decision. */
type StoredFinish = NormalizedKnowledgeImporterFinish & { chain: boolean };

const runReceipt = (run: KnowledgeImporterRunRecord): KnowledgeImporterRunReceipt => {
  const { chain, ...finish } = run.finish as StoredFinish;
  return { runId: run.id, ...finish, counts: receiptCounts(run.counts), chain: chain ?? false };
};

const withoutChain = (finish: unknown) => {
  const { chain: _chain, ...rest } = finish as StoredFinish;
  return rest;
};

/**
 * A {@link KnowledgeImporterHost} over the app's own Knowledge storage: each flush is one storage
 * transaction holding its page writes, node map, state, run changes and receipt. Embeds run after
 * commit; a failed embed is a warning and never fails the flush.
 *
 * @internal Reached through `Knowledge`; the writer is Knowledge's own.
 */
export function createLocalKnowledgeImporterHost(
  writer: KnowledgeHostWriter,
  options: LocalKnowledgeImporterHostOptions,
): KnowledgeImporterHost {
  const author = options.author ?? (binding => `importer:${binding.id}`);
  const listBindings = async () =>
    typeof options.bindings === 'function' ? await options.bindings() : options.bindings;

  const storageAndImporters = async (): Promise<{
    storage: KnowledgeStorage;
    importers: KnowledgeImportersStorage;
  }> => {
    const storage = await writer.getStorage();
    const importers = storage.importers;
    if (!importers || !storage.getCapabilities().supportsTransactions) {
      throw new KnowledgeImporterHostError('This Knowledge storage adapter does not support importers.', 501);
    }
    return { storage, importers };
  };

  const bindingFor = async (bindingId: string) => {
    const bindings = await listBindings();
    const binding = bindings.find(b => b.id === bindingId);
    if (!binding) throw new KnowledgeImporterHostError(`No importer binding "${bindingId}".`, 404);
    return { binding, bindings };
  };

  const runEmbeds = async (storage: KnowledgeStorage, jobs: KnowledgeImportEmbedJob[]) => {
    const semantic = writer.semantic;
    if (!semantic) return;
    for (const job of jobs) {
      try {
        if (job.kind === 'remove') {
          await semantic.removePage(job.pageId);
          continue;
        }
        // Vector stores have no compare-and-set, so an embed of an older version can publish after a
        // newer write's. Re-read after publishing and index again while the page moved on (O3 §E″).
        let indexed = 0;
        for (let round = 0; round < MAX_REINDEX_ROUNDS; round++) {
          const page = await storage.getPage({ id: job.pageId, read: 'all' });
          if (!page || page.deletedAt || page.version <= indexed) break;
          await semantic.indexPage(page);
          indexed = page.version;
        }
      } catch (error) {
        writer.warn(`Knowledge importer: indexing page ${job.pageId} failed after commit: ${String(error)}`);
      }
    }
  };

  /**
   * Ends the binding's running run when its runner is gone (O3 §D): past its deadline, or no
   * heartbeat within `staleRunAfterMs`. Called under the exclusive writer guard; the run row is
   * locked and rechecked so a heartbeat that commits first keeps it alive. Its runner's later
   * flushes and finish are refused as `run_not_active`; exact replays still return receipts.
   */
  const reclaimStaleRuns = async (importers: KnowledgeImportersStorage, bindingId: string) => {
    const staleAfter = options.staleRunAfterMs ?? DEFAULT_STALE_RUN_AFTER_MS;
    for (const candidate of await importers.listRuns(bindingId)) {
      if (candidate.status !== 'running') continue;
      const run = await importers.lockRun(candidate.id);
      if (!run || run.status !== 'running') continue;
      const now = Date.now();
      const lastSign = (run.heartbeatAt ?? run.startedAt).getTime();
      const pastDeadline = run.deadlineAt !== null && run.deadlineAt.getTime() <= now;
      if (!pastDeadline && now - lastSign < staleAfter) continue;
      await importers.abandonRun({
        runId: run.id,
        finish: {
          ...normalizeKnowledgeImporterFinish({
            runId: run.id,
            generation: run.generation,
            outcome: 'failed',
            backlog: false,
            lastSeq: run.lastSeq,
            error: { code: 'stopped', retryable: true },
          }),
          chain: false,
        } satisfies StoredFinish,
      });
    }
  };

  /** Counts a settle flush that timed out, outside its rolled-back transaction. Best effort. */
  const countSettleTimeout = async (runId: string) => {
    try {
      const { storage } = await storageAndImporters();
      await storage.transaction(
        async tx => {
          const importers = tx.importers!;
          await importers.lockWriterGuard('share');
          const run = await importers.lockRun(runId);
          if (!run || run.status !== 'running') return;
          const n = settleTimeouts(await importers.getState(run.bindingId), runId) + 1;
          await importers.setState(run.bindingId, { [SETTLE_TIMEOUTS_KEY]: `${runId}:${n}` });
          // Bounded: the flush already ran out of time, and the reply shouldn't wait on another lock.
        },
        { deadlineAt: Date.now() + SETTLE_TIMEOUT_RECORD_MS },
      );
    } catch (error) {
      writer.warn(`Knowledge importer: recording a settle timeout for run ${runId} failed: ${String(error)}`);
    }
  };

  return {
    async startRun(bindingId: string, start?: KnowledgeImporterStartRunOptions): Promise<KnowledgeImporterRunStart> {
      const { binding, bindings } = await bindingFor(bindingId);
      try {
        const { scope } = parseKnowledgeImportTarget(binding.target);
        const { storage } = await storageAndImporters();
        await writer.runtime.resolve();
        await writer.runtime.materializeScope(scope, [], { author: author(binding) });
        const others = bindings.filter(b => b.id !== binding.id);
        const overlapping = others.find(b => knowledgeImportTargetsOverlap(b.target, binding.target));
        if (overlapping) {
          throw new KnowledgeImporterHostError(
            `Importer binding "${binding.id}" overlaps binding "${overlapping.id}"; their targets must not nest.`,
            409,
          );
        }
        const result = await storage.transaction(async tx => {
          const importers = tx.importers!;
          // Registration and the overlap check against stored bindings happen under one lock.
          const guard = await importers.lockWriterGuard('update');
          const stored = (await importers.listBindings()).find(
            b => b.id !== binding.id && knowledgeImportTargetsOverlap(b.target, binding.target),
          );
          if (stored) {
            throw new KnowledgeImporterHostError(
              `Importer binding "${binding.id}" overlaps binding "${stored.id}"; their targets must not nest.`,
              409,
            );
          }
          await importers.registerBinding({ id: binding.id, importer: binding.importer, target: binding.target });
          await reclaimStaleRuns(importers, binding.id);
          const run = await importers.startRun({
            bindingId: binding.id,
            runId: start?.runId ?? randomUUID(),
            generation: guard.generation,
            ...(start?.fireKey !== undefined ? { fireKey: start.fireKey } : {}),
            ...(start?.deadline !== undefined ? { deadlineAt: new Date(start.deadline) } : {}),
          });
          const saved: Record<string, string> = run.status === 'started' ? await importers.getState(binding.id) : {};
          const state: Record<string, string> = Object.fromEntries(
            Object.entries(saved).filter(([key]) => !key.startsWith(RESERVED_STATE_PREFIX)),
          );
          return { run, state };
        });
        if (result.run.status !== 'started') return { status: 'skipped', runId: result.run.run.id };
        return {
          status: 'started',
          runId: result.run.run.id,
          generation: result.run.run.generation,
          state: result.state,
          lastSeq: result.run.run.lastSeq,
          binding,
        };
      } catch (error) {
        if ((error as Error | undefined)?.name === 'KnowledgeImporterBindingConflictError') {
          throw new KnowledgeImporterHostError(
            `Importer binding "${binding.id}" was recorded with another importer or target.`,
            409,
          );
        }
        if (error instanceof TypeError) throw new KnowledgeImporterHostError(error.message, 400);
        throw hostError(error);
      }
    },

    async flush(flush: KnowledgeImporterFlush): Promise<KnowledgeImporterFlushReceipt> {
      let body: ReturnType<typeof parseKnowledgeImporterFlushBody>;
      try {
        body = parseKnowledgeImporterFlushBody(flush);
      } catch (error) {
        throw new KnowledgeImporterHostError(`Malformed flush: ${(error as Error).message}`, 400);
      }
      const reserved = Object.keys(body.state ?? {}).find(key => key.startsWith(RESERVED_STATE_PREFIX));
      if (reserved !== undefined) {
        throw new KnowledgeImporterHostError(`Malformed flush: state key "${reserved}" is reserved for the host.`, 400);
      }
      const digest = await knowledgeImporterFlushDigest(body);
      if (digest !== flush.digest) throw conflict('digest_mismatch', 'The digest does not match the flush content.');

      const { storage, importers: rootImporters } = await storageAndImporters();
      const flushStarted = Date.now();
      const budgetAt = flushStarted + (options.flushBudgetMs ?? DEFAULT_FLUSH_BUDGET_MS);
      // A committed receipt never changes, so its replay must not depend on the run still being live:
      // a lost ack is resent after the run's deadline or after it finished. Look it up first, bounded by
      // the flush budget alone.
      const replayed = await storage
        .transaction(tx => tx.importers!.getFlush(flush.runId, flush.generation, flush.seq), { deadlineAt: budgetAt })
        .catch(error => {
          throw hostError(error);
        });
      if (replayed) {
        if (replayed.digest !== digest) throw conflict('digest_mismatch', 'This seq was committed with other content.');
        return replayed.receipt as KnowledgeImporterFlushReceipt;
      }
      const [peek, peekRun] = await Promise.all([
        rootImporters.readWriterGuard(),
        rootImporters.getRun(flush.runId),
      ]).catch(error => {
        throw hostError(error);
      });
      if (peekRun?.deadlineAt && peekRun.deadlineAt.getTime() <= Date.now()) {
        throw conflict('run_not_active', 'The run is past its deadline.');
      }
      // Resolved before the transaction, since a bindings function may do its own I/O, but only
      // surfaced once the locked checks below find new work: a concurrent identical flush may commit
      // meanwhile, and its replay must not depend on the bindings function.
      const resolvedAuthor: { author: string } | { error: unknown } = peekRun
        ? await bindingFor(peekRun.bindingId)
            .then(({ binding }) => ({ author: author(binding) }))
            .catch((error: unknown) => ({ error }))
        : { error: conflict('run_not_active', 'The run is not running.') };
      // One absolute deadline for the whole write transaction (O3 §C‴), capped by the run's.
      const deadlineAt = Math.min(budgetAt, peekRun?.deadlineAt?.getTime() ?? Infinity);
      let embeds: KnowledgeImportEmbedJob[] = [];
      // Only a timeout after the settle slice started counts against settling (O3 §C″).
      let settling = false;
      try {
        const receipt = await storage.transaction(
          async tx => {
            const importers = tx.importers!;
            // Guard before run (O2 lock order); exclusive only until the first write is marked.
            const guard = await importers.lockWriterGuard(peek.firstWriteAt ? 'share' : 'update');
            const run = await importers.lockRun(flush.runId);
            const stored = await importers.getFlush(flush.runId, flush.generation, flush.seq);
            if (stored) {
              if (stored.digest !== digest) {
                throw conflict('digest_mismatch', 'This seq was committed with other content.');
              }
              return stored.receipt as KnowledgeImporterFlushReceipt;
            }
            if (!run || run.status !== 'running') throw conflict('run_not_active', 'The run is not running.');
            if (run.generation !== flush.generation || guard.generation !== flush.generation) {
              throw conflict('stale_generation', 'The run belongs to an older writer generation.');
            }
            if (run.cancelRequestedAt) throw conflict('run_not_active', 'The run was canceled.');
            if (run.deadlineAt && run.deadlineAt.getTime() <= Date.now()) {
              throw conflict('run_not_active', 'The run is past its deadline.');
            }
            if (flush.seq !== run.lastSeq + 1)
              throw conflict('seq_mismatch', 'The flush seq is not the committed seq + 1.');

            if ('error' in resolvedAuthor) throw resolvedAuthor.error;
            const binding = await importers.getBinding(run.bindingId);
            if (!binding) throw conflict('run_not_active', 'The run has no binding.');
            const [scope] = await tx.getScopesByAddress([parseKnowledgeImportTarget(binding.target).scope]);
            if (!scope) throw new KnowledgeImporterHostError('The binding target scope does not exist.', 503);
            const hostState = await importers.getState(binding.id);
            const timeouts = settleTimeouts(hostState, run.id);
            const applied = await applyKnowledgeImportFlush({
              storage: tx,
              importers,
              binding,
              scope,
              runId: run.id,
              ops: body.ops,
              provenance: { author: resolvedAuthor.author },
              // After a settle slice timed out, the next uses half as many nodes; after three in a
              // row the run stops settling (O3 §C″).
              ...(timeouts < SETTLE_MAX_TIMEOUTS
                ? {
                    settle: {
                      after: hostState[SETTLE_CURSOR_KEY] || null,
                      candidates: Math.max(1, SETTLE_CANDIDATES >> timeouts),
                      moves: SETTLE_MOVES,
                      until: Math.min(Date.now() + (options.settleBudgetMs ?? DEFAULT_SETTLE_BUDGET_MS), deadlineAt),
                      onStart: () => {
                        settling = true;
                      },
                    },
                  }
                : {}),
            });
            const settled = applied.settle;
            const hostUpdates: Record<string, string> = {};
            if (settled && (settled.cursor ?? '') !== (hostState[SETTLE_CURSOR_KEY] ?? '')) {
              hostUpdates[SETTLE_CURSOR_KEY] = settled.cursor ?? '';
            }
            if (timeouts > 0 && timeouts < SETTLE_MAX_TIMEOUTS) hostUpdates[SETTLE_TIMEOUTS_KEY] = '';
            const state = { ...body.state, ...hostUpdates };
            if (Object.keys(state).length) await importers.setState(binding.id, state);
            for (const change of applied.changes) await importers.recordRunChange({ runId: run.id, ...change });
            const receipt: KnowledgeImporterFlushReceipt = {
              seq: flush.seq,
              ...applied.counts,
              refused: applied.refused,
              pending: settled?.pending ?? false,
            };
            await importers.recordFlush({
              runId: run.id,
              generation: flush.generation,
              seq: flush.seq,
              digest,
              receipt,
              counts: { ...applied.counts, refused: applied.refused.length, settled: settled?.settled ?? 0 },
            });
            if (applied.applied && !guard.firstWriteAt) await importers.markFirstWrite();
            embeds = applied.embeds;
            return receipt;
          },
          { deadlineAt },
        );
        await runEmbeds(storage, embeds);
        return receipt;
      } catch (error) {
        if (settling && timedOut(error)) await countSettleTimeout(flush.runId);
        throw hostError(error);
      }
    },

    async heartbeat(runId: string, generation: number): Promise<{ cancel: boolean }> {
      try {
        const { importers } = await storageAndImporters();
        const run = await importers.heartbeat(runId);
        return { cancel: !run || run.generation !== generation || run.cancelRequestedAt !== null };
      } catch (error) {
        throw hostError(error);
      }
    },

    async finishRun(request: KnowledgeImporterFinishRequest): Promise<KnowledgeImporterRunReceipt> {
      let normalized: NormalizedKnowledgeImporterFinish;
      try {
        normalized = normalizeKnowledgeImporterFinish(request);
      } catch (error) {
        throw new KnowledgeImporterHostError(`Malformed finish: ${(error as Error).message}`, 400);
      }
      const { storage } = await storageAndImporters();
      try {
        return await storage.transaction(async tx => {
          const importers = tx.importers!;
          const guard = await importers.lockWriterGuard('share');
          const run = await importers.lockRun(request.runId);
          if (!run) throw conflict('run_not_active', 'No such run.');
          if (run.finish !== null) {
            if (
              run.generation === request.generation &&
              canonicalJson(withoutChain(run.finish)) === canonicalJson(normalized)
            ) {
              return runReceipt(run);
            }
            throw conflict('finish_mismatch', 'The run already finished differently.');
          }
          if (run.status !== 'running') throw conflict('run_not_active', 'The run is not running.');
          if (run.generation !== request.generation || guard.generation !== request.generation) {
            throw conflict('stale_generation', 'The run belongs to an older writer generation.');
          }
          if (run.lastSeq !== request.lastSeq) throw conflict('seq_mismatch', 'lastSeq is not the committed seq.');
          // Chain on settle work left only when this run's settling made progress and didn't give up,
          // so a parent that never arrives can't chain runs forever (O3 §C′).
          const last = run.lastSeq > 0 ? await importers.getFlush(run.id, run.generation, run.lastSeq) : null;
          const pending = (last?.receipt as KnowledgeImporterFlushReceipt | undefined)?.pending === true;
          const binding = await importers.getBinding(run.bindingId);
          const gaveUp =
            !!binding && settleTimeouts(await importers.getState(binding.id), run.id) >= SETTLE_MAX_TIMEOUTS;
          const chain =
            normalized.backlog ||
            (normalized.outcome === 'succeeded' && pending && !gaveUp && (run.counts.settled ?? 0) > 0);
          const finished = await importers.finishRun({
            runId: run.id,
            generation: request.generation,
            lastSeq: request.lastSeq,
            status: normalized.outcome,
            finish: { ...normalized, chain } satisfies StoredFinish,
          });
          return runReceipt(finished);
        });
      } catch (error) {
        throw hostError(error);
      }
    },
  };
}
