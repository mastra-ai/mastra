import { randomUUID } from 'node:crypto';
import type {
  StepResult,
  WorkflowRunState,
  WorkflowTerminalDestinationReceiptRecord,
  WorkflowTerminalEffectRecord,
  WorkflowTerminalSnapshotRecord,
  WorkflowTerminalizationRecord,
} from '../../../workflows';
import {
  applyWorkflowTerminalParentContinuationPatch,
  copyWorkflowTerminalParentContinuationContract,
  WorkflowTerminalContinuationStoredStateError,
} from '../../../workflows/terminal-continuation';
import {
  materializeWorkflowTerminalCanonicalJsonObject,
  validateWorkflowTerminalRecoveryParentFrameGraphBinding,
} from '../../../workflows/terminal-recovery';
import { normalizePerPage } from '../../base';
import type {
  AdvanceWorkflowTerminalizationInput,
  AdvanceWorkflowTerminalizationResult,
  ClaimWorkflowTerminalizationInput,
  ClaimWorkflowTerminalizationResult,
  DeleteCompletedWorkflowTerminalizationsInput,
  DeleteCompletedWorkflowTerminalizationsResult,
  GetWorkflowTerminalizationInput,
  GetWorkflowTerminalizationResult,
  GetWorkflowRunTerminalStatusInput,
  GetWorkflowRunTerminalStatusResult,
  GetWorkflowTerminalEffectForDispatchInput,
  GetWorkflowTerminalEffectForDispatchResult,
  GetWorkflowTerminalDestinationReceiptInput,
  GetWorkflowTerminalDestinationReceiptResult,
  GetWorkflowTerminalParentContextInput,
  GetWorkflowTerminalParentContextResult,
  GetWorkflowTerminalContinuationPlanInput,
  GetWorkflowTerminalContinuationPlanResult,
  PersistWorkflowTerminalStateInput,
  PersistWorkflowTerminalStateResult,
  PrepareWorkflowTerminalEffectInput,
  PrepareWorkflowTerminalEffectResult,
  ReserveWorkflowTerminalDestinationReceiptInput,
  ReserveWorkflowTerminalDestinationReceiptResult,
  ApplyWorkflowTerminalParentEffectInput,
  ApplyWorkflowTerminalParentEffectResult,
  BindWorkflowNestedRunOwnershipInput,
  BindWorkflowNestedRunOwnershipResult,
  AdmitWorkflowNestedRunInput,
  AdmitWorkflowNestedRunResult,
  AdmitWorkflowResumeInput,
  AdmitWorkflowResumeResult,
  ConsumeWorkflowResumeResult,
  ConsumeWorkflowResumeResultInput,
  FinalizeWorkflowResumeInput,
  FinalizeWorkflowResumeResult,
  PersistWorkflowStepUpdateInput,
  PersistWorkflowStepUpdateResult,
  PersistWorkflowTerminalRecoveryAncestryInput,
  PersistWorkflowTerminalRecoveryAncestryResult,
  GetWorkflowTerminalRecoveryAncestryResult,
  ReleaseWorkflowTerminalizationInput,
  ReleaseWorkflowTerminalizationResult,
  RollbackWorkflowResumeInput,
  RollbackWorkflowResumeResult,
  StorageWorkflowRun,
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
  WorkflowTerminalContinuationPlanRecord,
  WorkflowTerminalizationCapabilities,
  WorkflowResumeCapabilities,
  WorkflowSnapshotHandoffCapabilities,
  WorkflowSnapshotHandoffCanonicalState,
  WorkflowSnapshotHandoffRecord,
  ClaimWorkflowSnapshotHandoffInput,
  ClaimWorkflowSnapshotHandoffResult,
  TransitionWorkflowSnapshotHandoffInput,
  TransitionWorkflowSnapshotHandoffResult,
  CompleteWorkflowSnapshotHandoffInput,
  CompleteWorkflowSnapshotHandoffResult,
  ListWorkflowSnapshotHandoffsInput,
  ListWorkflowSnapshotHandoffsResult,
  WorkflowExecutionState,
} from '../../types';
import { matchesExpectedWorkflowState } from '../../types';
import {
  createEmptyWorkflowSnapshot,
  mergeWorkflowStepResult,
  validateWorkflowSnapshotTimestampForFinalState,
} from '../../workflow-snapshot';
import {
  WorkflowSnapshotHandoffFenceError,
  compareWorkflowSnapshotHandoffCursors,
  materializeWorkflowSnapshotHandoffSnapshot,
  validateWorkflowSnapshotHandoffFence,
  validateWorkflowSnapshotHandoffIdentity,
  validateWorkflowSnapshotHandoffLimit,
  workflowSnapshotHandoffCanonicalStatesEqual,
  workflowSnapshotHandoffSnapshotsEqual,
} from '../../workflow-snapshot-handoff';
import type { InMemoryDB, WorkflowTerminalParentRevisionState } from '../inmemory-db';
import { WorkflowsStorage } from './base';
import {
  admitWorkflowResumeRecord,
  consumeWorkflowResumeResultRecord,
  finalizeWorkflowResumeRecord,
  persistWorkflowStepUpdateRecord,
  rollbackWorkflowResumeRecord,
} from './resume';
import {
  advanceWorkflowTerminalizationRecord,
  bindWorkflowNestedRunOwnershipRecord,
  captureWorkflowRunIdentity,
  captureWorkflowNestedRunAdmissionInput,
  claimWorkflowTerminalizationRecord,
  copyWorkflowTerminalizationRecord,
  copyWorkflowTerminalEffectRecord,
  copyWorkflowTerminalDestinationReceiptRecord,
  copyWorkflowTerminalContinuationPlanRecord,
  copyWorkflowTerminalRecoveryAncestryRecord,
  createWorkflowTerminalRecoveryAncestryRecord,
  getWorkflowTerminalDestinationReceiptRecord,
  getWorkflowTerminalEffectForDispatchRecord,
  getWorkflowTerminalContinuationPlanRecord,
  getWorkflowTerminalSnapshotRecordHash,
  materializeWorkflowTerminalEffectDescriptor,
  materializeWorkflowTerminalEffectKind,
  observeWorkflowTerminalizationRecord,
  observeWorkflowTerminalEffectRecord,
  observeWorkflowTerminalContinuationPlanRecord,
  persistWorkflowTerminalStateRecord,
  prepareWorkflowTerminalEffectRecord,
  reserveWorkflowTerminalDestinationReceiptRecord,
  prepareWorkflowTerminalParentApplicationRecords,
  finalizeWorkflowTerminalParentApplicationRecords,
  releaseWorkflowTerminalizationRecord,
  validateWorkflowTerminalizationClaim,
  validateWorkflowTerminalEffectIntegrity,
  validateWorkflowTerminalEffectJournalLink,
  validateWorkflowTerminalDestinationReceiptIntegrity,
  validateWorkflowTerminalizationFence,
  validateWorkflowTerminalizationRunIdentity,
  validateWorkflowTerminalizationIdentity,
  validateWorkflowNestedRunOwnershipInput,
  validateWorkflowNestedRunInitialSnapshot,
  inspectWorkflowNestedRunRetainedSnapshot,
  validateWorkflowRunSnapshotShape,
  validateWorkflowTerminalSnapshotJournalLink,
  validateWorkflowTerminalEffectRecoveryLink,
  validateWorkflowTerminalRecoveryAncestryRecord,
  sameWorkflowTerminalRecoveryAncestry,
  WORKFLOW_TERMINAL_PARENT_APPLICATION_CONSUMER_ID,
} from './terminalization';

/**
 * Deep-clone in-memory workflow state.
 *
 * We previously used `JSON.parse(JSON.stringify(x))` here, but the agent loop
 * and workflow engine legitimately place values in step results that don't
 * survive JSON round-tripping:
 * - `Date` instances (e.g. `response.timestamp`) — JSON turns them into ISO
 *   strings, downstream consumers that do `.getTime()` then break.
 * - Explicitly-`undefined` properties (e.g. `headers`, `providerMetadata`,
 *   `usage.{cacheRead, cacheWrite, reasoning}`) — JSON drops keys with
 *   `undefined` values, breaking snapshot assertions that include them.
 * - `Error` instances (e.g. tool execution failures, AssertionErrors from
 *   inside `tool.execute`) — JSON strips `message`/`name`/`stack` (non-
 *   enumerable). `structuredClone` isn't enough either — it preserves the
 *   Error type but drops subclass-specific enumerable props (`actual`,
 *   `expected`, `operator`).
 *
 * The custom walk below preserves all of that. It also handles builtins with
 * internal slots explicitly — `Map`, `Set`, `RegExp`, `URL`, `ArrayBuffer`,
 * typed arrays, and `DataView` — because cloning them via `Object.create(proto)`
 * would produce a value that passes `instanceof` but whose methods throw (the
 * internal slots were never initialized). Null-prototype dictionaries keep
 * their null prototype.
 */
/** @internal Exported for testing only. */
export function cloneRunData<T>(value: T): T {
  return deepCloneForRun(value, new WeakMap()) as T;
}

const TERMINAL_PARENT_STATUSES = ['success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped'] as const;
type TerminalParentStatus = (typeof TERMINAL_PARENT_STATUSES)[number];

// Consistency re-check loops retry when caller-controlled serialization
// (toJSON/getters) reentrantly changed the source record. Honest reentrancy
// converges on the first retry; a caller that mutates on every clone is
// degenerate, so the loop is bounded instead of spinning forever.
const WORKFLOW_REENTRANT_ATTEMPT_LIMIT = 3;

function throwIfWorkflowReentrantAttemptsExhausted(attempt: number): void {
  if (attempt >= WORKFLOW_REENTRANT_ATTEMPT_LIMIT) {
    throw new TypeError(
      `Workflow storage operation did not converge after ${attempt} attempts; input serialization mutated shared state on every retry`,
    );
  }
}

function isTerminalParentStatus(value: unknown): value is TerminalParentStatus {
  return typeof value === 'string' && TERMINAL_PARENT_STATUSES.includes(value as TerminalParentStatus);
}

// V8 exposes Error.stack as a lazy native accessor backed by internal slots a
// prototype-only clone lacks — invoking it on the clone yields undefined. The
// getter is shared across instances, so identity comparison detects it; the
// memoizing native read is safe to perform on the source.
const NATIVE_ERROR_STACK_GET = Object.getOwnPropertyDescriptor(new Error(), 'stack')?.get;

function materializeTerminalSnapshot(snapshot: WorkflowRunState): WorkflowRunState {
  const materialized = cloneRunData(snapshot);
  const runId = materialized.runId;
  const status = materialized.status;
  // The canonical snapshot is data, not an executable wrapper. Flatten its
  // top-level prototype so inherited accessors cannot change journal evidence
  // after validation; nested values keep cloneRunData's richer semantics.
  Object.setPrototypeOf(materialized, Object.prototype);
  Object.defineProperties(materialized, {
    runId: { configurable: true, enumerable: true, writable: true, value: runId },
    status: { configurable: true, enumerable: true, writable: true, value: status },
  });
  return materialized;
}

