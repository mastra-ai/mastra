import { randomUUID } from 'node:crypto';
import { Cron } from 'croner';
import type { IMastraLogger } from '../../logger';
import {
  knowledgeImporterBindingKey,
  parseKnowledgeImporterBindingKey,
  type KnowledgeImportRun,
  type KnowledgeImportTriggerKind,
} from '../../storage/domains/knowledge';
import type { Knowledge } from '../index';
import { runAgenticKnowledgeImport } from './agent-importer';
import { KnowledgeCitationResolver } from './citations';
import { createStaticKnowledgeImporterOperations } from './static-importer';
import {
  KNOWLEDGE_IMPORT_INTERNAL_STATE_PREFIX,
  type KnowledgeCitationRef,
  type KnowledgeImporterBindingInput,
  type KnowledgeImporterHandle,
} from './types';

const PAYLOAD_KEY_PREFIX = `${KNOWLEDGE_IMPORT_INTERNAL_STATE_PREFIX}import-payload/`;
const LEASE_KEY_PREFIX = `${KNOWLEDGE_IMPORT_INTERNAL_STATE_PREFIX}import-lease/`;
const HEARTBEAT_MS = 10_000;
const LEASE_TIMEOUT_MS = 30_000;
const RECOVERY_SCAN_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

function drainKey(importerId: string, binding: string): string {
  return JSON.stringify([importerId, binding]);
}

function serializePayload(payload: unknown): string {
  const serialized = JSON.stringify({ payload });
  if (serialized === undefined) throw new Error('Knowledge importer payload must be JSON-serializable');
  return serialized;
}

function cronExpressions(cron: KnowledgeImporterHandle['triggers']['cron']): readonly string[] {
  if (!cron) return [];
  return typeof cron.schedule === 'string' ? [cron.schedule] : cron.schedule;
}

