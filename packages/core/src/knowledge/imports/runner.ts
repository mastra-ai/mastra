import { randomUUID } from 'node:crypto';
import { Cron } from 'croner';
import {
  knowledgeImporterBindingKey,
  parseKnowledgeImporterBindingKey,
  type KnowledgeImportRun,
  type KnowledgeImportTriggerKind,
} from '../../storage/domains/knowledge';
import type { Knowledge } from '../index';
import { createStaticKnowledgeImporterOperations } from './static-importer';
import type { KnowledgeImporterBindingInput, KnowledgeImporterHandle } from './types';

const INTERNAL_STATE_PREFIX = '__mastra_internal/';
const PAYLOAD_KEY_PREFIX = `${INTERNAL_STATE_PREFIX}import-payload/`;
const LEASE_KEY_PREFIX = `${INTERNAL_STATE_PREFIX}import-lease/`;
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
  readonly #workerId = randomUUID();
  readonly #drains = new Map<string, Promise<void>>();
  readonly #cronJobs: Cron[] = [];
  readonly #activeControllers = new Map<string, AbortController>();
  #recoveryTimer?: ReturnType<typeof setInterval>;
  #recoveryPromise?: Promise<void>;
  #accepting = true;
  #started = false;

  constructor(knowledge: Knowledge) {
    this.#knowledge = knowledge;
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
  ): Promise<KnowledgeImportRun> {
    if (!this.#accepting) throw new Error('Knowledge importer runner is shutting down');
    const binding = knowledgeImporterBindingKey(bindingInput);
    this.#assertDeclaredTriggerBinding(importer, binding, triggerKind);
    const runId = randomUUID();
    const storage = await this.#knowledge.getStorage();
    const run = await storage.enqueueImportRun({
      id: runId,
      importerId: importer.importerId,
      binding,
      importKind: 'static',
      triggerKind,
      payloadKey: `${PAYLOAD_KEY_PREFIX}${runId}`,
      payload: serializePayload(payload),
      skipIfActiveCron: triggerKind === 'cron',
    });
    if (run.status === 'skipped') return run;
    this.#startDrain(importer, binding);
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
    const storage = await this.#knowledge.getStorage();
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
    const storage = await this.#knowledge.getStorage();
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
        })
        .then(owned => {
          if (!owned) controller.abort(new Error(`Knowledge import run ${run.id} lost its execution lease`));
        })
        .catch(error => controller.abort(error));
    }, HEARTBEAT_MS);
    heartbeat.unref?.();
    try {
      const payloadEntry = await this.#knowledge.getImportState({
        importerId: importer.importerId,
        binding: run.binding,
        key: `${PAYLOAD_KEY_PREFIX}${run.id}`,
      });
      if (!payloadEntry) throw new Error(`Knowledge import run ${run.id} has no durable payload`);
      const pendingState = new Map<string, string>();
      const binding = parseKnowledgeImporterBindingKey(run.binding);
      await importer.handler({
        knowledge: this.#knowledge,
        payload: (JSON.parse(payloadEntry.value) as { payload?: TPayload }).payload,
        run,
        signal: controller.signal,
        state: {
          get: async key => {
            this.#assertStateKey(key);
            if (pendingState.has(key)) return pendingState.get(key);
            return (
              await this.#knowledge.getImportState({ importerId: importer.importerId, binding: run.binding, key })
            )?.value;
          },
          set: async (key, value) => {
            this.#assertStateKey(key);
            pendingState.set(key, value);
          },
        },
        importer: async () =>
          createStaticKnowledgeImporterOperations({
            knowledge: this.#knowledge,
            importerId: importer.importerId,
            source: binding.source,
            scopeAddress: binding.scope,
            importRunId: run.id,
          }),
      });
      if (controller.signal.aborted) return;
      const completed = await storage.finalizeImportRun({
        id: run.id,
        importerId: importer.importerId,
        binding: run.binding,
        workerId: this.#workerId,
        leaseKey: `${LEASE_KEY_PREFIX}${run.id}`,
        status: 'succeeded',
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
          status: 'failed',
          error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
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
    if (key.startsWith(INTERNAL_STATE_PREFIX)) throw new Error('Knowledge importer state key is reserved');
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
    const storage = await this.#knowledge.getStorage();
    const staleBefore = new Date(Date.now() - LEASE_TIMEOUT_MS);
    for (const importer of this.#knowledge.listImporters()) {
      const runs = await this.#listAll(importer.importerId);
      for (const run of runs.filter(run => run.status === 'running')) {
        const replacementId = randomUUID();
        await storage.recoverImportRun({
          id: run.id,
          replacementId,
          payloadKey: `${PAYLOAD_KEY_PREFIX}${run.id}`,
          replacementPayloadKey: `${PAYLOAD_KEY_PREFIX}${replacementId}`,
          leaseKey: `${LEASE_KEY_PREFIX}${run.id}`,
          staleBefore,
        });
      }
      const queued = await this.#listAll(importer.importerId, undefined, 'queued');
      for (const binding of new Set(queued.map(run => run.binding))) this.#startDrain(importer, binding);
    }
  }

  async #waitForTerminal(id: string): Promise<KnowledgeImportRun> {
    while (true) {
      if (!this.#accepting) throw new Error('Knowledge importer runner shut down before the run completed');
      const run = await this.#knowledge.getImportRun(id);
      if (!run) throw new Error(`Knowledge import run ${id} disappeared before completion`);
      if (isTerminal(run)) return run;
      await delay(25);
    }
  }

  async #listAll(importerId: string, binding?: string, status?: KnowledgeImportRun['status']) {
    const runs: KnowledgeImportRun[] = [];
    let after: string | undefined;
    do {
      const page = await this.#knowledge.listImportRuns({ importerId, binding, status, after, limit: 100 });
      runs.push(...page.runs);
      after = page.nextCursor;
    } while (after);
    return runs;
  }
}