function deepCloneForRun(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') return value;
  const cached = seen.get(value as object);
  if (cached !== undefined) return cached;

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }

  if (value instanceof URL) {
    return new URL(value.href);
  }

  if (value instanceof Map) {
    const out = new Map();
    seen.set(value, out);
    for (const [k, v] of value) {
      out.set(deepCloneForRun(k, seen), deepCloneForRun(v, seen));
    }
    return out;
  }

  if (value instanceof Set) {
    const out = new Set();
    seen.set(value, out);
    for (const v of value) {
      out.add(deepCloneForRun(v, seen));
    }
    return out;
  }

  if (value instanceof ArrayBuffer) {
    return value.slice(0);
  }

  // Typed arrays and DataView — `Object.create(proto)` would yield a shell with
  // no backing buffer, so rebuild against a fresh copy of the underlying bytes.
  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) {
      return new DataView(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    }
    const typed = value as unknown as Uint8Array;
    return new (typed.constructor as Uint8ArrayConstructor)(typed);
  }

  if (value instanceof Error) {
    // Clone via Object.create(proto) so `instanceof Error` and subclass
    // branches keep working (e.g. `expect.any(Error)`) without invoking
    // subclass constructors that may have non-standard signatures
    // (AssertionError expects an options object). Preserve the source
    // enumerability of `message`: a fresh Error's own message is
    // non-enumerable while an explicitly assigned/defined one may be
    // enumerable, and the JSON persistence projection differs accordingly.
    const out = Object.create(Object.getPrototypeOf(value)) as Error;
    // Register in `seen` BEFORE recursing so cycles (incl. self-referential
    // `cause`) terminate.
    seen.set(value, out);
    const outRecord = out as unknown as Record<PropertyKey, unknown>;
    // Copy every own property through its descriptor: data values are
    // deep-cloned with source enumerability, accessors are preserved verbatim
    // and never invoked on the source — a getter or toJSON mutating `this`
    // during observation must only ever affect the clone, not the stored row.
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      if (!('value' in descriptor)) {
        if (key === 'stack' && descriptor.get !== undefined && descriptor.get === NATIVE_ERROR_STACK_GET) {
          // The native stack accessor cannot run on the clone (missing
          // internal slots); resolve the source value and store it as data.
          Object.defineProperty(outRecord, 'stack', {
            configurable: true,
            writable: true,
            enumerable: descriptor.enumerable,
            value: (value as Error).stack,
          });
          continue;
        }
        // Accessors are never invoked on the source — a getter mutating `this`
        // during observation must only affect the clone. JSON.stringify
        // resolves enumerable getters, so resolve them on the clone for a
        // matching projection; non-enumerable accessors stay live as
        // toJSON/method backing.
        Object.defineProperty(outRecord, key, descriptor);
        if (descriptor.enumerable && typeof descriptor.get === 'function') {
          const resolved = deepCloneForRun(outRecord[key], seen);
          Object.defineProperty(outRecord, key, {
            configurable: true,
            writable: true,
            enumerable: true,
            value: resolved,
          });
        }
        continue;
      }
      if (key === 'cause' && descriptor.value === undefined) continue;
      const cloned =
        key === 'message' || key === 'name' || key === 'stack'
          ? descriptor.value
          : deepCloneForRun(descriptor.value, seen);
      Object.defineProperty(outRecord, key, {
        configurable: true,
        writable: true,
        enumerable: descriptor.enumerable,
        value: cloned,
      });
    }
    // For `stack`, defer to the Error's own `toJSON` if present — that's how
    // producers signal whether they want stack persisted (e.g. step-executor
    // wraps via `getErrorFromUnknown(err, { serializeStack: false })` so the
    // attached toJSON omits stack from the JSON form). We only honour
    // toJSON's stack signal here, not its other fields, to avoid pulling in
    // subclass extras like Chai AssertionError.toJSON's name/ok/stack that
    // the agent-loop snapshot tests don't expect. Invoke it on the clone so a
    // self-mutating serializer cannot corrupt the source.
    if (Object.getOwnPropertyDescriptor(out, 'stack') !== undefined && typeof outRecord.toJSON === 'function') {
      try {
        const serialized = (outRecord.toJSON as () => unknown).call(out);
        if (serialized && typeof serialized === 'object' && !('stack' in serialized)) {
          delete outRecord.stack;
        }
      } catch {
        // Defensive: if toJSON throws, fall back to default behaviour.
      }
    }
    return out;
  }

  if (Array.isArray(value)) {
    const out: unknown[] = new Array(value.length);
    seen.set(value, out);
    for (let i = 0; i < value.length; i++) {
      out[i] = deepCloneForRun(value[i], seen);
    }
    return out;
  }

  // Preserve the prototype so class instances stay recognizable to consumers
  // (e.g. `DefaultStepResult` in the agent loop, anything that uses `instanceof`
  // or Vitest's snapshot serializer which prints the class name) and so
  // null-prototype dictionaries (`Object.create(null)`) keep their null proto
  // rather than silently becoming plain `{}`. Builtins with internal slots
  // (Map/Set/RegExp/typed arrays/Date/Error) are handled explicitly above, so
  // the only objects reaching here are plain objects and plain data-holder
  // class instances — `Object.create(proto)` + an own-property copy reproduces
  // those faithfully.
  const proto = Object.getPrototypeOf(value);
  const out: Record<string, unknown> =
    proto === Object.prototype ? {} : (Object.create(proto) as Record<string, unknown>);
  seen.set(value, out);
  // `Object.keys` includes keys whose value is `undefined`, so explicitly-undefined
  // properties are preserved (unlike a JSON round-trip). Define each key as an
  // own data property instead of assigning through the destination prototype:
  // assignment to `__proto__` would otherwise invoke Object.prototype's legacy
  // setter and silently lose the workflow step slot during a clone.
  // Non-enumerable own props are copied too — preserving the source
  // enumerability — because a copied `toJSON` may read backing fields that sit
  // off the JSON surface, and durable adapters stringify the full source.
  // Accessors are never invoked on the source — a getter mutating `this`
  // during observation must only affect the clone. JSON.stringify resolves
  // enumerable getters, so resolve them on the clone for a matching
  // projection; non-enumerable accessors stay live as toJSON/method backing.
  for (const key of Reflect.ownKeys(value as object)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) continue;
    if (!('value' in descriptor)) {
      Object.defineProperty(out, key, descriptor);
      if (descriptor.enumerable && typeof descriptor.get === 'function') {
        const resolved = deepCloneForRun((out as Record<PropertyKey, unknown>)[key], seen);
        Object.defineProperty(out, key, {
          configurable: true,
          writable: true,
          enumerable: true,
          value: resolved,
        });
      }
      continue;
    }
    Object.defineProperty(out, key, {
      configurable: true,
      writable: true,
      enumerable: descriptor.enumerable,
      value: deepCloneForRun(descriptor.value, seen),
    });
  }
  return out;
}