function isTerminal(run: KnowledgeImportRun): boolean {
  return (
    run.status === 'succeeded' || run.status === 'failed' || run.status === 'skipped' || run.status === 'interrupted'
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** @internal Coordinates durable Knowledge importer runs for one Knowledge instance. */
export class KnowledgeImporterRunner {
  readonly #knowledge: Knowledge;
  readonly #getLogger: () => IMastraLogger | undefined;
  readonly #workerId = randomUUID();
  readonly #drains = new Map<string, Promise<void>>();
  readonly #cronJobs: Cron[] = [];
  readonly #activeControllers = new Map<string, AbortController>();
  #recoveryTimer?: ReturnType<typeof setInterval>;
  #recoveryPromise?: Promise<void>;
  #accepting = true;
  #started = false;

  constructor(knowledge: Knowledge, getLogger: () => IMastraLogger | undefined = () => undefined) {
    this.#knowledge = knowledge;
    this.#getLogger = getLogger;
  }

  schedule<TPayload>(importer: KnowledgeImporterHandle<TPayload>): void {
    if (!this.#started || !this.#accepting || !importer.triggers.cron) return;
    for (const expression of cronExpressions(importer.triggers.cron)) {
      this.#cronJobs.push(
        new Cron(expression, () => {
          for (const binding of importer.triggers.cron!.bindings) {
            void this.enqueue(importer, binding, undefined, 'cron').catch(() => undefined);
          }
        }),
      );
    }
  }

  async start(): Promise<void> {
    if (this.#started || !this.#accepting) return;
    this.#started = true;
    for (const importer of this.#knowledge.listImporters()) this.schedule(importer);
    await this.#queueRecovery();
    this.#recoveryTimer = setInterval(() => {
      void this.#queueRecovery().catch(() => undefined);
    }, RECOVERY_SCAN_MS);
    this.#recoveryTimer.unref?.();
  }

  async enqueue<TPayload>(
    importer: KnowledgeImporterHandle<TPayload>,
    bindingInput: KnowledgeImporterBindingInput,
    payload: unknown,
    triggerKind: KnowledgeImportTriggerKind,
    options: { awaitCompletion?: boolean } = {},
  ): Promise<KnowledgeImportRun> {
    if (!this.#accepting) throw new Error('Knowledge importer runner is shutting down');
    const binding = knowledgeImporterBindingKey(bindingInput);
    this.#assertDeclaredTriggerBinding(importer, binding, triggerKind);
    const runId = randomUUID();
    const storage = await this.#knowledge.getStorageInternal();
    const run = await storage.enqueueImportRun({
      id: runId,
      importerId: importer.importerId,
      binding,
      importKind: importer.agentic ? 'agentic' : 'static',
      triggerKind,
      payloadKey: `${PAYLOAD_KEY_PREFIX}${runId}`,
      payload: serializePayload(payload),
      skipIfActiveCron: triggerKind === 'cron',
    });
    if (run.status === 'skipped') return run;
    this.#startDrain(importer, binding);
    if (options.awaitCompletion === false) return run;
    return this.#waitForTerminal(run.id);
  }

  async shutdown(): Promise<void> {
    if (!this.#accepting) return;
    this.#accepting = false;
    this.#cronJobs.splice(0).forEach(job => job.stop());
    if (this.#recoveryTimer) clearInterval(this.#recoveryTimer);
    this.#activeControllers.forEach(controller => controller.abort(new Error('Knowledge importer is shutting down')));
    const drains = Promise.allSettled([
      ...this.#drains.values(),
      ...(this.#recoveryPromise ? [this.#recoveryPromise] : []),
    ]);
    const result = await Promise.race([
      drains.then(() => 'drained' as const),
      delay(SHUTDOWN_TIMEOUT_MS).then(() => 'timeout' as const),
    ]);
    if (result === 'timeout') {
      throw new Error('Knowledge importer shutdown timed out; storage was left open to protect active imports');
    }
  }

  #assertDeclaredTriggerBinding<TPayload>(
    importer: KnowledgeImporterHandle<TPayload>,
    binding: string,
    triggerKind: KnowledgeImportTriggerKind,
  ): void {
    if (triggerKind === 'programmatic') return;
    const declared = triggerKind === 'cron' ? importer.triggers.cron?.bindings : importer.triggers.webhook?.bindings;
    if (!declared?.some(candidate => knowledgeImporterBindingKey(candidate) === binding)) {
      throw new Error(`Knowledge importer ${importer.importerId} does not allow this ${triggerKind} binding`);
    }
  }

  #startDrain<TPayload>(importer: KnowledgeImporterHandle<TPayload>, binding: string): void {
    const key = drainKey(importer.importerId, binding);
    if (this.#drains.has(key) || !this.#accepting) return;
    const drain = this.#drain(importer, binding).finally(() => this.#drains.delete(key));
    this.#drains.set(key, drain);
  }

  async #drain<TPayload>(importer: KnowledgeImporterHandle<TPayload>, binding: string): Promise<void> {
    const storage = await this.#knowledge.getStorageInternal();
    while (this.#accepting) {
      const active = await storage.claimImportRun({
        importerId: importer.importerId,
        binding,
        workerId: this.#workerId,
        leaseKey: LEASE_KEY_PREFIX,
      });
      if (!active) return;
      await this.#execute(importer, active);
    }
  }

  async #execute<TPayload>(importer: KnowledgeImporterHandle<TPayload>, run: KnowledgeImportRun): Promise<void> {
    const storage = await this.#knowledge.getStorageInternal();
    const controller = new AbortController();
    this.#activeControllers.set(run.id, controller);
    const heartbeat = setInterval(() => {
      void storage
        .heartbeatImportRun({
          id: run.id,
          importerId: run.importerId,
          binding: run.binding,
          workerId: this.#workerId,
          leaseKey: `${LEASE_KEY_PREFIX}${run.id}`,
          transcriptThreadId,
        })
        .then(owned => {
          if (!owned) controller.abort(new Error(`Knowledge import run ${run.id} lost its execution lease`));
        })
        .catch(error => controller.abort(error));
    }, HEARTBEAT_MS);
    heartbeat.unref?.();
    let transcriptThreadId: string | undefined;
    try {
      const payloadEntry = await this.#knowledge.getImportStateInternal({
        importerId: importer.importerId,
        binding: run.binding,
        key: `${PAYLOAD_KEY_PREFIX}${run.id}`,
      });
      if (!payloadEntry) throw new Error(`Knowledge import run ${run.id} has no durable payload`);
      const pendingState = new Map<string, string>();
      const binding = parseKnowledgeImporterBindingKey(run.binding);
      const state = {
        get: async (key: string) => {
          this.#assertStateKey(key);
          if (pendingState.has(key)) return pendingState.get(key);
          return (
            await this.#knowledge.getImportStateInternal({ importerId: importer.importerId, binding: run.binding, key })
          )?.value;
        },
        set: async (key: string, value: string) => {
          this.#assertStateKey(key);
          pendingState.set(key, value);
        },
      };
      const assertLeaseOwned = async () => {
        if (controller.signal.aborted) throw controller.signal.reason;
        const owned = await storage.heartbeatImportRun({
          id: run.id,
          importerId: importer.importerId,
          binding: run.binding,
          workerId: this.#workerId,
          leaseKey: `${LEASE_KEY_PREFIX}${run.id}`,
          transcriptThreadId,
        });
        if (!owned) {
          controller.abort(new Error(`Knowledge import run ${run.id} lost its execution lease`));
          throw controller.signal.reason;
        }
      };
      let operations: ReturnType<typeof createStaticKnowledgeImporterOperations> | undefined;
      const importerOperations = () => {
        operations ??= createStaticKnowledgeImporterOperations({
          knowledge: this.#knowledge,
          importerId: importer.importerId,
          source: binding.source,
          scopeAddress: binding.scope,
          importRunId: run.id,
          assertLeaseOwned,
        });
        return operations;
      };
      const citations = importer.citations
        ? new KnowledgeCitationResolver({
            policy: importer.citations,
            host: importerOperations,
            signal: controller.signal,
          })
        : undefined;
      await importer.handler({
        knowledge: this.#knowledge,
        payload: (JSON.parse(payloadEntry.value) as { payload?: TPayload }).payload,
        run,
        signal: controller.signal,
        state,
        importer: importerOperations,
        ...(citations ? { resolveCitations: (refs: readonly KnowledgeCitationRef[]) => citations.resolve(refs) } : {}),
        ...(importer.agentic
          ? {
              agentImport: async request => {
                if (transcriptThreadId) throw new Error('Knowledge importer handler can run its Agent only once');
                transcriptThreadId = `knowledge-import-run:${run.id}`;
                await assertLeaseOwned();
                const result = await runAgenticKnowledgeImport({
                  knowledge: this.#knowledge,
                  importerId: importer.importerId,
                  binding: run.binding,
                  runId: run.id,
                  signal: controller.signal,
                  config: importer.agentic!,
                  operations: await importerOperations(),
                  request,
                });
                transcriptThreadId = result.transcriptThreadId;
                if (Object.values(result.writes).every(count => count === 0)) {
                  this.#getLogger()?.warn('Knowledge agentic import acknowledged its checkpoint without writing', {
                    importerId: importer.importerId,
                    runId: run.id,
                    checkpoint: result.checkpoint,
                  });
                }
                return result;
              },
            }
          : {}),
      });
      if (citations?.incomplete) {
        throw new Error(
          `Knowledge importer ${importer.importerId} left required citations unresolved (${citations.unresolvedSummary()})`,
        );
      }
      if (importer.agentic && !transcriptThreadId) {
        throw new Error(`Knowledge agentic importer ${importer.importerId} did not run its registered Agent`);
      }
      if (controller.signal.aborted) return;
      const completed = await storage.finalizeImportRun({
        id: run.id,
        importerId: importer.importerId,
        binding: run.binding,
        workerId: this.#workerId,
        leaseKey: `${LEASE_KEY_PREFIX}${run.id}`,
        payloadKey: `${PAYLOAD_KEY_PREFIX}${run.id}`,
        status: 'succeeded',
        transcriptThreadId,
        state: [...pendingState].map(([key, value]) => ({ key, value })),
      });
      if (!completed) controller.abort(new Error(`Knowledge import run ${run.id} lost its execution lease`));
    } catch (error) {
      if (!controller.signal.aborted) {
        await storage.finalizeImportRun({
          id: run.id,
          importerId: importer.importerId,
          binding: run.binding,
          workerId: this.#workerId,
          leaseKey: `${LEASE_KEY_PREFIX}${run.id}`,
          payloadKey: `${PAYLOAD_KEY_PREFIX}${run.id}`,
          status: 'failed',
          error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          transcriptThreadId,
          state: [],
        });
      }
    } finally {
      clearInterval(heartbeat);
      this.#activeControllers.delete(run.id);
    }
  }

  #assertStateKey(key: string): void {
    if (typeof key !== 'string' || !key.trim()) throw new Error('Knowledge importer state key is required');
    if (key.startsWith(KNOWLEDGE_IMPORT_INTERNAL_STATE_PREFIX))
      throw new Error('Knowledge importer state key is reserved');
  }

  #queueRecovery(): Promise<void> {
    if (!this.#recoveryPromise) {
      const promise = this.#recoverAndDrain().finally(() => {
        if (this.#recoveryPromise === promise) this.#recoveryPromise = undefined;
      });
      this.#recoveryPromise = promise;
    }
    return this.#recoveryPromise;
  }

  async #recoverAndDrain(): Promise<void> {
    const storage = await this.#knowledge.getStorageInternal();
    const staleBefore = new Date(Date.now() - LEASE_TIMEOUT_MS);
    for (const importer of this.#knowledge.listImporters()) {
      const runs = await this.#listAll(importer.importerId, undefined, 'running');
      for (const run of runs) {
        const replacementId = randomUUID();
        const recovered = await storage.recoverImportRun({
          id: run.id,
          replacementId,
          payloadKey: `${PAYLOAD_KEY_PREFIX}${run.id}`,
          replacementPayloadKey: `${PAYLOAD_KEY_PREFIX}${replacementId}`,
          leaseKey: `${LEASE_KEY_PREFIX}${run.id}`,
          staleBefore,
        });
        if (recovered) {
          this.#getLogger()?.info('Knowledge importer recovered a stale run; replaying it from its durable payload', {
            importerId: run.importerId,
            binding: run.binding,
            interruptedRunId: run.id,
            replacementRunId: replacementId,
          });
        }
      }
      const queued = await this.#listAll(importer.importerId, undefined, 'queued');
      for (const binding of new Set(queued.map(run => run.binding))) this.#startDrain(importer, binding);
    }
  }

  async #waitForTerminal(id: string): Promise<KnowledgeImportRun> {
    let loggedForeignLease = false;
    while (true) {
      if (!this.#accepting) throw new Error('Knowledge importer runner shut down before the run completed');
      const run = await this.#knowledge.getImportRunInternal(id);
      if (!run) throw new Error(`Knowledge import run ${id} disappeared before completion`);
      if (isTerminal(run)) {
        if (run.status === 'interrupted') {
          this.#getLogger()?.info('Knowledge import run was interrupted; its replay is queued separately', {
            importerId: run.importerId,
            binding: run.binding,
            runId: run.id,
          });
        }
        return run;
      }
      if (!loggedForeignLease && !this.#activeControllers.has(run.id)) {
        const blocker = (await this.#listAll(run.importerId, run.binding, 'running')).find(
          candidate => !this.#activeControllers.has(candidate.id),
        );
        if (blocker) {
          loggedForeignLease = true;
          await this.#logForeignLeaseWait(run, blocker);
        }
      }
      await delay(25);
    }
  }

  async #logForeignLeaseWait(run: KnowledgeImportRun, blocker: KnowledgeImportRun): Promise<void> {
    const logger = this.#getLogger();
    if (!logger) return;
    const lease = await this.#knowledge.getImportState({
      importerId: run.importerId,
      binding: run.binding,
      key: `${LEASE_KEY_PREFIX}${blocker.id}`,
    });
    let heartbeatAt: number | undefined;
    let holder: string | undefined;
    try {
      const parsed = lease ? (JSON.parse(lease.value) as { workerId?: string; heartbeatAt?: string }) : undefined;
      holder = parsed?.workerId;
      heartbeatAt = parsed?.heartbeatAt ? Date.parse(parsed.heartbeatAt) : undefined;
    } catch {
      // Malformed leases are treated as stale by recovery.
    }
    const msUntilLeaseExpiry =
      heartbeatAt === undefined || Number.isNaN(heartbeatAt)
        ? 0
        : Math.max(0, heartbeatAt + LEASE_TIMEOUT_MS - Date.now());
    logger.debug(
      'Waiting on a knowledge import run leased by another worker; recovery replays it once the lease expires',
      {
        importerId: run.importerId,
        binding: run.binding,
        runId: run.id,
        leasedRunId: blocker.id,
        leaseHolder: holder,
        msUntilLeaseExpiry,
        recoveryScanIntervalMs: RECOVERY_SCAN_MS,
      },
    );
  }

  async #listAll(importerId: string, binding?: string, status?: KnowledgeImportRun['status']) {
    const runs: KnowledgeImportRun[] = [];
    let after: string | undefined;
    do {
      const page = await this.#knowledge.listImportRunsInternal({ importerId, binding, status, after, limit: 100 });
      runs.push(...page.runs);
      after = page.nextCursor;
    } while (after);
    return runs;
  }
}
