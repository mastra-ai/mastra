import { randomUUID } from 'node:crypto';
import type { KnowledgeStorage } from '../../storage/domains/knowledge/base';
import { KnowledgeImporterRunStateError } from '../../storage/domains/knowledge/importers';
import type {
  KnowledgeImportersStorage,
  KnowledgeImporterRunRecord,
  KnowledgeImporterRunStatus,
} from '../../storage/domains/knowledge/importers';
import { unwrapKnowledgeStorage } from '../changes';
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
import {
  applyKnowledgeImportFlush,
  KNOWLEDGE_IMPORT_SETTLE_RESTART_KEY,
  KNOWLEDGE_IMPORT_SETTLE_SEEN_KEY,
  parseKnowledgeImportTarget,
} from './sink';
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
  /**
   * Strict liveness for a host whose runners live elsewhere (r352 S1). A run is live only while
   * `store.now() < (heartbeatAt ?? startedAt) + leaseMs` and before its deadline, by the store's
   * clock; a heartbeat, a new flush or a finish that finds it otherwise is refused as
   * `run_not_active` and writes nothing, and a lapsed run is never revived. Each flush transaction
   * is cut off at the lease end too. Replaces `staleRunAfterMs`. Unset: the in-process rules
   * (`staleRunAfterMs` reclaim at the next start).
   */
  leaseMs?: number;
}

/** Start options of a service host: a claim admitted in the run's start transaction (r352 S4). @experimental */
export interface KnowledgeImporterServiceStartOptions extends KnowledgeImporterStartRunOptions {
  /**
   * The writer generation the claim was issued for. The start is refused (`stale_generation`)
   * unless it is the current one and the active write path is `'new'`.
   */
  generation?: number;
  /**
   * Called inside the start transaction, under the writer guard and before the scope is
   * materialized and the run row written, with the transaction-bound storage. Throw to refuse the
   * start: everything rolls back, the caller's own writes through `tx` included. A start that
   * finds another run of the binding going rolls back the same way and reports `skipped`.
   */
  admit?: (tx: KnowledgeStorage) => Promise<void>;
}

/**
 * A {@link KnowledgeImporterHost} for a service that applies flushes for runners elsewhere: it can
 * also cancel runs and end those whose lease or deadline passed. @experimental
 */
