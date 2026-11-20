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
  /** The app's bindings, or a function that reads them at each run start. */
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
}

const DEFAULT_FLUSH_BUDGET_MS = 45_000;

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

const runReceipt = (run: KnowledgeImporterRunRecord): KnowledgeImporterRunReceipt => ({
  runId: run.id,
  ...(run.finish as NormalizedKnowledgeImporterFinish),
  counts: receiptCounts(run.counts),
});

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
    const binding = (await listBindings()).find(b => b.id === bindingId);
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
        const page = await storage.getPage({ id: job.pageId, read: 'all' });
        if (page && !page.deletedAt) await semantic.indexPage(page);
      } catch (error) {
        writer.warn(`Knowledge importer: indexing page ${job.pageId} failed after commit: ${String(error)}`);
      }
    }
  };

  return {
    async startRun(bindingId: string, start?: KnowledgeImporterStartRunOptions): Promise<KnowledgeImporterRunStart> {
      const binding = await bindingFor(bindingId);
      try {
        const { scope } = parseKnowledgeImportTarget(binding.target);
        const { storage } = await storageAndImporters();
        await writer.runtime.resolve();
        await writer.runtime.materializeScope(scope, [], { author: author(binding) });
        const others = (await listBindings()).filter(b => b.id !== binding.id);
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
          const run = await importers.startRun({
            bindingId: binding.id,
            runId: start?.runId ?? randomUUID(),
            generation: guard.generation,
            ...(start?.fireKey !== undefined ? { fireKey: start.fireKey } : {}),
            ...(start?.deadline !== undefined ? { deadlineAt: new Date(start.deadline) } : {}),
          });
          const state = run.status === 'started' ? await importers.getState(binding.id) : {};
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
      // One absolute deadline for the whole write transaction (O3 §C‴), capped by the run's.
      const deadlineAt = Math.min(budgetAt, peekRun?.deadlineAt?.getTime() ?? Infinity);
      let embeds: KnowledgeImportEmbedJob[] = [];
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

            const binding = await importers.getBinding(run.bindingId);
            const runBinding = await bindingFor(run.bindingId);
            if (!binding) throw conflict('run_not_active', 'The run has no binding.');
            const [scope] = await tx.getScopesByAddress([parseKnowledgeImportTarget(binding.target).scope]);
            if (!scope) throw new KnowledgeImporterHostError('The binding target scope does not exist.', 503);
            const applied = await applyKnowledgeImportFlush({
              storage: tx,
              importers,
              binding,
              scope,
              runId: run.id,
              ops: body.ops,
              provenance: { author: author(runBinding) },
            });
            if (body.state) await importers.setState(binding.id, body.state);
            for (const change of applied.changes) await importers.recordRunChange({ runId: run.id, ...change });
            const receipt: KnowledgeImporterFlushReceipt = {
              seq: flush.seq,
              ...applied.counts,
              refused: applied.refused,
            };
            await importers.recordFlush({
              runId: run.id,
              generation: flush.generation,
              seq: flush.seq,
              digest,
              receipt,
              counts: { ...applied.counts, refused: applied.refused.length },
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
            if (run.generation === request.generation && canonicalJson(run.finish) === canonicalJson(normalized)) {
              return runReceipt(run);
            }
            throw conflict('finish_mismatch', 'The run already finished differently.');
          }
          if (run.status !== 'running') throw conflict('run_not_active', 'The run is not running.');
          if (run.generation !== request.generation || guard.generation !== request.generation) {
            throw conflict('stale_generation', 'The run belongs to an older writer generation.');
          }
          if (run.lastSeq !== request.lastSeq) throw conflict('seq_mismatch', 'lastSeq is not the committed seq.');
          const finished = await importers.finishRun({
            runId: run.id,
            generation: request.generation,
            lastSeq: request.lastSeq,
            status: normalized.outcome,
            finish: normalized,
          });
          return runReceipt(finished);
        });
      } catch (error) {
        throw hostError(error);
      }
    },
  };
}