export class WorkflowsInMemory extends WorkflowsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  supportsWorkflowTerminalizationJournal(): boolean {
    return true;
  }

  getWorkflowTerminalizationCapabilities(): WorkflowTerminalizationCapabilities {
    return {
      journalVersion: 1,
      producerOutboxVersion: 1,
      destinationReceiptVersion: 1,
      parentApplicationVersion: 1,
      recoveryVersion: 1,
    };
  }

  getWorkflowResumeCapabilities(): WorkflowResumeCapabilities {
    return { atomicResumeVersion: 1, fencedStepUpdateVersion: 1 };
  }

  getWorkflowSnapshotHandoffCapabilities(): WorkflowSnapshotHandoffCapabilities {
    return { handoffVersion: 1, recoveryVersion: 1 };
  }

  private getWorkflowSnapshotHandoff(workflowName: string, runId: string): WorkflowSnapshotHandoffRecord | undefined {
    return this.db.workflowSnapshotHandoffs.get(this.getWorkflowKey(workflowName, runId));
  }

  private assertWorkflowSnapshotHandoffAvailable(workflowName: string, runId: string): void {
    const handoff = this.getWorkflowSnapshotHandoff(workflowName, runId);
    if (handoff) {
      throw new WorkflowSnapshotHandoffFenceError({
        workflowName,
        runId,
        handoffStatus: handoff.status,
      });
    }
  }

  // Snapshot writes must check the fence immediately before mutating: cloning
  // or materializing run data can invoke caller getters/toJSON that reenter
  // this adapter, so an assert placed earlier in the method could be bypassed
  // by a handoff claimed in between.
  private setWorkflowRunRecord(workflowName: string, runId: string, record: StorageWorkflowRun): void {
    this.assertWorkflowSnapshotHandoffAvailable(workflowName, runId);
    this.db.workflows.set(this.getWorkflowKey(workflowName, runId), record);
  }

  private deleteWorkflowRunRecord(workflowName: string, runId: string): boolean {
    this.assertWorkflowSnapshotHandoffAvailable(workflowName, runId);
    return this.db.workflows.delete(this.getWorkflowKey(workflowName, runId));
  }

  private copyWorkflowSnapshotHandoff(record: WorkflowSnapshotHandoffRecord): WorkflowSnapshotHandoffRecord {
    return cloneRunData(record);
  }

  private getWorkflowSnapshotHandoffCanonicalStateFrom(
    run: StorageWorkflowRun | undefined,
  ): WorkflowSnapshotHandoffCanonicalState {
    if (!run) return { kind: 'absent' };
    const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new TypeError('Workflow snapshot handoff canonical snapshot is invalid');
    }
    // Materialize a clone, not the stored object: a stored snapshot's own
    // toJSON/getters can mutate the row mid-serialization, which would make
    // the observed canonical state disagree with the row left behind.
    return {
      kind: 'present',
      ...(run.resourceId === undefined ? {} : { resourceId: run.resourceId }),
      snapshot: materializeWorkflowSnapshotHandoffSnapshot(cloneRunData(snapshot)),
    };
  }

  private applyWorkflowResumeMutation(
    workflowName: string,
    runId: string,
    resourceId: string | undefined,
    mutate: (snapshot: WorkflowRunState | undefined) => { status: string; snapshot?: WorkflowRunState },
  ) {
    const key = this.getWorkflowKey(workflowName, runId);
    for (let attempt = 1; ; attempt++) {
      const existing = this.db.workflows.get(key);
      this.assertWorkflowSnapshotHandoffAvailable(workflowName, runId);
      // Cloning the stored snapshot and computing the mutation can invoke
      // caller toJSON/getters that reenter these maps. Re-read the source row
      // afterwards and restart if a reentrant write changed it mid-computation.
      const existingSnapshot = existing?.snapshot
        ? cloneRunData(typeof existing.snapshot === 'string' ? JSON.parse(existing.snapshot) : existing.snapshot)
        : undefined;
      const result = mutate(existingSnapshot);
      const { snapshot: updatedSnapshot, ...publicResult } = result;
      // Clone before the final source check: cloning invokes caller
      // toJSON/getters, so no caller code may run between the check and the
      // map write. The clone preserves prototypes, so `resourceId` can reach
      // an inherited getter — capture it before the check as well.
      const storedSnapshot = updatedSnapshot ? cloneRunData(updatedSnapshot) : undefined;
      const storedResourceId = storedSnapshot?.resourceId;
      if (this.db.workflows.get(key) !== existing) {
        throwIfWorkflowReentrantAttemptsExhausted(attempt);
        continue;
      }
      if (storedSnapshot && existing) {
        this.setWorkflowRunRecord(workflowName, runId, {
          ...existing,
          resourceId: existing.resourceId ?? resourceId ?? storedResourceId,
          snapshot: storedSnapshot,
          updatedAt: new Date(),
        });
        this.bumpParentRevision(key);
      }
      this.assertWorkflowSnapshotHandoffAvailable(workflowName, runId);
      return publicResult;
    }
  }

  async admitWorkflowResume(input: AdmitWorkflowResumeInput): Promise<AdmitWorkflowResumeResult> {
    // Pin every field in one ordered capture: CAS/identity fields before the
    // payload fields so a payload getter cannot retarget an expectation — each
    // input property's getter fires exactly once and a spread would re-read
    // them all.
    const {
      workflowName,
      runId,
      resumeOperationHash,
      executionGeneration,
      lifecycleResumeAttempt,
      lifecycleStepStates,
      nextLifecycleResumeAttempt,
      resourceId,
      requestContext,
      replaceRequestContext,
      operationReplayContext,
    } = input;
    const frozenInput: AdmitWorkflowResumeInput = {
      workflowName,
      runId,
      resumeOperationHash,
      executionGeneration,
      lifecycleResumeAttempt,
      lifecycleStepStates,
      nextLifecycleResumeAttempt,
      resourceId,
      requestContext,
      replaceRequestContext,
      operationReplayContext,
    };
    return this.applyWorkflowResumeMutation(workflowName, runId, resourceId, snapshot =>
      admitWorkflowResumeRecord(snapshot, frozenInput, Date.now(), cloneRunData),
    ) as AdmitWorkflowResumeResult;
  }

  async rollbackWorkflowResume(input: RollbackWorkflowResumeInput): Promise<RollbackWorkflowResumeResult> {
    const {
      workflowName,
      runId,
      resumeOperationHash,
      executionGeneration,
      lifecycleResumeAttempt,
      lifecycleStepStates,
      resourceId,
    } = input;
    const frozenInput: RollbackWorkflowResumeInput = {
      workflowName,
      runId,
      resumeOperationHash,
      executionGeneration,
      lifecycleResumeAttempt,
      lifecycleStepStates,
      resourceId,
    };
    return this.applyWorkflowResumeMutation(workflowName, runId, resourceId, snapshot =>
      rollbackWorkflowResumeRecord(snapshot, frozenInput, Date.now(), cloneRunData),
    ) as RollbackWorkflowResumeResult;
  }

  async finalizeWorkflowResume(input: FinalizeWorkflowResumeInput): Promise<FinalizeWorkflowResumeResult> {
    const {
      workflowName,
      runId,
      resumeOperationHash,
      executionGeneration,
      lifecycleResumeAttempt,
      lifecycleStepStates,
      resourceId,
      shouldPersistSnapshot,
      receiptKey,
      snapshot,
      result,
    } = input;
    const frozenInput: FinalizeWorkflowResumeInput = {
      workflowName,
      runId,
      resumeOperationHash,
      executionGeneration,
      lifecycleResumeAttempt,
      lifecycleStepStates,
      resourceId,
      shouldPersistSnapshot,
      receiptKey,
      snapshot,
      result,
    };
    return this.applyWorkflowResumeMutation(workflowName, runId, resourceId, snapshot =>
      finalizeWorkflowResumeRecord(snapshot, frozenInput, Date.now(), cloneRunData),
    ) as FinalizeWorkflowResumeResult;
  }

  async consumeWorkflowResumeResult(input: ConsumeWorkflowResumeResultInput): Promise<ConsumeWorkflowResumeResult> {
    const {
      workflowName,
      runId,
      resumeOperationHash,
      executionGeneration,
      lifecycleResumeAttempt,
      receiptKey,
      consumerId,
    } = input;
    const frozenInput: ConsumeWorkflowResumeResultInput = {
      workflowName,
      runId,
      resumeOperationHash,
      executionGeneration,
      lifecycleResumeAttempt,
      receiptKey,
      consumerId,
    };
    return this.applyWorkflowResumeMutation(workflowName, runId, undefined, snapshot =>
      consumeWorkflowResumeResultRecord(snapshot, frozenInput, Date.now(), cloneRunData),
    ) as ConsumeWorkflowResumeResult;
  }

  async persistWorkflowStepUpdate(input: PersistWorkflowStepUpdateInput): Promise<PersistWorkflowStepUpdateResult> {
    // Pin every field in one ordered capture: CAS/identity fields before the
    // payload `snapshot` so its getter cannot retarget an expectation — each
    // input property's getter fires exactly once and a spread would re-read
    // them all.
    const {
      workflowName,
      runId,
      resourceId,
      expectedResumeOperationHash,
      expectedExecutionGeneration,
      expectedLifecycleResumeAttempt,
      retainExistingLifecycleOutbox,
      lifecycleEvents,
      snapshot,
    } = input;
    const frozenInput: PersistWorkflowStepUpdateInput = {
      workflowName,
      runId,
      resourceId,
      expectedResumeOperationHash,
      expectedExecutionGeneration,
      expectedLifecycleResumeAttempt,
      retainExistingLifecycleOutbox,
      lifecycleEvents,
      snapshot,
    };
    const key = this.getWorkflowKey(workflowName, runId);
    for (let attempt = 1; ; attempt++) {
      const existing = this.db.workflows.get(key);
      this.assertWorkflowSnapshotHandoffAvailable(workflowName, runId);
      // Cloning the stored snapshot and merging the update can both invoke
      // caller toJSON/getters that reenter these maps. Re-read the source row
      // afterwards and restart if a reentrant write changed it mid-computation.
      const existingSnapshot = existing?.snapshot
        ? cloneRunData(typeof existing.snapshot === 'string' ? JSON.parse(existing.snapshot) : existing.snapshot)
        : undefined;
      const outcome = persistWorkflowStepUpdateRecord(existingSnapshot, frozenInput, cloneRunData);
      const { snapshot, ...result } = outcome;
      // Clone before the final source check so no caller code runs between
      // the check and the map write. The clone preserves prototypes, so
      // `resourceId` can reach an inherited getter — capture it first.
      const storedSnapshot = snapshot ? cloneRunData(snapshot) : undefined;
      const storedResourceId = storedSnapshot?.resourceId;
      if (this.db.workflows.get(key) !== existing) {
        throwIfWorkflowReentrantAttemptsExhausted(attempt);
        continue;
      }
      if (storedSnapshot) {
        const now = new Date();
        this.setWorkflowRunRecord(workflowName, runId, {
          workflow_name: workflowName,
          run_id: runId,
          resourceId: existing?.resourceId ?? storedResourceId ?? resourceId,
          snapshot: storedSnapshot,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
        this.bumpParentRevision(key);
      }
      this.assertWorkflowSnapshotHandoffAvailable(workflowName, runId);
      return result;
    }
  }

  async persistWorkflowTerminalRecoveryAncestry(
    input: PersistWorkflowTerminalRecoveryAncestryInput,
  ): Promise<PersistWorkflowTerminalRecoveryAncestryResult> {
    const operation = {
      workflowName: input.workflowName,
      runId: input.runId,
      ancestry: input.ancestry,
    };
    const key = this.getWorkflowKey(operation.workflowName, operation.runId);
    const desired = createWorkflowTerminalRecoveryAncestryRecord(
      operation.workflowName,
      operation.runId,
      operation.ancestry,
      Date.now(),
    );
    const existing = this.db.workflowTerminalRecoveryAncestries.get(key);
    if (existing) {
      validateWorkflowTerminalRecoveryAncestryRecord(existing, {
        workflowName: operation.workflowName,
        runId: operation.runId,
        now: Date.now(),
      });
      return sameWorkflowTerminalRecoveryAncestry(existing, desired)
        ? { status: 'already_persisted', record: copyWorkflowTerminalRecoveryAncestryRecord(existing) }
        : { status: 'ancestry_conflict' };
    }
    for (const frame of desired.ancestry) {
      const parentKey = this.getWorkflowKey(frame.parentWorkflowName, frame.parentRunId);
      const parentRevision = this.db.workflowTerminalParentRevisions.get(parentKey);
      if (parentRevision?.terminalStatus) {
        throw new TypeError('Workflow terminal recovery ancestry parent evidence is unavailable');
      }
      const parentJournal = this.db.workflowTerminalizations.get(parentKey);
      const parentRun = this.db.workflows.get(parentKey);
      const parentSnapshot = parentRun?.snapshot;
      const parentStatus = parentSnapshot && typeof parentSnapshot !== 'string' ? parentSnapshot.status : undefined;
      if (isTerminalParentStatus(parentStatus)) {
        this.latchParentTerminalStatus(parentKey, parentStatus);
        throw new TypeError('Workflow terminal recovery ancestry parent evidence is unavailable');
      }
      if (!parentJournal && (!parentRun || parentStatus === undefined)) {
        throw new TypeError('Workflow terminal recovery ancestry parent evidence is unavailable');
      }
      if (!parentSnapshot || typeof parentSnapshot === 'string') {
        throw new TypeError('Workflow terminal recovery ancestry parent graph is unavailable');
      }
      validateWorkflowTerminalRecoveryParentFrameGraphBinding(frame, parentSnapshot.serializedStepGraph);
    }
    const immediate = desired.ancestry[0];
    if (immediate) {
      const parentKey = this.getWorkflowKey(immediate.parentWorkflowName, immediate.parentRunId);
      const parentRecovery = this.db.workflowTerminalRecoveryAncestries.get(parentKey);
      const expectedTailHash = createWorkflowTerminalRecoveryAncestryRecord(
        immediate.parentWorkflowName,
        immediate.parentRunId,
        desired.ancestry.slice(1),
        desired.createdAt,
      ).ancestryHash;
      const retainedTailHash = createWorkflowTerminalRecoveryAncestryRecord(
        immediate.parentWorkflowName,
        immediate.parentRunId,
        parentRecovery?.ancestry ?? [],
        desired.createdAt,
      ).ancestryHash;
      if (expectedTailHash !== retainedTailHash) {
        return { status: 'ancestry_conflict' };
      }
    }
    this.db.workflowTerminalRecoveryAncestries.set(key, copyWorkflowTerminalRecoveryAncestryRecord(desired));
    return { status: 'persisted', record: copyWorkflowTerminalRecoveryAncestryRecord(desired) };
  }

  async getWorkflowTerminalRecoveryAncestry(
    input: GetWorkflowTerminalizationInput,
  ): Promise<GetWorkflowTerminalRecoveryAncestryResult> {
    const key = this.getWorkflowKey(input.workflowName, input.runId);
    const existing = this.db.workflowTerminalRecoveryAncestries.get(key);
    if (existing) {
      validateWorkflowTerminalRecoveryAncestryRecord(existing, {
        workflowName: input.workflowName,
        runId: input.runId,
        now: Date.now(),
      });
      return { status: 'found', record: copyWorkflowTerminalRecoveryAncestryRecord(existing) };
    }
    return { status: 'missing_ancestry' };
  }

  private getTerminalizationKey(workflowName: string, runId: string): string {
    return this.getWorkflowKey(workflowName, runId);
  }

  private getTerminalEffectKey(workflowName: string, runId: string, kind: string): string {
    return JSON.stringify([workflowName, runId, kind]);
  }

  private getTerminalDestinationReceipt(
    effect: WorkflowTerminalEffectRecord,
    consumerId: string,
  ): WorkflowTerminalDestinationReceiptRecord | undefined {
    const matches = this.db.workflowTerminalDestinationReceipts.findMatches(effect, consumerId);
    if (matches.length > 1) {
      throw new TypeError('Conflicting workflow terminal destination receipt storage');
    }
    return matches[0];
  }

  private resolveTerminalDestinationReceiptPreflight(
    operation: ReserveWorkflowTerminalDestinationReceiptInput | GetWorkflowTerminalDestinationReceiptInput,
    now: number,
  ):
    | { status: 'missing_run' }
    | {
        status: 'found';
        journalKey: string;
        journal: WorkflowTerminalizationRecord | undefined;
        effect: WorkflowTerminalEffectRecord | undefined;
        receipt: WorkflowTerminalDestinationReceiptRecord | undefined;
      } {
    validateWorkflowTerminalizationFence(operation);
    validateWorkflowTerminalizationRunIdentity(operation);
    validateWorkflowTerminalizationIdentity(operation.consumerId, 'consumerId', 256);
    const journalKey = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const workflowKey = this.getWorkflowKey(operation.workflowName, operation.runId);
    const journal = this.db.workflowTerminalizations.get(journalKey);
    if (!journal && !this.db.workflows.has(workflowKey)) return { status: 'missing_run' };
    const effect = this.db.workflowTerminalEffects.get(
      this.getTerminalEffectKey(operation.workflowName, operation.runId, operation.effectKind),
    );
    if (effect && journal) {
      validateWorkflowTerminalEffectIntegrity(effect);
      validateWorkflowTerminalEffectJournalLink(effect, journal, operation.workflowName, operation.runId);
    }
    const receipt = effect ? this.getTerminalDestinationReceipt(effect, operation.consumerId) : undefined;
    if (effect && receipt) {
      validateWorkflowTerminalDestinationReceiptIntegrity(receipt, effect, now);
      if (receipt.consumerId !== operation.consumerId) {
        throw new TypeError('Conflicting workflow terminal destination receipt storage');
      }
    }
    return { status: 'found', journalKey, journal, effect, receipt };
  }

  private getTerminalContinuationPlan(
    effect: WorkflowTerminalEffectRecord,
    receipt: WorkflowTerminalDestinationReceiptRecord,
  ): WorkflowTerminalContinuationPlanRecord | undefined {
    const matches: WorkflowTerminalContinuationPlanRecord[] = [];
    for (const [physicalKey, plan] of this.db.workflowTerminalContinuationPlans) {
      if (
        physicalKey === receipt.receiptKey ||
        plan.receiptKey === receipt.receiptKey ||
        (plan.effectKey === effect.effectKey && plan.consumerId === WORKFLOW_TERMINAL_PARENT_APPLICATION_CONSUMER_ID)
      ) {
        matches.push(plan);
      }
    }
    if (matches.length > 1) {
      throw new TypeError('Conflicting workflow terminal continuation plan storage');
    }
    return matches[0];
  }

  private getParentRevision(key: string): string {
    const existing = this.db.workflowTerminalParentRevisions.get(key);
    if (existing) return `mem:v1:${existing.generation}`;
    const snapshot = this.db.workflows.get(key)?.snapshot;
    const status = snapshot && typeof snapshot !== 'string' ? snapshot.status : undefined;
    const revision: WorkflowTerminalParentRevisionState = {
      generation: 1,
      terminalStatus: isTerminalParentStatus(status) ? status : null,
    };
    this.db.workflowTerminalParentRevisions.set(key, revision);
    return `mem:v1:${revision.generation}`;
  }

  private bumpParentRevision(key: string): void {
    const existing = this.db.workflowTerminalParentRevisions.get(key);
    const generation = (existing?.generation ?? 0) + 1;
    if (!Number.isSafeInteger(generation)) throw new TypeError('Workflow parent revision exhausted');
    const snapshot = this.db.workflows.get(key)?.snapshot;
    const status = snapshot && typeof snapshot !== 'string' ? snapshot.status : undefined;
    this.db.workflowTerminalParentRevisions.set(key, {
      generation,
      terminalStatus: existing?.terminalStatus ?? (isTerminalParentStatus(status) ? status : null),
    });
  }

  private latchParentTerminalStatus(key: string, terminalStatus: TerminalParentStatus): void {
    const existing = this.db.workflowTerminalParentRevisions.get(key);
    if (existing?.terminalStatus) {
      if (existing.terminalStatus !== terminalStatus) {
        throw new TypeError('Workflow parent terminal marker conflicts with authoritative terminal status');
      }
      return;
    }
    const generation = (existing?.generation ?? 0) + 1;
    if (!Number.isSafeInteger(generation)) throw new TypeError('Workflow parent revision exhausted');
    this.db.workflowTerminalParentRevisions.set(key, {
      generation,
      terminalStatus,
    });
  }

  /**
   * Cleanup is child-first. A completed ancestor remains recovery evidence
   * while any recursively linked child lacks a completed terminal journal.
   * Corrupt or missing descendant journals fail closed as pending.
   */
  private hasPendingTerminalDependents(workflowName: string, runId: string): boolean {
    const childrenByParent = new Map<string, Set<string>>();
    const addChild = (parentKey: string, childKey: string): void => {
      const children = childrenByParent.get(parentKey);
      if (children) children.add(childKey);
      else childrenByParent.set(parentKey, new Set([childKey]));
    };
    for (const effect of this.db.workflowTerminalEffects.values()) {
      if (effect.kind !== 'parent-workflow-step-end') continue;
      addChild(
        JSON.stringify([effect.parentWorkflowName, effect.parentRunId]),
        JSON.stringify([effect.workflowName, effect.runId]),
      );
    }
    for (const ancestryRecord of this.db.workflowTerminalRecoveryAncestries.values()) {
      const immediate = ancestryRecord.ancestry[0];
      if (!immediate) continue;
      addChild(
        JSON.stringify([immediate.parentWorkflowName, immediate.parentRunId]),
        JSON.stringify([ancestryRecord.workflowName, ancestryRecord.runId]),
      );
    }

    const rootIdentity = JSON.stringify([workflowName, runId]);
    const identities = new Set([rootIdentity]);
    const queue = [rootIdentity];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const childKey of childrenByParent.get(queue[cursor]!) ?? []) {
        if (identities.has(childKey)) continue;
        if (identities.size >= 100_000) return true;
        identities.add(childKey);
        queue.push(childKey);
      }
    }

    for (const identity of identities) {
      if (identity !== rootIdentity) {
        const journal = this.db.workflowTerminalizations.get(identity);
        if (!journal || journal.phase !== 'complete') return true;
      }
    }
    return false;
  }

  async claimWorkflowTerminalization(
    input: ClaimWorkflowTerminalizationInput,
  ): Promise<ClaimWorkflowTerminalizationResult> {
    const operation: ClaimWorkflowTerminalizationInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      eventKey: input.eventKey,
      terminalStatus: input.terminalStatus,
      ownerId: input.ownerId,
      leaseMs: input.leaseMs,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
    };
    validateWorkflowTerminalizationClaim(operation);
    const key = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const existing = this.db.workflowTerminalizations.get(key);
    if (!existing && !this.db.workflows.has(this.getWorkflowKey(operation.workflowName, operation.runId))) {
      return { status: 'missing_run' };
    }
    const result = claimWorkflowTerminalizationRecord(existing, operation, Date.now(), randomUUID());
    if (result.status === 'acquired' || result.status === 'renewed') {
      this.latchParentTerminalStatus(key, result.record.terminalStatus);
      this.db.workflowTerminalizations.set(key, copyWorkflowTerminalizationRecord(result.record));
      return result;
    }
    return 'record' in result
      ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
      : result;
  }

  async getWorkflowTerminalization(input: GetWorkflowTerminalizationInput): Promise<GetWorkflowTerminalizationResult> {
    const operation: GetWorkflowTerminalizationInput = {
      workflowName: input.workflowName,
      runId: input.runId,
    };
    const record = this.db.workflowTerminalizations.get(
      this.getTerminalizationKey(operation.workflowName, operation.runId),
    );
    if (record) return { status: 'found', record: observeWorkflowTerminalizationRecord(record) };
    return this.db.workflows.has(this.getWorkflowKey(operation.workflowName, operation.runId))
      ? { status: 'missing_record' }
      : { status: 'missing_run' };
  }

  async getWorkflowRunTerminalStatus(
    input: GetWorkflowRunTerminalStatusInput,
  ): Promise<GetWorkflowRunTerminalStatusResult> {
    const operation = captureWorkflowRunIdentity(input);
    const key = this.getWorkflowKey(operation.workflowName, operation.runId);
    const terminalStatus: unknown = this.db.workflowTerminalParentRevisions.get(key)?.terminalStatus;
    if (terminalStatus !== null && terminalStatus !== undefined) {
      if (!isTerminalParentStatus(terminalStatus)) throw new TypeError('Invalid workflow parent terminal status');
      return { status: 'terminal', terminalStatus };
    }
    const stored = this.db.workflows.get(key);
    if (!stored?.snapshot) return { status: 'missing_run' };
    const snapshot = typeof stored.snapshot === 'string' ? JSON.parse(stored.snapshot) : stored.snapshot;
    if (isTerminalParentStatus(snapshot.status)) {
      this.latchParentTerminalStatus(key, snapshot.status);
      return { status: 'terminal', terminalStatus: snapshot.status };
    }
    if (!['running', 'suspended', 'waiting', 'pending', 'paused'].includes(snapshot.status)) {
      throw new TypeError('Invalid workflow run status');
    }
    return { status: 'nonterminal' };
  }

  async advanceWorkflowTerminalization(
    input: AdvanceWorkflowTerminalizationInput,
  ): Promise<AdvanceWorkflowTerminalizationResult> {
    const operation: AdvanceWorkflowTerminalizationInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      expectedPhase: input.expectedPhase,
      nextPhase: input.nextPhase,
      leaseMs: input.leaseMs,
    };
    validateWorkflowTerminalizationFence(operation);
    const key = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const existing = this.db.workflowTerminalizations.get(key);
    if (!existing && !this.db.workflows.has(this.getWorkflowKey(operation.workflowName, operation.runId))) {
      return { status: 'missing_run' };
    }
    const result = advanceWorkflowTerminalizationRecord(existing, operation, Date.now());
    if (result.status === 'advanced') {
      this.db.workflowTerminalizations.set(key, copyWorkflowTerminalizationRecord(result.record));
    }
    return 'record' in result
      ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
      : result;
  }

  async releaseWorkflowTerminalization(
    input: ReleaseWorkflowTerminalizationInput,
  ): Promise<ReleaseWorkflowTerminalizationResult> {
    const operation: ReleaseWorkflowTerminalizationInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
    };
    validateWorkflowTerminalizationFence(operation);
    const key = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const existing = this.db.workflowTerminalizations.get(key);
    if (!existing && !this.db.workflows.has(this.getWorkflowKey(operation.workflowName, operation.runId))) {
      return { status: 'missing_run' };
    }
    const result = releaseWorkflowTerminalizationRecord(existing, operation, Date.now());
    if (result.status === 'released') {
      this.db.workflowTerminalizations.set(key, copyWorkflowTerminalizationRecord(result.record));
    }
    return 'record' in result
      ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
      : result;
  }

  async deleteCompletedWorkflowTerminalizations(
    input: DeleteCompletedWorkflowTerminalizationsInput,
  ): Promise<DeleteCompletedWorkflowTerminalizationsResult> {
    const operation: DeleteCompletedWorkflowTerminalizationsInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      olderThan: input.olderThan,
    };
    const olderThan = operation.olderThan.getTime();
    if (Number.isNaN(olderThan)) throw new TypeError('olderThan must be a valid Date');

    const key = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const record = this.db.workflowTerminalizations.get(key);
    if (!record) {
      return this.db.workflows.has(this.getWorkflowKey(operation.workflowName, operation.runId))
        ? { status: 'deleted', count: 0 }
        : { status: 'missing_run', count: 0 };
    }
    if (
      record.phase === 'complete' &&
      record.completedAt !== undefined &&
      record.completedAt < olderThan &&
      !this.hasPendingTerminalDependents(operation.workflowName, operation.runId)
    ) {
      this.latchParentTerminalStatus(key, record.terminalStatus);
      // Delete leaf evidence first and the owning journal last. This mirrors
      // durable adapters and prevents future dependent evidence from outliving
      // its recovery root if a new validation step throws.
      for (const [planKey, plan] of this.db.workflowTerminalContinuationPlans) {
        if (plan.workflowName === operation.workflowName && plan.runId === operation.runId) {
          this.db.workflowTerminalContinuationPlans.delete(planKey);
        }
      }
      for (const [receiptKey, receipt] of this.db.workflowTerminalDestinationReceipts) {
        if (receipt.workflowName === operation.workflowName && receipt.runId === operation.runId) {
          this.db.workflowTerminalDestinationReceipts.delete(receiptKey);
        }
      }
      this.db.workflowTerminalEffects.delete(
        this.getTerminalEffectKey(operation.workflowName, operation.runId, 'parent-workflow-step-end'),
      );
      this.db.workflowTerminalEffects.delete(
        this.getTerminalEffectKey(operation.workflowName, operation.runId, 'workflow-finish'),
      );
      this.db.workflowTerminalSnapshots.delete(key);
      this.db.workflowTerminalRecoveryAncestries.delete(key);
      this.db.workflowTerminalizations.delete(key);
      return { status: 'deleted', count: 1 };
    }
    return { status: 'deleted', count: 0 };
  }

  async persistWorkflowTerminalState(
    input: PersistWorkflowTerminalStateInput,
  ): Promise<PersistWorkflowTerminalStateResult> {
    // Read the operation envelope exactly once. Accessor-backed inputs must not
    // be able to point the journal lookup and snapshot write at different runs.
    const operation: PersistWorkflowTerminalStateInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      snapshot: input.snapshot,
      recoveryEnvelope: input.recoveryEnvelope,
      resourceId: input.resourceId,
      leaseMs: input.leaseMs,
    };
    validateWorkflowTerminalizationFence(operation);
    const journalKey = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const workflowKey = this.getWorkflowKey(operation.workflowName, operation.runId);
    const existingJournal = this.db.workflowTerminalizations.get(journalKey);
    const existingRun = this.db.workflows.get(workflowKey);
    if (!existingJournal && !existingRun) return { status: 'missing_run' };
    const result = persistWorkflowTerminalStateRecord(
      existingJournal,
      this.db.workflowTerminalRecoveryAncestries.get(journalKey),
      operation,
      Date.now(),
      materializeTerminalSnapshot,
    );
    if (result.status === 'advanced') {
      if (!existingRun) return { status: 'missing_run' };
      this.assertWorkflowSnapshotHandoffAvailable(operation.workflowName, operation.runId);
      const resourceId = operation.resourceId ?? existingRun.resourceId;
      if (resourceId !== undefined) {
        validateWorkflowTerminalizationIdentity(resourceId, 'resourceId', 512);
      }
      const now = new Date(result.record.updatedAt);
      if (this.db.workflowTerminalSnapshots.has(journalKey)) {
        throw new TypeError('Workflow terminal state already retained');
      }
      const retained: WorkflowTerminalSnapshotRecord = {
        version: 1,
        workflowName: operation.workflowName,
        runId: operation.runId,
        ...(resourceId === undefined ? {} : { resourceId }),
        terminalStatus: result.record.terminalStatus,
        envelopeHash: result.recovery.envelopeHash,
        recordHash: getWorkflowTerminalSnapshotRecordHash({
          version: 1,
          workflowName: operation.workflowName,
          runId: operation.runId,
          ...(resourceId === undefined ? {} : { resourceId }),
          terminalStatus: result.record.terminalStatus,
          envelopeHash: result.recovery.envelopeHash,
          createdAt: result.record.updatedAt,
        }),
        envelope: result.recovery.envelope,
        createdAt: result.record.updatedAt,
      };
      this.setWorkflowRunRecord(operation.workflowName, operation.runId, {
        ...existingRun,
        resourceId,
        snapshot: result.snapshot,
        updatedAt: now,
      });
      this.bumpParentRevision(workflowKey);
      this.db.workflowTerminalSnapshots.set(journalKey, retained);
      this.db.workflowTerminalizations.set(journalKey, copyWorkflowTerminalizationRecord(result.record));
      return { status: 'persisted', record: observeWorkflowTerminalizationRecord(result.record) };
    }
    return 'record' in result
      ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
      : result;
  }

  async prepareWorkflowTerminalEffect(
    input: PrepareWorkflowTerminalEffectInput,
  ): Promise<PrepareWorkflowTerminalEffectResult> {
    const operation: PrepareWorkflowTerminalEffectInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      expectedPhase: input.expectedPhase,
      effect: materializeWorkflowTerminalEffectDescriptor(input.effect),
      leaseMs: input.leaseMs,
    };
    validateWorkflowTerminalizationFence(operation);
    const journalKey = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const workflowKey = this.getWorkflowKey(operation.workflowName, operation.runId);
    const effectKey = this.getTerminalEffectKey(operation.workflowName, operation.runId, operation.effect.kind);
    const existingJournal = this.db.workflowTerminalizations.get(journalKey);
    if (!existingJournal && !this.db.workflows.has(workflowKey)) return { status: 'missing_run' };
    const existingEffect = this.db.workflowTerminalEffects.get(effectKey);
    const retained = this.db.workflowTerminalSnapshots.get(journalKey);
    if (existingEffect && existingJournal) {
      if (existingEffect.kind !== operation.effect.kind) {
        throw new TypeError('Invalid workflow terminal effect kind');
      }
      validateWorkflowTerminalEffectIntegrity(existingEffect);
      validateWorkflowTerminalEffectJournalLink(
        existingEffect,
        existingJournal,
        operation.workflowName,
        operation.runId,
      );
    }
    const result = prepareWorkflowTerminalEffectRecord(
      existingJournal,
      existingEffect,
      retained,
      operation,
      Date.now(),
    );
    if (result.status === 'prepared' || result.status === 'already_prepared') {
      if (!retained) return { status: 'missing_terminal_state' };
      validateWorkflowTerminalSnapshotJournalLink(retained, result.record, operation.workflowName, operation.runId);
      validateWorkflowTerminalEffectRecoveryLink(result.effect, retained);
    }
    if (result.status === 'prepared') {
      this.db.workflowTerminalEffects.set(effectKey, copyWorkflowTerminalEffectRecord(result.effect));
      this.db.workflowTerminalizations.set(journalKey, copyWorkflowTerminalizationRecord(result.record));
      return { status: result.status, effect: copyWorkflowTerminalEffectRecord(result.effect) };
    }
    if (result.status === 'already_prepared') {
      if (operation.leaseMs !== undefined) {
        this.db.workflowTerminalizations.set(journalKey, copyWorkflowTerminalizationRecord(result.record));
      }
      return { status: result.status, effect: copyWorkflowTerminalEffectRecord(result.effect) };
    }
    if (result.status === 'effect_conflict') {
      return {
        status: result.status,
        effect: observeWorkflowTerminalEffectRecord(result.effect),
        record: observeWorkflowTerminalizationRecord(result.record),
      };
    }
    return 'record' in result
      ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
      : result;
  }

  async getWorkflowTerminalEffectForDispatch(
    input: GetWorkflowTerminalEffectForDispatchInput,
  ): Promise<GetWorkflowTerminalEffectForDispatchResult> {
    const operation: GetWorkflowTerminalEffectForDispatchInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      kind: materializeWorkflowTerminalEffectKind(input.kind),
    };
    validateWorkflowTerminalizationFence(operation);
    validateWorkflowTerminalizationRunIdentity(operation);
    const journalKey = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const workflowKey = this.getWorkflowKey(operation.workflowName, operation.runId);
    const existingJournal = this.db.workflowTerminalizations.get(journalKey);
    if (!existingJournal && !this.db.workflows.has(workflowKey)) return { status: 'missing_run' };
    const existingEffect = this.db.workflowTerminalEffects.get(
      this.getTerminalEffectKey(operation.workflowName, operation.runId, operation.kind),
    );
    if (existingEffect && existingJournal) {
      if (existingEffect.kind !== operation.kind) {
        throw new TypeError('Invalid workflow terminal effect kind');
      }
      validateWorkflowTerminalEffectIntegrity(existingEffect);
      validateWorkflowTerminalEffectJournalLink(
        existingEffect,
        existingJournal,
        operation.workflowName,
        operation.runId,
      );
    }
    const result = getWorkflowTerminalEffectForDispatchRecord(existingJournal, existingEffect, operation, Date.now());
    const retained = result.status === 'found' ? this.db.workflowTerminalSnapshots.get(journalKey) : undefined;
    if (result.status === 'found' && !retained) return { status: 'missing_terminal_state' };
    if (result.status === 'found') {
      validateWorkflowTerminalSnapshotJournalLink(retained!, existingJournal!, operation.workflowName, operation.runId);
      validateWorkflowTerminalEffectRecoveryLink(result.effect, retained!);
    }
    return 'record' in result
      ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
      : result.status === 'found'
        ? { ...result, recovery: cloneRunData(retained!) }
        : result;
  }

  async reserveWorkflowTerminalDestinationReceipt(
    input: ReserveWorkflowTerminalDestinationReceiptInput,
  ): Promise<ReserveWorkflowTerminalDestinationReceiptResult> {
    const operation: ReserveWorkflowTerminalDestinationReceiptInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      effectKind: materializeWorkflowTerminalEffectKind(input.effectKind),
      consumerId: input.consumerId,
    };
    const now = Date.now();
    const preflight = this.resolveTerminalDestinationReceiptPreflight(operation, now);
    if (preflight.status === 'missing_run') return preflight;
    const { journalKey, journal, effect, receipt: existingReceipt } = preflight;
    const existingReceiptCount = effect ? this.db.workflowTerminalDestinationReceipts.countForEffect(effect) : 0;
    const result = reserveWorkflowTerminalDestinationReceiptRecord(
      journal,
      effect,
      existingReceipt,
      existingReceiptCount,
      operation,
      now,
    );
    if (result.status === 'reserved' || result.status === 'already_exists') {
      const retained = this.db.workflowTerminalSnapshots.get(journalKey);
      if (!retained) return { status: 'missing_terminal_state' };
      validateWorkflowTerminalSnapshotJournalLink(retained, journal!, operation.workflowName, operation.runId);
      validateWorkflowTerminalEffectRecoveryLink(effect!, retained);
      if (result.status === 'reserved') {
        this.db.workflowTerminalDestinationReceipts.set(
          JSON.stringify([result.receipt.effectKey, result.receipt.consumerId]),
          copyWorkflowTerminalDestinationReceiptRecord(result.receipt),
        );
      }
      return { status: result.status, receipt: copyWorkflowTerminalDestinationReceiptRecord(result.receipt) };
    }
    return 'record' in result
      ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
      : result;
  }

  async getWorkflowTerminalDestinationReceipt(
    input: GetWorkflowTerminalDestinationReceiptInput,
  ): Promise<GetWorkflowTerminalDestinationReceiptResult> {
    const operation: GetWorkflowTerminalDestinationReceiptInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      effectKind: materializeWorkflowTerminalEffectKind(input.effectKind),
      consumerId: input.consumerId,
    };
    const now = Date.now();
    const preflight = this.resolveTerminalDestinationReceiptPreflight(operation, now);
    if (preflight.status === 'missing_run') return preflight;
    const { journalKey, journal, effect, receipt } = preflight;
    const result = getWorkflowTerminalDestinationReceiptRecord(journal, effect, receipt, operation, now);
    if (result.status === 'found') {
      const retained = this.db.workflowTerminalSnapshots.get(journalKey);
      if (!retained) return { status: 'missing_terminal_state' };
      validateWorkflowTerminalSnapshotJournalLink(retained, journal!, operation.workflowName, operation.runId);
      validateWorkflowTerminalEffectRecoveryLink(effect!, retained);
      return { status: 'found', receipt: copyWorkflowTerminalDestinationReceiptRecord(result.receipt) };
    }
    return 'record' in result
      ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
      : result;
  }

  async getWorkflowTerminalParentContext(
    input: GetWorkflowTerminalParentContextInput,
  ): Promise<GetWorkflowTerminalParentContextResult> {
    const operation = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      kind: 'parent-workflow-step-end' as const,
    };
    validateWorkflowTerminalizationRunIdentity(operation);
    validateWorkflowTerminalizationFence(operation);
    const journalKey = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const childKey = this.getWorkflowKey(operation.workflowName, operation.runId);
    const journal = this.db.workflowTerminalizations.get(journalKey);
    if (!journal && !this.db.workflows.has(childKey)) return { status: 'missing_run' };
    const effect = this.db.workflowTerminalEffects.get(
      this.getTerminalEffectKey(operation.workflowName, operation.runId, operation.kind),
    );
    const result = getWorkflowTerminalEffectForDispatchRecord(journal, effect, operation, Date.now());
    if (result.status !== 'found') {
      return 'record' in result
        ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
        : result;
    }
    if (result.effect.kind !== 'parent-workflow-step-end') return { status: 'missing_effect' };
    if (journal?.phase !== 'parent_outbox_pending') {
      return journal
        ? { status: 'phase_conflict', record: observeWorkflowTerminalizationRecord(journal) }
        : { status: 'missing_record' };
    }
    validateWorkflowTerminalEffectJournalLink(result.effect, journal, operation.workflowName, operation.runId);
    const retained = this.db.workflowTerminalSnapshots.get(journalKey);
    if (!retained) return { status: 'missing_terminal_state' };
    validateWorkflowTerminalSnapshotJournalLink(retained, journal, operation.workflowName, operation.runId);
    validateWorkflowTerminalEffectRecoveryLink(result.effect, retained);
    const parentKey = this.getWorkflowKey(result.effect.parentWorkflowName, result.effect.parentRunId);
    const parent = this.db.workflows.get(parentKey);
    if (!parent?.snapshot) return { status: 'missing_parent' };
    const snapshot = typeof parent.snapshot === 'string' ? JSON.parse(parent.snapshot) : parent.snapshot;
    const parentStatus = this.db.workflowTerminalParentRevisions.get(parentKey)?.terminalStatus;
    const snapshotTerminalStatus = isTerminalParentStatus(snapshot.status) ? snapshot.status : undefined;
    if (parentStatus && parentStatus !== snapshotTerminalStatus) return { status: 'parent_conflict' };
    if (!parentStatus && snapshotTerminalStatus) {
      this.latchParentTerminalStatus(parentKey, snapshotTerminalStatus);
    }
    return {
      status: 'found',
      effect: copyWorkflowTerminalEffectRecord(result.effect) as Extract<
        WorkflowTerminalEffectRecord,
        { kind: 'parent-workflow-step-end' }
      >,
      retainedChild: cloneRunData(retained),
      parentWorkflowName: result.effect.parentWorkflowName,
      parentRunId: result.effect.parentRunId,
      revision: this.getParentRevision(parentKey),
      snapshot: cloneRunData(snapshot),
    };
  }

  async getWorkflowTerminalContinuationPlan(
    input: GetWorkflowTerminalContinuationPlanInput,
  ): Promise<GetWorkflowTerminalContinuationPlanResult> {
    const operation: GetWorkflowTerminalContinuationPlanInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
    };
    validateWorkflowTerminalizationRunIdentity(operation);
    validateWorkflowTerminalizationFence(operation);
    const journalKey = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const workflowKey = this.getWorkflowKey(operation.workflowName, operation.runId);
    const journal = this.db.workflowTerminalizations.get(journalKey);
    if (!journal && !this.db.workflows.has(workflowKey)) return { status: 'missing_run' };
    const now = Date.now();
    const effect = this.db.workflowTerminalEffects.get(
      this.getTerminalEffectKey(operation.workflowName, operation.runId, 'parent-workflow-step-end'),
    );
    const receipt =
      effect?.kind === 'parent-workflow-step-end'
        ? this.getTerminalDestinationReceipt(effect, WORKFLOW_TERMINAL_PARENT_APPLICATION_CONSUMER_ID)
        : undefined;
    const plan =
      effect?.kind === 'parent-workflow-step-end' && receipt
        ? this.getTerminalContinuationPlan(effect, receipt)
        : undefined;
    const result = getWorkflowTerminalContinuationPlanRecord(journal, effect, receipt, plan, operation, now);
    return 'record' in result
      ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
      : result;
  }

  async applyWorkflowTerminalParentEffect(
    input: ApplyWorkflowTerminalParentEffectInput,
  ): Promise<ApplyWorkflowTerminalParentEffectResult> {
    let contract: ApplyWorkflowTerminalParentEffectInput['contract'];
    try {
      contract = copyWorkflowTerminalParentContinuationContract(input.contract);
    } catch {
      return { status: 'invalid_contract' };
    }
    const operation: ApplyWorkflowTerminalParentEffectInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      contract,
    };
    validateWorkflowTerminalizationRunIdentity(operation);
    validateWorkflowTerminalizationFence(operation);
    const journalKey = this.getTerminalizationKey(operation.workflowName, operation.runId);
    const childRunKey = this.getWorkflowKey(operation.workflowName, operation.runId);
    const journal = this.db.workflowTerminalizations.get(journalKey);
    if (!journal && !this.db.workflows.has(childRunKey)) return { status: 'missing_run' };
    const now = Date.now();
    const effect = this.db.workflowTerminalEffects.get(
      this.getTerminalEffectKey(operation.workflowName, operation.runId, 'parent-workflow-step-end'),
    );
    const receipt = effect
      ? this.getTerminalDestinationReceipt(effect, WORKFLOW_TERMINAL_PARENT_APPLICATION_CONSUMER_ID)
      : undefined;
    const existingPlan = effect && receipt ? this.getTerminalContinuationPlan(effect, receipt) : undefined;
    const prepared = prepareWorkflowTerminalParentApplicationRecords(
      journal,
      effect,
      receipt,
      existingPlan,
      operation,
      now,
    );
    if (prepared.status === 'contract_conflict') {
      return { status: prepared.status, plan: observeWorkflowTerminalContinuationPlanRecord(prepared.plan) };
    }
    if ('record' in prepared) {
      return { status: prepared.status, record: observeWorkflowTerminalizationRecord(prepared.record) };
    }
    if (!('journal' in prepared)) return { status: prepared.status };
    if (prepared.status === 'already_applied' || prepared.status === 'already_quarantined') {
      return { status: prepared.status, plan: copyWorkflowTerminalContinuationPlanRecord(prepared.plan) };
    }
    if (!effect || effect.kind !== 'parent-workflow-step-end') {
      throw new TypeError('Parent application became ready without a parent effect');
    }

    const retained = this.db.workflowTerminalSnapshots.get(journalKey);
    if (!retained) return { status: 'missing_child_terminal_state' };
    try {
      validateWorkflowTerminalSnapshotJournalLink(retained, prepared.journal, operation.workflowName, operation.runId);
      validateWorkflowTerminalEffectRecoveryLink(effect, retained);
    } catch {
      return { status: 'corrupt_child_terminal_state' };
    }
    const parentKey = this.getWorkflowKey(effect.parentWorkflowName, effect.parentRunId);
    const parentRun = this.db.workflows.get(parentKey);
    if (!parentRun?.snapshot) return { status: 'missing_parent' };
    let parentSnapshot: WorkflowRunState;
    try {
      parentSnapshot = cloneRunData(
        typeof parentRun.snapshot === 'string' ? JSON.parse(parentRun.snapshot) : parentRun.snapshot,
      );
    } catch {
      return { status: 'corrupt_parent_state' };
    }

    const storedParentRevision = this.db.workflowTerminalParentRevisions.get(parentKey);
    if (storedParentRevision === undefined) return { status: 'corrupt_parent_state' };
    if (`mem:v1:${storedParentRevision.generation}` !== operation.contract.expectedParentRevision) {
      return { status: 'parent_conflict' };
    }
    const snapshotTerminalStatus = isTerminalParentStatus(parentSnapshot.status) ? parentSnapshot.status : undefined;
    const terminalNoop = operation.contract.action.kind === 'noop' && operation.contract.patch.kind === 'none';
    if (storedParentRevision.terminalStatus !== null || snapshotTerminalStatus !== undefined) {
      if (
        storedParentRevision.terminalStatus === null ||
        snapshotTerminalStatus === undefined ||
        storedParentRevision.terminalStatus !== snapshotTerminalStatus ||
        !terminalNoop
      ) {
        return { status: 'parent_conflict' };
      }
    }
    const storageTimestamp = now;
    let patchTimestamp: number;
    try {
      patchTimestamp = validateWorkflowSnapshotTimestampForFinalState(parentSnapshot.timestamp, storageTimestamp);
    } catch {
      return { status: 'corrupt_parent_state' };
    }
    let patchedParent: WorkflowRunState;
    try {
      patchedParent = applyWorkflowTerminalParentContinuationPatch({
        contract: prepared.plan.contract,
        effect,
        parentRevision: operation.contract.expectedParentRevision,
        parentWorkflowName: effect.parentWorkflowName,
        parentSnapshot,
        retainedChild: retained,
        storageTimestamp: patchTimestamp,
        executionMode: 'continuous',
      });
    } catch (error) {
      if (error instanceof WorkflowTerminalContinuationStoredStateError) {
        return {
          status: error.state === 'child' ? 'corrupt_child_terminal_state' : 'corrupt_parent_state',
        };
      }
      return { status: 'invalid_contract' };
    }
    const finalized = finalizeWorkflowTerminalParentApplicationRecords(
      prepared.journal,
      prepared.receipt,
      prepared.plan,
      storageTimestamp,
    );
    if (finalized.status === 'applied' && finalized.plan.contract.patch.kind !== 'none') {
      this.setWorkflowRunRecord(effect.parentWorkflowName, effect.parentRunId, {
        ...parentRun,
        snapshot: patchedParent,
        updatedAt: new Date(storageTimestamp),
      });
      this.bumpParentRevision(parentKey);
    }
    const receiptStorageKey = JSON.stringify([effect.effectKey, WORKFLOW_TERMINAL_PARENT_APPLICATION_CONSUMER_ID]);
    this.db.workflowTerminalDestinationReceipts.set(
      receiptStorageKey,
      copyWorkflowTerminalDestinationReceiptRecord(finalized.receipt),
    );
    this.db.workflowTerminalContinuationPlans.set(
      finalized.receipt.receiptKey,
      copyWorkflowTerminalContinuationPlanRecord(finalized.plan),
    );
    this.db.workflowTerminalizations.set(journalKey, copyWorkflowTerminalizationRecord(finalized.journal));
    return { status: finalized.status, plan: copyWorkflowTerminalContinuationPlanRecord(finalized.plan) };
  }

  async claimWorkflowSnapshotHandoff(
    input: ClaimWorkflowSnapshotHandoffInput,
  ): Promise<ClaimWorkflowSnapshotHandoffResult> {
    // Capture every input field before invoking caller serialization
    // (toJSON/getters) so a mutated input object cannot redirect the write or
    // swap the expected state mid-call. `input.snapshot` is read only after
    // the expectation is fully materialized: its getter may run arbitrary
    // caller code that must not be able to rewrite the expected state.
    const { workflowName, runId, mutationFence, resourceId, expectedCanonical: rawExpectedCanonical } = input;
    validateWorkflowSnapshotHandoffFence(mutationFence);
    validateWorkflowSnapshotHandoffIdentity(workflowName, runId, resourceId);
    const expectedCanonical: WorkflowSnapshotHandoffCanonicalState =
      rawExpectedCanonical.kind === 'present'
        ? {
            kind: 'present' as const,
            resourceId: rawExpectedCanonical.resourceId,
            snapshot: materializeWorkflowSnapshotHandoffSnapshot(rawExpectedCanonical.snapshot),
          }
        : { kind: 'absent' };
    const materializedSnapshot = materializeWorkflowSnapshotHandoffSnapshot(input.snapshot);
    const key = this.getWorkflowKey(workflowName, runId);
    // Reading the canonical state materializes the stored snapshot, which can
    // invoke caller toJSON/getters and reenter these maps. Re-read both source
    // records after materialization and restart if a reentrant write changed
    // either one mid-read so the comparison and the claim stay consistent.
    let observedCanonical: WorkflowSnapshotHandoffCanonicalState;
    let existing: WorkflowSnapshotHandoffRecord | undefined;
    let canonicalMatches: boolean;
    for (let attempt = 1; ; attempt++) {
      const run = this.db.workflows.get(key);
      existing = this.db.workflowSnapshotHandoffs.get(key);
      observedCanonical = this.getWorkflowSnapshotHandoffCanonicalStateFrom(run);
      canonicalMatches = workflowSnapshotHandoffCanonicalStatesEqual(expectedCanonical, observedCanonical);
      if (this.db.workflows.get(key) === run && this.db.workflowSnapshotHandoffs.get(key) === existing) break;
      throwIfWorkflowReentrantAttemptsExhausted(attempt);
    }
    // From here to the map write no caller code may run: every comparison uses
    // already-materialized (plain JSON) values.
    if (!canonicalMatches) {
      return { status: 'conflict', observedCanonical };
    }
    if (existing) {
      const same =
        existing.mutationFence === mutationFence &&
        existing.resourceId === resourceId &&
        workflowSnapshotHandoffSnapshotsEqual(existing.snapshot, materializedSnapshot);
      if (existing.status === 'completed' && existing.mutationFence !== mutationFence) {
        return { status: 'conflict', record: this.copyWorkflowSnapshotHandoff(existing) };
      }
      return {
        status: existing.status === 'completed' ? 'completed' : same ? 'existing' : 'conflict',
        record: this.copyWorkflowSnapshotHandoff(existing),
      };
    }
    const now = Date.now();
    const record: WorkflowSnapshotHandoffRecord = {
      version: 1,
      workflowName,
      runId,
      status: 'pending',
      ...(resourceId === undefined ? {} : { resourceId }),
      snapshot: materializedSnapshot,
      mutationFence,
      createdAt: now,
      updatedAt: now,
    };
    this.db.workflowSnapshotHandoffs.set(key, record);
    return { status: 'created', record: this.copyWorkflowSnapshotHandoff(record) };
  }

  async transitionWorkflowSnapshotHandoff(
    input: TransitionWorkflowSnapshotHandoffInput,
  ): Promise<TransitionWorkflowSnapshotHandoffResult> {
    // `input.snapshot` is read only after the expectation is fully
    // materialized so its getter cannot rewrite the expected state mid-capture.
    const {
      workflowName,
      runId,
      mutationFence,
      resourceId,
      expectedResourceId,
      expectedSnapshot: rawExpectedSnapshot,
    } = input;
    validateWorkflowSnapshotHandoffFence(mutationFence);
    validateWorkflowSnapshotHandoffIdentity(workflowName, runId, resourceId, expectedResourceId);
    const expectedSnapshot = materializeWorkflowSnapshotHandoffSnapshot(rawExpectedSnapshot);
    const materializedSnapshot = materializeWorkflowSnapshotHandoffSnapshot(input.snapshot);
    const key = this.getWorkflowKey(workflowName, runId);
    const existing = this.db.workflowSnapshotHandoffs.get(key);
    if (!existing) return { status: 'missing' };
    if (existing.status === 'completed') {
      return existing.mutationFence === mutationFence
        ? { status: 'completed', record: this.copyWorkflowSnapshotHandoff(existing) }
        : { status: 'conflict', record: this.copyWorkflowSnapshotHandoff(existing) };
    }
    const expectedMatches =
      existing.mutationFence === mutationFence &&
      existing.resourceId === expectedResourceId &&
      workflowSnapshotHandoffSnapshotsEqual(existing.snapshot, expectedSnapshot);
    if (!expectedMatches) return { status: 'conflict', record: this.copyWorkflowSnapshotHandoff(existing) };
    const sameReplacement =
      existing.resourceId === resourceId &&
      workflowSnapshotHandoffSnapshotsEqual(existing.snapshot, materializedSnapshot);
    if (sameReplacement) return { status: 'existing', record: this.copyWorkflowSnapshotHandoff(existing) };
    const updated: WorkflowSnapshotHandoffRecord = {
      ...existing,
      ...(resourceId === undefined ? { resourceId: undefined } : { resourceId }),
      snapshot: materializedSnapshot,
      updatedAt: Date.now(),
    };
    this.db.workflowSnapshotHandoffs.set(key, updated);
    return { status: 'transitioned', record: this.copyWorkflowSnapshotHandoff(updated) };
  }

  async completeWorkflowSnapshotHandoff(
    input: CompleteWorkflowSnapshotHandoffInput,
  ): Promise<CompleteWorkflowSnapshotHandoffResult> {
    // `input.snapshot` is read only after the expectation is fully
    // materialized so its getter cannot rewrite the expected state mid-capture.
    const {
      workflowName,
      runId,
      mutationFence,
      resourceId,
      expectedResourceId,
      expectedSnapshot: rawExpectedSnapshot,
    } = input;
    validateWorkflowSnapshotHandoffFence(mutationFence);
    validateWorkflowSnapshotHandoffIdentity(workflowName, runId, resourceId, expectedResourceId);
    const expectedSnapshot = materializeWorkflowSnapshotHandoffSnapshot(rawExpectedSnapshot);
    const materializedSnapshot = materializeWorkflowSnapshotHandoffSnapshot(input.snapshot);
    const key = this.getWorkflowKey(workflowName, runId);
    const existing = this.db.workflowSnapshotHandoffs.get(key);
    if (!existing) return { status: 'missing' };
    if (existing.status === 'completed') {
      return existing.mutationFence === mutationFence
        ? { status: 'already_completed', record: this.copyWorkflowSnapshotHandoff(existing) }
        : { status: 'conflict', record: this.copyWorkflowSnapshotHandoff(existing) };
    }
    const expectedMatches =
      existing.mutationFence === mutationFence &&
      existing.resourceId === expectedResourceId &&
      workflowSnapshotHandoffSnapshotsEqual(existing.snapshot, expectedSnapshot);
    if (!expectedMatches) return { status: 'conflict', record: this.copyWorkflowSnapshotHandoff(existing) };
    const now = Date.now();
    const completed: WorkflowSnapshotHandoffRecord = {
      ...existing,
      status: 'completed',
      ...(resourceId === undefined ? { resourceId: undefined } : { resourceId }),
      snapshot: materializedSnapshot,
      updatedAt: now,
      completedAt: now,
    };
    this.db.workflowSnapshotHandoffs.set(key, completed);
    return { status: 'completed', record: this.copyWorkflowSnapshotHandoff(completed) };
  }

  async listWorkflowSnapshotHandoffs(
    input: ListWorkflowSnapshotHandoffsInput = {},
  ): Promise<ListWorkflowSnapshotHandoffsResult> {
    const limit = validateWorkflowSnapshotHandoffLimit(input.limit);
    const after = input.after;
    const records = [...this.db.workflowSnapshotHandoffs.values()]
      .filter(
        record =>
          (input.workflowName === undefined || record.workflowName === input.workflowName) &&
          (input.status === undefined || record.status === input.status),
      )
      .sort(compareWorkflowSnapshotHandoffCursors)
      .filter(record => !after || compareWorkflowSnapshotHandoffCursors(record, after) > 0);
    const page = records.slice(0, limit);
    const hasMore = records.length > limit;
    const last = page.at(-1);
    return {
      records: page.map(record => this.copyWorkflowSnapshotHandoff(record)),
      hasMore,
      ...(hasMore && last
        ? { nextCursor: { updatedAt: last.updatedAt, workflowName: last.workflowName, runId: last.runId } }
        : {}),
    };
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.workflows.clear();
    this.db.workflowTerminalizations.clear();
    this.db.workflowTerminalEffects.clear();
    this.db.workflowTerminalSnapshots.clear();
    this.db.workflowTerminalRecoveryAncestries.clear();
    this.db.workflowTerminalDestinationReceipts.clear();
    this.db.workflowTerminalContinuationPlans.clear();
    this.db.workflowTerminalParentRevisions.clear();
    this.db.workflowSnapshotHandoffs.clear();
  }

  private getWorkflowKey(workflowName: string, runId: string): string {
    // A delimiter-joined key aliases distinct identities such as
    // (`a-b`, `c`) and (`a`, `b-c`). Preserve the tuple boundary instead.
    return JSON.stringify([workflowName, runId]);
  }

  async bindWorkflowNestedRunOwnership(
    input: BindWorkflowNestedRunOwnershipInput,
  ): Promise<BindWorkflowNestedRunOwnershipResult> {
    const operation = {
      workflowName: input.workflowName,
      runId: input.runId,
      stepId: input.stepId,
      nestedRunId: input.nestedRunId,
      forEachIndex: input.forEachIndex,
      result: input.result,
      requestContext: input.requestContext,
    };
    validateWorkflowNestedRunOwnershipInput(operation);
    const key = this.getWorkflowKey(operation.workflowName, operation.runId);
    for (let attempt = 1; ; attempt++) {
      const run = this.db.workflows.get(key);
      this.assertWorkflowSnapshotHandoffAvailable(operation.workflowName, operation.runId);
      if (!run?.snapshot) return { status: 'missing_run' };
      // Cloning the stored snapshot can invoke caller toJSON/getters that
      // reenter these maps. Re-read the source row before writing and restart
      // if a reentrant write changed it mid-computation.
      const snapshot = cloneRunData(typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot);
      const ownership = bindWorkflowNestedRunOwnershipRecord(snapshot, operation);
      if (ownership.status === 'ownership_conflict') return ownership;
      if (ownership.status === 'already_bound') {
        return { status: 'already_bound', stepResults: cloneRunData(ownership.snapshot.context) };
      }
      const storedSnapshot = cloneRunData(ownership.snapshot);
      if (this.db.workflows.get(key) !== run) {
        throwIfWorkflowReentrantAttemptsExhausted(attempt);
        continue;
      }
      this.setWorkflowRunRecord(operation.workflowName, operation.runId, {
        ...run,
        snapshot: storedSnapshot,
        updatedAt: new Date(),
      });
      this.bumpParentRevision(key);
      return {
        status: 'bound',
        stepResults: cloneRunData(storedSnapshot.context),
      };
    }
  }

  async admitWorkflowNestedRun(input: AdmitWorkflowNestedRunInput): Promise<AdmitWorkflowNestedRunResult> {
    const capturedInput = captureWorkflowNestedRunAdmissionInput(input);
    const requestedInitialChildSnapshot = capturedInput.initialChildSnapshot;
    const expectedChildGraphFingerprint = capturedInput.expectedChildGraphFingerprint;
    const initialChildSnapshot = validateWorkflowNestedRunInitialSnapshot(
      requestedInitialChildSnapshot,
      capturedInput.nestedRunId,
      expectedChildGraphFingerprint,
    );
    const operation = {
      workflowName: capturedInput.workflowName,
      runId: capturedInput.runId,
      stepId: capturedInput.stepId,
      nestedWorkflowName: capturedInput.nestedWorkflowName,
      nestedRunId: capturedInput.nestedRunId,
      forEachIndex: capturedInput.forEachIndex,
      result: capturedInput.result,
      requestContext: capturedInput.requestContext,
      recoveryAncestry: capturedInput.recoveryAncestry,
    };
    validateWorkflowNestedRunOwnershipInput(operation);
    validateWorkflowTerminalizationIdentity(operation.nestedWorkflowName, 'nestedWorkflowName', 512);

    const parentKey = this.getWorkflowKey(operation.workflowName, operation.runId);
    const childKey = this.getWorkflowKey(operation.nestedWorkflowName, operation.nestedRunId);
    // Cloning stored snapshots and running the record helpers can invoke
    // caller toJSON/getters that reenter these maps. The loop re-reads the
    // source rows and restarts whenever a reentrant write changed either one
    // mid-computation so ownership binding never overwrites a newer record.
    for (let attempt = 1; ; attempt++) {
      this.assertWorkflowSnapshotHandoffAvailable(operation.workflowName, operation.runId);
      const run = this.db.workflows.get(parentKey);
      if (!run?.snapshot) return { status: 'missing_run' };
      const parentRevision = this.db.workflowTerminalParentRevisions.get(parentKey);
      if (parentRevision?.terminalStatus) return { status: 'parent_terminal' };
      const snapshot = cloneRunData(typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot);
      try {
        validateWorkflowRunSnapshotShape(snapshot, operation.runId, 'Nested workflow parent snapshot');
      } catch {
        return { status: 'parent_snapshot_conflict' };
      }
      if (isTerminalParentStatus(snapshot.status)) {
        this.latchParentTerminalStatus(parentKey, snapshot.status);
        return { status: 'parent_terminal' };
      }
      const recovery = createWorkflowTerminalRecoveryAncestryRecord(
        operation.nestedWorkflowName,
        operation.nestedRunId,
        operation.recoveryAncestry,
        Date.now(),
      );
      const immediate = recovery.ancestry[0];
      const expectedSource =
        immediate &&
        immediate.parentWorkflowName === operation.workflowName &&
        immediate.parentRunId === operation.runId &&
        immediate.source.stepId === operation.stepId &&
        (operation.forEachIndex === undefined
          ? immediate.source.kind === 'step'
          : immediate.source.kind === 'foreach-iteration' &&
            immediate.source.iterationIndex === operation.forEachIndex);
      if (!expectedSource) return { status: 'ancestry_conflict' };
      validateWorkflowTerminalRecoveryParentFrameGraphBinding(immediate, snapshot.serializedStepGraph);

      const parentRecovery = this.db.workflowTerminalRecoveryAncestries.get(parentKey);
      const expectedTailHash = createWorkflowTerminalRecoveryAncestryRecord(
        operation.workflowName,
        operation.runId,
        recovery.ancestry.slice(1),
        recovery.createdAt,
      ).ancestryHash;
      const retainedTailHash = createWorkflowTerminalRecoveryAncestryRecord(
        operation.workflowName,
        operation.runId,
        parentRecovery?.ancestry ?? [],
        recovery.createdAt,
      ).ancestryHash;
      if (expectedTailHash !== retainedTailHash) return { status: 'ancestry_conflict' };

      this.assertWorkflowSnapshotHandoffAvailable(operation.nestedWorkflowName, operation.nestedRunId);
      const childRevision = this.db.workflowTerminalParentRevisions.get(childKey);
      if (childRevision?.terminalStatus) return { status: 'child_terminal' };
      const existingChild = this.db.workflows.get(childKey);
      let existingChildSnapshot: WorkflowRunState | undefined;
      if (existingChild?.snapshot) {
        try {
          existingChildSnapshot = cloneRunData(
            typeof existingChild.snapshot === 'string' ? JSON.parse(existingChild.snapshot) : existingChild.snapshot,
          );
        } catch {
          return { status: 'child_snapshot_conflict' };
        }
        const inspection = inspectWorkflowNestedRunRetainedSnapshot(
          existingChildSnapshot,
          operation.nestedRunId,
          expectedChildGraphFingerprint,
        );
        if (inspection.status === 'conflict') return { status: 'child_snapshot_conflict' };
        if (inspection.status === 'terminal') {
          this.latchParentTerminalStatus(childKey, inspection.terminalStatus);
          return { status: 'child_terminal' };
        }
      }
      const ensureInitialChildSnapshot = (): 'initialized' | 'retained' | 'not_requested' | 'stale' => {
        if (!initialChildSnapshot) return 'not_requested';
        if (existingChildSnapshot) return 'retained';
        const timestamp = new Date(recovery.createdAt);
        const storedChildSnapshot = cloneRunData(initialChildSnapshot.snapshot);
        if (this.db.workflows.get(childKey) !== existingChild) return 'stale';
        this.setWorkflowRunRecord(operation.nestedWorkflowName, operation.nestedRunId, {
          workflow_name: operation.nestedWorkflowName,
          run_id: operation.nestedRunId,
          resourceId: initialChildSnapshot.resourceId ?? existingChild?.resourceId,
          snapshot: storedChildSnapshot,
          createdAt: existingChild?.createdAt ?? timestamp,
          updatedAt: timestamp,
        });
        this.bumpParentRevision(childKey);
        return 'initialized';
      };
      const existingRecovery = this.db.workflowTerminalRecoveryAncestries.get(childKey);
      if (existingRecovery) {
        validateWorkflowTerminalRecoveryAncestryRecord(existingRecovery, {
          workflowName: operation.nestedWorkflowName,
          runId: operation.nestedRunId,
          now: Date.now(),
        });
        if (!sameWorkflowTerminalRecoveryAncestry(existingRecovery, recovery)) {
          return { status: 'ancestry_conflict' };
        }
      }
      const ownership = bindWorkflowNestedRunOwnershipRecord(snapshot, operation);
      if (ownership.status === 'ownership_conflict') return ownership;
      if (ownership.status === 'bound' && existingRecovery) {
        return { status: 'ancestry_conflict' };
      }
      if (ownership.status === 'already_bound' && existingRecovery) {
        // The record helpers and clones above ran caller code; re-read both
        // source rows before initializing the child so a reentrant write
        // cannot make this branch act on stale ownership.
        if (this.db.workflows.get(parentKey) !== run || this.db.workflows.get(childKey) !== existingChild) {
          throwIfWorkflowReentrantAttemptsExhausted(attempt);
          continue;
        }
        // Row identity alone cannot see a handoff claim — it lives in a
        // separate map. Re-assert both fences adjacent to initializing the
        // child so a claim landed mid-admission cannot slip through a retry.
        this.assertWorkflowSnapshotHandoffAvailable(operation.workflowName, operation.runId);
        this.assertWorkflowSnapshotHandoffAvailable(operation.nestedWorkflowName, operation.nestedRunId);
        const childSnapshotState = ensureInitialChildSnapshot();
        if (childSnapshotState === 'stale') {
          throwIfWorkflowReentrantAttemptsExhausted(attempt);
          continue;
        }
        return {
          status: 'already_admitted',
          stepResults: cloneRunData(ownership.snapshot.context),
          recovery: copyWorkflowTerminalRecoveryAncestryRecord(existingRecovery),
          childSnapshotState,
        };
      }
      // A transient nested run can become durable only when it suspends. Its
      // parent owner was bound at initial dispatch, while the child snapshot and
      // recovery ancestry did not exist yet. Promote that matching owner once a
      // retained (or atomically initialized) child snapshot proves the run; do
      // not treat the expected transient -> durable transition as an ancestry
      // conflict.
      if (ownership.status === 'already_bound' && !existingChildSnapshot && !initialChildSnapshot) {
        return { status: 'ancestry_conflict' };
      }
      const storedSnapshot = cloneRunData(ownership.snapshot);
      const storedRecovery = copyWorkflowTerminalRecoveryAncestryRecord(recovery);
      if (this.db.workflows.get(parentKey) !== run || this.db.workflows.get(childKey) !== existingChild) {
        throwIfWorkflowReentrantAttemptsExhausted(attempt);
        continue;
      }
      // Fence both runs adjacent to the first mutation: a reentrant handoff
      // claimed while cloning must not leave child ancestry committed without
      // the parent write that justifies it.
      this.assertWorkflowSnapshotHandoffAvailable(operation.workflowName, operation.runId);
      this.assertWorkflowSnapshotHandoffAvailable(operation.nestedWorkflowName, operation.nestedRunId);
      this.db.workflowTerminalRecoveryAncestries.set(childKey, storedRecovery);
      if (ownership.status === 'bound') {
        this.setWorkflowRunRecord(operation.workflowName, operation.runId, {
          ...run,
          snapshot: storedSnapshot,
          updatedAt: new Date(),
        });
        this.bumpParentRevision(parentKey);
      }
      const childSnapshotState = ensureInitialChildSnapshot();
      if (childSnapshotState === 'stale') {
        throwIfWorkflowReentrantAttemptsExhausted(attempt);
        continue;
      }
      return {
        status: 'admitted',
        stepResults: cloneRunData(storedSnapshot.context),
        recovery: copyWorkflowTerminalRecoveryAncestryRecord(storedRecovery),
        childSnapshotState,
      };
    }
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const key = this.getWorkflowKey(workflowName, runId);
    for (let attempt = 1; ; attempt++) {
      const run = this.db.workflows.get(key);
      this.assertWorkflowSnapshotHandoffAvailable(workflowName, runId);

      if (!run) {
        return {};
      }

      if (!run.snapshot) {
        const snapshot = createEmptyWorkflowSnapshot(run.run_id);
        this.setWorkflowRunRecord(workflowName, runId, {
          ...run,
          snapshot,
        });
        throwIfWorkflowReentrantAttemptsExhausted(attempt);
        continue;
      }

      // Merge into a clone, never the live stored object: merging can invoke
      // caller getters and a fence assert at write time must not leave the
      // stored snapshot partially mutated.
      const working = cloneRunData(
        typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot,
      ) as WorkflowRunState;

      if (!working || !working?.context) {
        throw new Error(`Snapshot not found for runId ${runId}`);
      }

      mergeWorkflowStepResult({ snapshot: working, stepId, result, requestContext });
      // Clone before the final source check so no caller code runs between
      // the check and the map write; restart if a reentrant write changed the
      // source row so the CAS merge never overwrites a newer record.
      const storedSnapshot = cloneRunData(working);
      if (this.db.workflows.get(key) !== run) {
        throwIfWorkflowReentrantAttemptsExhausted(attempt);
        continue;
      }

      this.setWorkflowRunRecord(workflowName, runId, {
        ...run,
        snapshot: storedSnapshot,
      });
      this.bumpParentRevision(key);

      return cloneRunData(storedSnapshot.context);
    }
  }

  async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    const key = this.getWorkflowKey(workflowName, runId);
    // Pin the CAS fields and state options once: getters on `opts` would
    // otherwise re-run per retry and could hand each attempt different
    // expectations.
    const { expectedStatus, expectedExecutionGeneration, expectedLifecycleResumeAttempt, finalState, ...stateOptions } =
      opts;
    for (let attempt = 1; ; attempt++) {
      const run = this.db.workflows.get(key);
      this.assertWorkflowSnapshotHandoffAvailable(workflowName, runId);

      if (!run) {
        return;
      }

      if (!run.snapshot) {
        const snapshot = createEmptyWorkflowSnapshot(run.run_id);
        this.setWorkflowRunRecord(workflowName, runId, {
          ...run,
          snapshot,
        });
        throwIfWorkflowReentrantAttemptsExhausted(attempt);
        continue;
      }

      // Work on a clone: a fence assert at write time must not leave a
      // partially merged live object behind.
      const working = cloneRunData(
        typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot,
      ) as WorkflowRunState;

      if (!working || !working?.context) {
        throw new Error(`Snapshot not found for runId ${runId}`);
      }
      // Compare-and-set guards run before any mutation: a mismatch makes
      // the whole update a no-op, including the terminal `finalState` replacement.
      if (
        !matchesExpectedWorkflowState(working, {
          expectedStatus,
          expectedExecutionGeneration,
          expectedLifecycleResumeAttempt,
        })
      ) {
        return;
      }

      const existingTimestamp = working.timestamp;
      let nextSnapshot: WorkflowRunState = { ...working, ...stateOptions };
      if (finalState !== undefined) {
        const storageTimestamp = Date.now();
        const finalTimestamp = validateWorkflowSnapshotTimestampForFinalState(existingTimestamp, storageTimestamp);
        const canonicalFinalState = materializeWorkflowTerminalCanonicalJsonObject(finalState, 'finalState');
        nextSnapshot.context = {
          ...nextSnapshot.context,
          __state: cloneRunData(canonicalFinalState) as never,
        } as unknown as WorkflowRunState['context'];
        nextSnapshot.value = cloneRunData(canonicalFinalState) as WorkflowRunState['value'];
        nextSnapshot.timestamp = finalTimestamp;
      }
      const storedSnapshot = cloneRunData(nextSnapshot);
      // Caller code above may reenter this map; restart if the source row
      // changed so the CAS merge never overwrites a newer record.
      if (this.db.workflows.get(key) !== run) {
        throwIfWorkflowReentrantAttemptsExhausted(attempt);
        continue;
      }
      this.setWorkflowRunRecord(workflowName, runId, {
        ...run,
        snapshot: storedSnapshot,
      });
      this.bumpParentRevision(key);

      return cloneRunData(storedSnapshot);
    }
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const key = this.getWorkflowKey(workflowName, runId);
    const now = new Date();
    for (let attempt = 1; ; attempt++) {
      const existing = this.db.workflows.get(key);
      this.assertWorkflowSnapshotHandoffAvailable(workflowName, runId);
      // Cloning the caller snapshot can invoke toJSON/getters that reenter
      // this map; restart if a reentrant write changed the row so a persisted
      // snapshot never silently overwrites a newer record.
      const clonedSnapshot = cloneRunData(snapshot);
      if (this.db.workflows.get(key) !== existing) {
        throwIfWorkflowReentrantAttemptsExhausted(attempt);
        continue;
      }
      const data: StorageWorkflowRun = {
        workflow_name: workflowName,
        run_id: runId,
        // A re-persist without a resourceId (e.g. resume) must not erase a
        // previously-set value. Matches the persistent stores' COALESCE upserts.
        resourceId: resourceId ?? existing?.resourceId,
        snapshot: clonedSnapshot,
        // Preserve the original creation time when re-persisting an existing run; only set it
        // on first insert. Otherwise listWorkflowRuns ordering and date filters drift to the
        // last activity time. Matches the persistent stores (pg/mysql/mongodb/libsql).
        createdAt: createdAt ?? existing?.createdAt ?? now,
        updatedAt: updatedAt ?? now,
      };

      this.setWorkflowRunRecord(workflowName, runId, data);
      this.bumpParentRevision(key);
      return;
    }
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const key = this.getWorkflowKey(workflowName, runId);
    const run = this.db.workflows.get(key);

    if (!run) {
      return null;
    }

    const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
    // Return a deep copy to prevent mutation
    return snapshot ? cloneRunData(snapshot) : null;
  }

  async getWorkflowExecutionState({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowExecutionState | null> {
    const stored = this.db.workflows.get(this.getWorkflowKey(workflowName, runId));
    if (!stored) return null;

    // In-memory workflow rows already hold the snapshot object. Read only the
    // two authority fields so lifecycle checks do not clone the full state.
    const snapshot = typeof stored.snapshot === 'string' ? JSON.parse(stored.snapshot) : stored.snapshot;
    if (!snapshot) return null;
    return {
      status: snapshot.status,
      ...(snapshot.executionGeneration === undefined ? {} : { executionGeneration: snapshot.executionGeneration }),
    };
  }

  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    if (page !== undefined && page < 0) {
      throw new Error('page must be >= 0');
    }

    let runs = Array.from(this.db.workflows.values());

    if (workflowName) runs = runs.filter((run: any) => run.workflow_name === workflowName);
    if (status) {
      runs = runs.filter((run: any) => {
        let snapshot: WorkflowRunState | string = run?.snapshot!;

        if (!snapshot) {
          return false;
        }

        if (typeof snapshot === 'string') {
          try {
            snapshot = JSON.parse(snapshot) as WorkflowRunState;
          } catch {
            return false;
          }
        } else {
          snapshot = cloneRunData(snapshot) as WorkflowRunState;
        }

        return snapshot.status === status;
      });
    }

    if (fromDate && toDate) {
      runs = runs.filter(
        (run: any) =>
          new Date(run.createdAt).getTime() >= fromDate.getTime() &&
          new Date(run.createdAt).getTime() <= toDate.getTime(),
      );
    } else if (fromDate) {
      runs = runs.filter((run: any) => new Date(run.createdAt).getTime() >= fromDate.getTime());
    } else if (toDate) {
      runs = runs.filter((run: any) => new Date(run.createdAt).getTime() <= toDate.getTime());
    }
    if (resourceId) runs = runs.filter((run: any) => run.resourceId === resourceId);

    const total = runs.length;

    // Sort by createdAt
    runs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    if (perPage !== undefined && page !== undefined) {
      // Use MAX_SAFE_INTEGER as default to maintain "no pagination" behavior when undefined
      const normalizedPerPage = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
      const offset = page * normalizedPerPage;
      const start = offset;
      const end = start + normalizedPerPage;
      runs = runs.slice(start, end);
    }

    // Deserialize snapshot if it's a string
    const parsedRuns = runs.map((run: any) => ({
      ...run,
      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : cloneRunData(run.snapshot),
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      runId: run.run_id,
      workflowName: run.workflow_name,
      resourceId: run.resourceId,
    }));

    return { runs: parsedRuns as WorkflowRun[], total };
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    let run: any;
    let newestCreatedAt = Number.NEGATIVE_INFINITY;
    for (const candidate of this.db.workflows.values()) {
      if (candidate.run_id !== runId || (workflowName && candidate.workflow_name !== workflowName)) continue;

      const createdAt = new Date(candidate.createdAt).getTime();
      const sortableCreatedAt = Number.isFinite(createdAt) ? createdAt : Number.NEGATIVE_INFINITY;
      if (!run || sortableCreatedAt >= newestCreatedAt) {
        run = candidate;
        newestCreatedAt = sortableCreatedAt;
      }
    }

    if (!run) return null;

    // Return a deep copy to prevent mutation
    const parsedRun = {
      ...run,
      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : cloneRunData(run.snapshot),
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      runId: run.run_id,
      workflowName: run.workflow_name,
      resourceId: run.resourceId,
    };

    return parsedRun as WorkflowRun;
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    const key = this.getWorkflowKey(workflowName, runId);
    if (this.deleteWorkflowRunRecord(workflowName, runId)) {
      // Keep the tombstone revision so deleting and recreating the same logical
      // run cannot make an older parent context current again (ABA).
      this.bumpParentRevision(key);
    }
  }
}