export interface KnowledgeImporterServiceHost extends KnowledgeImporterHost {
  startRun(bindingId: string, options?: KnowledgeImporterServiceStartOptions): Promise<KnowledgeImporterRunStart>;
  /**
   * Asks a running run to stop: its heartbeat answers `cancel: true` and its new flushes are
   * refused. A finish admitted afterwards is recorded as canceled. No-op on an ended run.
   */
  requestCancel(runId: string): Promise<{ status: KnowledgeImporterRunStatus } | null>;
  /**
   * Ends every running run past its lease (`leaseMs`, else `staleRunAfterMs`) or deadline, by the
   * store's clock: `canceled` when a cancel was requested, otherwise `failed` with
   * `lease_expired` or `deadline_exceeded`. Safe to call from a schedule and from several workers.
   */
  expireRuns(): Promise<{ expired: string[] }>;
  /**
   * Forgets a binding the app deleted: its tracking, cursor state and runs. Its pages stay where
   * they are as ordinary pages; nothing reserves its target, so any binding can write there next,
   * taking over the pages it finds at its items' paths. A run of it still going is refused at its
   * next flush. No-op for a binding that was never stored.
   */
  retireBinding(bindingId: string): Promise<void>;
  /**
   * A run's status and, once it ended, the receipt its finish stored (the app's, or the host's for a
   * run it ended), with the chaining decision schedulers act on. Null for an unknown run. An ended run
   * with no stored finish reads as `receipt: null`; this host always stores one, so that is for a host
   * that ends runs itself.
   */
  readRun(
    runId: string,
  ): Promise<{ status: KnowledgeImporterRunStatus; receipt: KnowledgeImporterRunReceipt | null } | null>;
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
 * where the settle pass stopped, `<runId>:<n>` settle timeouts in a row for the current run, and
 * the restart request another binding's flush left (see {@link KNOWLEDGE_IMPORT_SETTLE_RESTART_KEY}).
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

/** Unwinds a claimed start's transaction when another run of the binding is going (r352 S4). */
class SkippedClaim extends Error {
  constructor(readonly runId: string) {
    super('Another run of the binding is going.');
  }
}

/**
 * Unwinds a transaction that holds the writer guard shared but found `firstWriteAt` unset where it
 * must mark it: marking under a shared lock can deadlock against another holder, so the work is
 * redone holding it exclusively (O2 lock preselection).
 */
class NeedsExclusiveGuard extends Error {
  constructor() {
    super('The first write must be marked under the exclusive writer guard.');
  }
}

/**
 * Unwinds a flush whose transaction deadline runs past where its run stops being live (r352 S1):
 * it is redone with `cutoff` as its deadline.
 */
class LeaseCutoff extends Error {
  constructor(readonly cutoff: number) {
    super('The flush transaction outlives its run lease.');
  }
}

/** Attempts to bound a flush by its run's lease before it is refused as retryable. */
const MAX_LEASE_BOUND_ATTEMPTS = 3;
/**
 * Taken off a redone flush's cutoff, so that a slower read of the store's clock on the next
 * attempt, which maps it earlier, doesn't unwind it again.
 */
const LEASE_CUTOFF_MARGIN_MS = 250;

/**
 * The local time (epoch ms) by which the store's clock reaches `end`. The local clock is read
 * before the store's, so the round trip only moves the result earlier, never later.
 */
async function localTimeOf(importers: KnowledgeImportersStorage, end: number): Promise<number> {
  const anchor = Date.now();
  const storeNow = (await importers.now()).getTime();
  return anchor + (end - storeNow);
}

/** Carries `admit`'s own error out of the start transaction it rolled back. */
class AdmitRefusal extends Error {
  constructor(readonly refusal: unknown) {
    super('The claim was refused.');
  }
}

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

/**
 * A run's stored finish: the normalized request, compared on replay, and the host's chaining
 * decision. `by: 'host'` marks a run the host ended (no app finish is accepted for it), and
 * `canceled` a finish admitted after a cancel, recorded as canceled whatever it reported.
 */
type StoredFinish = NormalizedKnowledgeImporterFinish & { chain: boolean; by?: 'host'; canceled?: true };

const runReceipt = (run: KnowledgeImporterRunRecord): KnowledgeImporterRunReceipt => {
  const { chain, by: _by, canceled, ...finish } = run.finish as StoredFinish;
  const reported = canceled ? { outcome: 'canceled' as const, backlog: false, error: null } : {};
  return { runId: run.id, ...finish, ...reported, counts: receiptCounts(run.counts), chain: chain ?? false };
};

/** The app's normalized request a stored finish replays against. */
const replayIdentity = (finish: unknown) => {
  const { chain: _chain, by: _by, canceled: _canceled, ...rest } = finish as StoredFinish;
  return rest;
};

/** The finish a host records for a run it ended (r352 S2/S3). */
const hostFinish = (
  run: KnowledgeImporterRunRecord,
  code: 'stopped' | 'lease_expired' | 'deadline_exceeded',
): StoredFinish => {
  const canceled = run.cancelRequestedAt !== null;
  return {
    ...normalizeKnowledgeImporterFinish({
      runId: run.id,
      generation: run.generation,
      outcome: canceled ? 'canceled' : 'failed',
      backlog: false,
      lastSeq: run.lastSeq,
      ...(canceled ? {} : { error: { code, retryable: true } }),
    }),
    chain: false,
    by: 'host',
  };
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
): KnowledgeImporterServiceHost {
  const author = options.author ?? (binding => `importer:${binding.id}`);
  const leaseMs = options.leaseMs;
  /** The clock leases are judged by: the store's under `leaseMs`, else this process's. */
  const clock = async (importers: KnowledgeImportersStorage) => (leaseMs !== undefined ? importers.now() : new Date());
  /** Why a running run is no longer live at `now`, or null while it is. */
  const lapsed = (
    run: KnowledgeImporterRunRecord,
    now: Date,
    after = leaseMs,
  ): 'lease_expired' | 'deadline_exceeded' | null => {
    if (run.deadlineAt && run.deadlineAt.getTime() <= now.getTime()) return 'deadline_exceeded';
    if (after !== undefined && now.getTime() >= (run.heartbeatAt ?? run.startedAt).getTime() + after) {
      return 'lease_expired';
    }
    return null;
  };
  /** Store time (epoch ms) at which a running run stops being live under `leaseMs`. */
  const liveUntil = (run: KnowledgeImporterRunRecord) =>
    Math.min(
      (run.heartbeatAt ?? run.startedAt).getTime() + (leaseMs ?? Infinity),
      run.deadlineAt?.getTime() ?? Infinity,
    );
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
    return binding;
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
   * heartbeat within `staleRunAfterMs`. Called under the writer guard and registration lock; the run row is
   * locked and rechecked so a heartbeat that commits first keeps it alive. Its runner's later
   * flushes and finish are refused as `run_not_active`; exact replays still return receipts.
   */
  const staleAfter = leaseMs ?? options.staleRunAfterMs ?? DEFAULT_STALE_RUN_AFTER_MS;
  /** Ends `run` if it isn't live; the caller holds the guard and the run's lock. */
  const expireLocked = async (importers: KnowledgeImportersStorage, run: KnowledgeImporterRunRecord) => {
    const why = lapsed(run, await clock(importers), staleAfter);
    if (!why) return false;
    // In-process hosts keep their `stopped` code; a service host says why it ended the run.
    const finish = hostFinish(run, leaseMs !== undefined ? why : 'stopped');
    await importers.abandonRun({
      runId: run.id,
      finish,
      status: finish.outcome === 'canceled' ? 'canceled' : 'failed',
    });
    return true;
  };
  const reclaimStaleRuns = async (importers: KnowledgeImportersStorage, bindingId: string) => {
    for (const candidate of await importers.listRuns(bindingId)) {
      if (candidate.status !== 'running') continue;
      const run = await importers.lockRun(candidate.id);
      if (!run || run.status !== 'running') continue;
      await expireLocked(importers, run);
    }
  };

  /**
   * Counts a settle flush that timed out, outside its rolled-back transaction. Best effort, and
   * only for a run still live by the same checks a flush passes: same generation, not canceled, not
   * past its lease or deadline. Under a lease the write is also bounded by where the locked run
   * stops being live, so a timeout caused by the lease ending never writes after it.
   */
  const countSettleTimeout = async (runId: string, generation: number) => {
    try {
      const { storage } = await storageAndImporters();
      const fenced = leaseMs !== undefined && storage.getCapabilities().enforcesTransactionDeadline === true;
      // Bounded: the flush already ran out of time, and the reply shouldn't wait on another lock.
      let deadlineAt = Date.now() + SETTLE_TIMEOUT_RECORD_MS;
      for (let attempt = 1; attempt <= MAX_LEASE_BOUND_ATTEMPTS; attempt++) {
        try {
          await storage.transaction(
            async tx => {
              const importers = tx.importers!;
              const guard = await importers.lockWriterGuard('share');
              const run = await importers.lockRun(runId);
              if (!run || run.status !== 'running' || run.cancelRequestedAt) return;
              if (run.generation !== generation || guard.generation !== generation) return;
              if (lapsed(run, await clock(importers))) return;
              if (fenced) {
                const cutoff = await localTimeOf(importers, liveUntil(run));
                if (cutoff < deadlineAt) throw new LeaseCutoff(cutoff);
              }
              const n = settleTimeouts(await importers.getState(run.bindingId), runId) + 1;
              await importers.setState(run.bindingId, { [SETTLE_TIMEOUTS_KEY]: `${runId}:${n}` });
            },
            { deadlineAt },
          );
          return;
        } catch (error) {
          if (!(error instanceof LeaseCutoff)) throw error;
          deadlineAt = error.cutoff - LEASE_CUTOFF_MARGIN_MS;
          if (deadlineAt <= Date.now()) return;
        }
      }
    } catch (error) {
      writer.warn(`Knowledge importer: recording a settle timeout for run ${runId} failed: ${String(error)}`);
    }
  };

  return {
    async startRun(
      bindingId: string,
      start?: KnowledgeImporterServiceStartOptions,
    ): Promise<KnowledgeImporterRunStart> {
      const binding = await bindingFor(bindingId);
      const runId = start?.runId ?? randomUUID();
      const claimed = start?.admit !== undefined || start?.generation !== undefined;
      try {
        const { scope } = parseKnowledgeImportTarget(binding.target);
        const { storage, importers: rootImporters } = await storageAndImporters();
        // O2 preselection: exclusive only until the first write is marked, chosen before locking.
        let exclusive = !(await rootImporters.readWriterGuard()).firstWriteAt;
        // Declarations are read now: inside the transaction the scope is materialized through it alone.
        await writer.runtime.resolve();
        const attempt = () =>
          storage.transaction(async tx => {
            const importers = tx.importers!;
            const guard = await importers.lockWriterGuard(exclusive ? 'update' : 'share');
            if (
              claimed &&
              (guard.activePath !== 'new' || (start?.generation !== undefined && guard.generation !== start.generation))
            ) {
              throw conflict('stale_generation', 'The claim belongs to another writer generation or write path.');
            }
            await importers.registerBinding({ id: binding.id, importer: binding.importer, target: binding.target });
            await reclaimStaleRuns(importers, binding.id);
            // r352 S4: the claim, the scope and the run row commit together or not at all.
            if (start?.admit) {
              try {
                // The adapter's own view: its transaction helpers find it by identity.
                await start.admit(unwrapKnowledgeStorage(tx));
              } catch (error) {
                throw new AdmitRefusal(error);
              }
            }
            const { wrote } = await writer.runtime.materializeScopeIn(tx, scope, { author: author(binding) });
            if (wrote && !guard.firstWriteAt) {
              if (!exclusive) throw new NeedsExclusiveGuard();
              await importers.markFirstWrite();
            }
            const run = await importers.startRun({
              bindingId: binding.id,
              runId,
              generation: guard.generation,
              ...(start?.fireKey !== undefined ? { fireKey: start.fireKey } : {}),
              ...(start?.deadline !== undefined ? { deadlineAt: new Date(start.deadline) } : {}),
            });
            if (run.status !== 'started' && start?.admit) throw new SkippedClaim(run.run.id);
            const saved: Record<string, string> = run.status === 'started' ? await importers.getState(binding.id) : {};
            const state: Record<string, string> = Object.fromEntries(
              Object.entries(saved).filter(([key]) => !key.startsWith(RESERVED_STATE_PREFIX)),
            );
            return { run, state };
          });
        let result: Awaited<ReturnType<typeof attempt>>;
        try {
          result = await attempt();
        } catch (error) {
          if (!(error instanceof NeedsExclusiveGuard)) throw error;
          // The first write was cleared since it was read (a reset or a writer-generation advance):
          // redo the start, `admit` included, under the exclusive guard.
          exclusive = true;
          result = await attempt();
        }
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
        if (error instanceof SkippedClaim) return { status: 'skipped', runId: error.runId };
        if ((error as Error | undefined)?.name === 'KnowledgeImporterBindingConflictError') {
          throw new KnowledgeImporterHostError(
            `Importer binding "${binding.id}" was recorded with another importer or target.`,
            409,
          );
        }
        if (error instanceof TypeError) throw new KnowledgeImporterHostError(error.message, 400);
        // The caller's own refusal reaches it unchanged, not as a storage failure.
        if (error instanceof AdmitRefusal) throw error.refusal;
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
      if (leaseMs === undefined && peekRun?.deadlineAt && peekRun.deadlineAt.getTime() <= Date.now()) {
        throw conflict('run_not_active', 'The run is past its deadline.');
      }
      // Resolved before the transaction, since a bindings function may do its own I/O, but only
      // surfaced once the locked checks below find new work: a concurrent identical flush may commit
      // meanwhile, and its replay must not depend on the bindings function.
      const resolvedAuthor: { author: string } | { error: unknown } = peekRun
        ? await bindingFor(peekRun.bindingId)
            .then(binding => ({ author: author(binding) }))
            .catch((error: unknown) => ({ error }))
        : { error: conflict('run_not_active', 'The run is not running.') };
      // One absolute deadline for the whole write transaction (O3 §C‴), capped by the run's.
      let deadlineAt = Math.min(budgetAt, peekRun?.deadlineAt?.getTime() ?? Infinity);
      // r352 S1 fence: under a lease, the transaction also stops where the run stops being live. The
      // peeked run only gives a first guess; the locked run decides, and a transaction whose deadline
      // runs past it is redone with that cutoff before it writes (`LeaseCutoff` below).
      const fenced = leaseMs !== undefined && storage.getCapabilities().enforcesTransactionDeadline === true;
      if (fenced && peekRun) {
        const cutoff = await localTimeOf(rootImporters, liveUntil(peekRun)).catch(error => {
          throw hostError(error);
        });
        // A cutoff already past is left to the locked check, after the receipt recheck.
        if (cutoff > Date.now()) deadlineAt = Math.min(deadlineAt, cutoff);
      }
      let embeds: KnowledgeImportEmbedJob[] = [];
      // Only a timeout after the settle slice started counts against settling (O3 §C″).
      let settling = false;
      try {
        const write = (deadlineAt: number) =>
          storage.transaction(
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
              if (lapsed(run, await clock(importers))) {
                throw conflict('run_not_active', 'The run is past its lease or deadline.');
              }
              if (fenced) {
                // Mapped from the locked run, which no heartbeat can renew while this holds its lock.
                const cutoff = await localTimeOf(importers, liveUntil(run));
                if (cutoff < deadlineAt) throw new LeaseCutoff(cutoff);
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
              const restart = hostState[KNOWLEDGE_IMPORT_SETTLE_RESTART_KEY] ?? '';
              const restarting = restart !== (hostState[KNOWLEDGE_IMPORT_SETTLE_SEEN_KEY] ?? '');
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
                        // Another binding queued repairs that may sit before the saved cursor.
                        after: restarting ? null : hostState[SETTLE_CURSOR_KEY] || null,
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
              // Only a slice that ran from the start has seen the repairs queued before this flush read
              // the state; a restart requested since then still differs and starts the next one over.
              if (restarting && settled?.fromStart) hostUpdates[KNOWLEDGE_IMPORT_SETTLE_SEEN_KEY] = restart;
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
        let receipt: KnowledgeImporterFlushReceipt | undefined;
        for (let attempt = 1; receipt === undefined; attempt++) {
          try {
            receipt = await write(deadlineAt);
          } catch (error) {
            if (!(error instanceof LeaseCutoff)) throw error;
            if (attempt >= MAX_LEASE_BOUND_ATTEMPTS) {
              throw new KnowledgeImporterHostError('The flush could not be bounded by its run lease; resend it.', 503);
            }
            deadlineAt = Math.min(budgetAt, error.cutoff - LEASE_CUTOFF_MARGIN_MS);
          }
        }
        await runEmbeds(storage, embeds);
        return receipt;
      } catch (error) {
        if (settling && timedOut(error)) await countSettleTimeout(flush.runId, flush.generation);
        throw hostError(error);
      }
    },

    async heartbeat(runId: string, generation: number): Promise<{ cancel: boolean }> {
      try {
        const { storage, importers } = await storageAndImporters();
        if (leaseMs === undefined) {
          const run = await importers.heartbeat(runId);
          return { cancel: !run || run.generation !== generation || run.cancelRequestedAt !== null };
        }
        // r352 S1: renewed only when admitted under the run's lock, by the store's clock, so a
        // lapsed run is never revived, even by a heartbeat that takes the lock before the sweep.
        return await storage.transaction(async tx => {
          const locked = tx.importers!;
          const guard = await locked.lockWriterGuard('share');
          const run = await locked.lockRun(runId);
          if (!run || run.status !== 'running') throw conflict('run_not_active', 'The run is not running.');
          if (run.generation !== generation || guard.generation !== generation) {
            throw conflict('stale_generation', 'The run belongs to an older writer generation.');
          }
          if (lapsed(run, await clock(locked)))
            throw conflict('run_not_active', 'The run is past its lease or deadline.');
          if (run.cancelRequestedAt) return { cancel: true };
          await locked.heartbeat(runId);
          return { cancel: false };
        });
      } catch (error) {
        throw hostError(error);
      }
    },

    async requestCancel(runId: string) {
      const { storage } = await storageAndImporters();
      try {
        // r352 S5: the same lock order as finish, so a cancel and a finish serialize.
        return await storage.transaction(async tx => {
          const importers = tx.importers!;
          await importers.lockWriterGuard('share');
          const run = await importers.lockRun(runId);
          if (!run) return null;
          if (run.status !== 'running') return { status: run.status };
          await importers.requestCancel(runId);
          return { status: run.status };
        });
      } catch (error) {
        throw hostError(error);
      }
    },

    async retireBinding(bindingId: string) {
      const { storage } = await storageAndImporters();
      try {
        // Under the writer guard, like a flush: one in flight commits before this, or finds its run gone.
        await storage.transaction(async tx => {
          await tx.importers!.lockWriterGuard('share');
          await tx.importers!.retireBinding(bindingId);
        });
      } catch (error) {
        throw hostError(error);
      }
    },

    async expireRuns() {
      const { storage, importers: root } = await storageAndImporters();
      const expired: string[] = [];
      try {
        const candidates: string[] = [];
        for (const stored of await root.listBindings()) {
          for (const run of await root.listRuns(stored.id)) if (run.status === 'running') candidates.push(run.id);
        }
        for (const runId of candidates) {
          const ended = await storage.transaction(async tx => {
            const importers = tx.importers!;
            await importers.lockWriterGuard('share');
            const run = await importers.lockRun(runId);
            return !!run && run.status === 'running' && (await expireLocked(importers, run));
          });
          if (ended) expired.push(runId);
        }
        return { expired };
      } catch (error) {
        throw hostError(error);
      }
    },

    async readRun(runId: string) {
      const { importers } = await storageAndImporters();
      const run = await importers.getRun(runId);
      if (!run) return null;
      return { status: run.status, receipt: run.status === 'running' || !run.finish ? null : runReceipt(run) };
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
            // r352 S3: the app never finished a run the host ended, so no app finish matches it.
            if ((run.finish as StoredFinish).by === 'host') {
              throw conflict('run_not_active', 'The host ended the run.');
            }
            if (
              run.generation === request.generation &&
              canonicalJson(replayIdentity(run.finish)) === canonicalJson(normalized)
            ) {
              return runReceipt(run);
            }
            throw conflict('finish_mismatch', 'The run already finished differently.');
          }
          if (run.status !== 'running') throw conflict('run_not_active', 'The run is not running.');
          if (run.generation !== request.generation || guard.generation !== request.generation) {
            throw conflict('stale_generation', 'The run belongs to an older writer generation.');
          }
          // A service host refuses a finish once the lease or deadline passed (r352 S1/S3); in
          // process, a runner stopped by its deadline still records `stopped` here.
          if (leaseMs !== undefined && lapsed(run, await clock(importers))) {
            throw conflict('run_not_active', 'The run is past its lease or deadline.');
          }
          if (run.lastSeq !== request.lastSeq) throw conflict('seq_mismatch', 'lastSeq is not the committed seq.');
          // r352 S5: a finish admitted after a committed cancel is recorded as canceled; its replay
          // identity stays the request the app sent.
          if (run.cancelRequestedAt) {
            const canceled = await importers.finishRun({
              runId: run.id,
              generation: request.generation,
              lastSeq: request.lastSeq,
              status: 'canceled',
              finish: { ...normalized, chain: false, canceled: true } satisfies StoredFinish,
            });
            return runReceipt(canceled);
          }
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
