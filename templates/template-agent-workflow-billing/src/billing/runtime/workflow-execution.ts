import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AnyWorkflow } from '@mastra/core/workflows';
import { BillingError, identifierSchema, parseInput } from '../contracts/core.js';
import { boundedJson } from './accounting.js';
import type { AdmissionIdentity, ExecutorOutcome, Json } from './accounting.js';
import type { BillingGateway } from './gateway.js';
import type { OrganizationService, BillingContext } from '../organizations.js';
import type { AccountingStorage } from '../storage/accounting.js';
import type { WorkflowStorage, WorkflowRecord, ExpiryClaim } from '../storage/workflows.js';
import type {
  WorkflowResource,
  WorkflowInput,
  WorkflowOutput,
  WorkflowProjection,
  WorkflowResume,
  NativeWorkflowResult,
} from '../mastra-resources.js';
import type { AgentRegistry, WorkflowRegistry, NativeWorkflow, WorkflowResponse } from '../contracts/execution.js';
import { MeasurementCollector } from './measurement.js';
import type { InvocationContext } from './invocation-context.js';

type NativeRunResult = NativeWorkflowResult<AnyWorkflow> | { status: 'canceled' };
type NativeInvocation = {
  version: number;
  cancel: () => Promise<void>;
  finished: Promise<NativeRunResult>;
  result?: NativeRunResult;
};
type NativeTerminalResult = Extract<NativeRunResult, { status: 'success' | 'failed' | 'tripwire' }>;
type StopEvidence = { kind: 'terminal'; result: NativeTerminalResult } | { kind: 'canceled' } | { kind: 'uncertain' };

const isNativeTerminal = (status?: string) =>
  status === 'success' || status === 'failed' || status === 'tripwire' || status === 'canceled';

export class WorkflowExecution<Agents extends AgentRegistry, Workflows extends WorkflowRegistry> {
  private readonly runtime = randomUUID();
  private readonly immediateWorkflows = new Map<
    string,
    {
      version: number;
      status: WorkflowRecord['status'];
      result: NativeRunResult;
    }
  >();
  private readonly running = new Map<string, NativeInvocation>();
  private readonly preparing = new Map<string, { version: number; abort: () => void }>();
  constructor(
    private readonly options: {
      organizations: OrganizationService;
      accounting: AccountingStorage;
      workflowStorage: WorkflowStorage;
      agents: Agents;
      workflows: Workflows;
      gateway: BillingGateway;
    },
    private readonly context: InvocationContext,
  ) {}
  async readRequest(id: string, billing: BillingContext, key: string) {
    const record = await this.options.workflowStorage.readRequest(
      await this.options.organizations.accountingIdentity(billing),
      id,
      parseInput(identifierSchema, key),
    );
    return record ? this.read(id, record.id, billing) : null;
  }
  workflow<K extends keyof Workflows & string>(id: K) {
    const resource = this.options.workflows[id];
    if (!resource) throw new BillingError('unsupported');
    type W = NativeWorkflow<Workflows[K]>;
    const handle = (executionId: string) =>
      Object.freeze({
        executionId,
        start: (request: {
          inputData: WorkflowInput<W>;
          billing: BillingContext;
          idempotencyKey: string;
        }): Promise<WorkflowResponse<W>> => this.start(id, executionId, request),
        resume: (
          request: WorkflowResume<W> & {
            step: string;
            resumeData: unknown;
            billing: BillingContext;
            idempotencyKey: string;
          },
        ): Promise<WorkflowResponse<W>> => this.resume(id, executionId, request),
        cancel: (request: { billing: BillingContext; idempotencyKey: string }): Promise<WorkflowResponse<W>> =>
          this.cancel(id, executionId, request),
        status: (billing: BillingContext): Promise<WorkflowResponse<W>> => this.read(id, executionId, billing),
      });
    return Object.freeze({
      createRun: async (request: { billing: BillingContext; idempotencyKey: string }) => {
        parseInput(z.strictObject({ idempotencyKey: identifierSchema }), { idempotencyKey: request.idempotencyKey });
        if (this.context.parent.getStore()) throw new BillingError('unsupported');
        const identity = await this.options.organizations.accountingIdentity(request.billing);
        const record = await this.options.workflowStorage.create(
          identity,
          this.options.gateway.resource(id),
          this.adapterVersion(id),
          request.idempotencyKey,
        );
        return handle(record.id);
      },
      getRun: async (request: { executionId: string; billing: BillingContext }) => {
        const record = await this.owned(id, request.executionId, request.billing);
        return handle(record.id);
      },
    });
  }
  private async owned(id: string, executionId: string, billing: BillingContext) {
    const identity = await this.options.organizations.accountingIdentity(billing);
    const record = await this.options.workflowStorage.read(identity, executionId);
    if (record.resourceId !== id) throw new BillingError('forbidden');
    return record;
  }
  private async state(id: string, executionId: string, billing: BillingContext) {
    const identity = await this.options.organizations.accountingIdentity(billing);
    const state = await this.options.workflowStorage.readState(identity, executionId);
    if (state.record.resourceId !== id) throw new BillingError('forbidden');
    return state;
  }
  private async project<W extends AnyWorkflow>(
    id: string,
    record: WorkflowRecord,
  ): Promise<WorkflowProjection<WorkflowOutput<W>>> {
    const resource = this.options.workflows[id] as WorkflowResource<W>;
    let result: Record<string, Json> = {};
    const definition = record.adapterVersion;
    if (record.result !== null) {
      this.compatible(id, record);
      const stored = parseInput(
        z.strictObject({
          definition: z.literal(definition),
          output: z.unknown().optional(),
          suspendedSteps: z.array(identifierSchema).max(100).optional(),
          pending: z.unknown().optional(),
        }),
        record.result,
      );
      const { definition: _definition, ...projection } = stored;
      result = boundedJson(projection) as Record<string, Json>;
    }
    return resource.parseProjection(
      {
        definition,
        projection: { executionId: record.id, status: record.status, expiresAt: record.expiresAt, ...result },
      },
      definition,
    );
  }
  async read<W extends AnyWorkflow>(
    id: string,
    executionId: string,
    billing: BillingContext,
  ): Promise<WorkflowResponse<W>> {
    const state = await this.state(id, executionId, billing);
    return { kind: 'replay', result: await this.project(id, state.record), billing: state.billing };
  }
  private adapterVersion(id: string) {
    return this.options.workflows[id].definition(this.options.agents);
  }
  private compatible(id: string, record: WorkflowRecord) {
    if (!this.options.workflows[id].compatible(record.adapterVersion, this.options.agents))
      throw new BillingError('state_unavailable');
  }
  async start<W extends AnyWorkflow>(
    id: string,
    executionId: string,
    request: { inputData: WorkflowInput<W>; billing: BillingContext; idempotencyKey: string },
  ): Promise<WorkflowResponse<W>> {
    if (this.context.parent.getStore()) throw new BillingError('unsupported');
    const record = await this.owned(id, executionId, request.billing);
    this.compatible(id, record);
    const input = await this.options.workflows[id].input(request.inputData);
    const identity = await this.options.organizations.accountingIdentity(request.billing);
    const claim = await this.options.workflowStorage.claim(
      identity,
      executionId,
      'start',
      request.idempotencyKey,
      boundedJson(input),
      this.runtime,
    );
    if (!claim.claimed) return this.read(id, executionId, request.billing);
    try {
      try {
        await this.context.identity.run(identity, () =>
          this.options.gateway.execute(
            request.billing,
            {
              resourceId: id,
              operation: 'start',
              idempotencyKey: executionId,
              input: { executionId, inputData: input, version: claim.record.version },
            },
            { executionId, version: claim.record.version, configuration: record.configuration },
          ),
        );
      } catch (error) {
        // Only a missing accounting execution proves admission never happened.
        const admitted = await this.options.accounting.hasExecution(executionId);
        await this.options.workflowStorage.transition(
          executionId,
          claim.record.version,
          admitted ? 'uncertain' : 'failed',
        );
        throw error;
      }
      return await this.workflowResponse(id, executionId, claim.record.version, request.billing);
    } finally {
      this.clearImmediate(executionId, claim.record.version);
    }
  }
  async execute(id: string, input: Json, executionId: string): Promise<ExecutorOutcome> {
    const request = parseInput(
      z.strictObject({ executionId: identifierSchema, inputData: z.unknown(), version: z.number().int().positive() }),
      input,
    );
    const record = await this.options.workflowStorage.current(executionId);
    if (record.status !== 'running' || record.version !== request.version || record.owner !== this.runtime)
      return { status: 'uncertain', measurements: [], measurementComplete: false };
    const identity = this.context.identity.getStore();
    if (!identity) return { status: 'uncertain', measurements: [], measurementComplete: false };
    return this.runSegment(id, record, identity, { inputData: request.inputData });
  }
  private async runSegment(
    id: string,
    record: WorkflowRecord,
    identity: AdmissionIdentity,
    operation: { inputData: unknown } | { step: string; resumeData: unknown },
  ): Promise<ExecutorOutcome> {
    const resource = this.options.workflows[id];
    if (resource.measurement === 'facade-calls' && resource.expectedCalls[record.version - 1] === undefined)
      return { status: 'uncertain', measurements: [], measurementComplete: false };
    let dispatched = false;
    let signal: AbortSignal | undefined;
    let abort: (() => void) | undefined;
    try {
      const run = await resource.native.createRun({ runId: record.id });
      const previous = await this.options.accounting.read(identity, record.id);
      const collector = new MeasurementCollector(
        record.id,
        record.version,
        identity,
        record.configuration,
        this.options.accounting,
        this.options.workflowStorage,
        true,
        () => {
          run.abortController.abort();
          return run.cancel();
        },
        previous.billing.observedUnits ?? 0,
        resource.agentDependencies,
        resource.artifactSlots,
      );
      const nativeSignal: AbortSignal = run.abortController.signal;
      signal = nativeSignal;
      abort = () => collector.controller.abort();
      nativeSignal.addEventListener('abort', abort, { once: true });
      const deadline = await this.options.accounting.segmentDeadline(identity, record.id, record.version, 'dispatch');
      if (deadline !== null) {
        if (Date.now() >= deadline) return { status: 'failed', measurements: [], measurementComplete: false };
        this.preparing.set(record.id, { version: record.version, abort: () => run.abortController.abort() });
        await this.options.workflowStorage.beginNativeHandoff(identity, record, this.runtime);
        const current = await this.options.workflowStorage.current(record.id);
        if (current.version !== record.version || current.owner !== this.runtime) throw new BillingError('conflict');
        if (current.status === 'canceling' || nativeSignal.aborted) {
          if ('inputData' in operation) return { status: 'canceled', measurements: [], measurementComplete: false };
          // This owner has not invoked the resumed segment. Hand cancellation
          // to the same durable protocol used for suspended-run expiry.
          const cancellation = await this.options.workflowStorage.prepareOwnerCancellation(record, this.runtime);
          if (cancellation) await this.expireClaim(cancellation);
          return { status: 'uncertain', measurements: [], measurementComplete: false };
        }
        if (current.status !== 'running') throw new BillingError('conflict');
      }
      const execution = await collector.runWithinDeadline(deadline, async () => {
        dispatched = true;
        const pending: Promise<NativeRunResult> = this.context.parent.run(collector, () =>
          'inputData' in operation ? run.start({ inputData: operation.inputData }) : run.resume(operation),
        );
        // Publish the actual invocation before marking it active in SQL. A
        // cancellation that is deferred by the handoff is handled by this owner.
        const invocation: NativeInvocation = { version: record.version, cancel: () => run.cancel(), finished: pending };
        this.running.set(record.id, invocation);
        void pending.then(
          result => {
            invocation.result = result;
          },
          () => {},
        );
        if (deadline !== null) {
          let cancel;
          try {
            cancel = await this.options.workflowStorage.completeNativeHandoff(record, this.runtime);
          } catch (error) {
            run.abortController.abort();
            void run.cancel().catch(() => {});
            throw error;
          }
          if (cancel) {
            if (invocation.result?.status === 'suspended') {
              const cancellation = await this.options.workflowStorage.prepareOwnerCancellation(record, this.runtime);
              if (cancellation) await this.expireClaim(cancellation);
              return { cancellation: false } as const;
            }
            const stopped = await this.stopNative(id, record.id, invocation, false);
            // A deferred request keeps this version in charge of completion.
            // Apply the usual measurement, version and cutoff checks to an
            // actual terminal result; a superseding cancel cannot do this.
            if (stopped.kind === 'terminal') return { native: stopped.result } as const;
            return { cancellation: stopped.kind === 'canceled' } as const;
          }
        }
        return { native: await pending } as const;
      });
      if (execution.status !== 'finished')
        return {
          status: execution.status === 'expired_before_dispatch' ? 'failed' : 'timed_out',
          measurements: [],
          measurementComplete: false,
        };
      if ('cancellation' in execution.value)
        return {
          status: execution.value.cancellation ? 'canceled' : 'uncertain',
          measurements: [],
          measurementComplete: false,
        };
      const result = execution.value.native;
      const expectedCalls =
        resource.measurement === 'facade-calls' && collector.callCount === resource.expectedCalls[record.version - 1];
      if ((result.status === 'success' || result.status === 'suspended') && !expectedCalls) await collector.missing();
      const projection =
        result.status === 'success'
          ? {
              output: await resource.complete(
                {
                  collector,
                  slot: 0,
                  prompt: '',
                  signal: collector.controller.signal,
                  checkpoint: async () => {
                    collector.controller.signal.throwIfAborted();
                    const cutoff = await this.options.accounting.segmentDeadline(identity, record.id, record.version);
                    if (cutoff !== null && Date.now() >= cutoff) throw new BillingError('state_unavailable');
                  },
                },
                result.result,
              ),
            }
          : result.status === 'suspended'
            ? {
                suspendedSteps: [...new Set(result.suspended.flat())],
                pending: Object.fromEntries(
                  Object.entries(result.steps)
                    .filter(([, step]) => step.status === 'suspended')
                    .map(([id, step]) => [id, step.suspendPayload]),
                ),
              }
            : {};
      const nativeStatus =
        result.status === 'success'
          ? 'completed'
          : result.status === 'suspended'
            ? 'suspended'
            : result.status === 'canceled'
              ? 'canceled'
              : result.status === 'failed' || result.status === 'tripwire'
                ? 'failed'
                : 'uncertain';
      const status =
        nativeStatus === 'failed' || nativeStatus === 'canceled'
          ? nativeStatus
          : collector.captureFailed || nativeStatus === 'uncertain'
            ? 'uncertain'
            : collector.overflow
              ? 'failed'
              : nativeStatus === 'completed'
                ? 'succeeded'
                : nativeStatus;
      this.immediateWorkflows.set(record.id, { version: record.version, status: nativeStatus, result });
      return {
        status,
        result: boundedJson({ definition: record.adapterVersion, ...projection }),
        measurements: [],
        measurementComplete: expectedCalls && collector.complete,
      };
    } catch (error) {
      return {
        status:
          !dispatched || (error instanceof BillingError && error.code === 'invalid_input') ? 'failed' : 'uncertain',
        measurements: [],
        measurementComplete: false,
      };
    } finally {
      if (signal && abort) signal.removeEventListener('abort', abort);
      this.running.delete(record.id);
      this.preparing.delete(record.id);
    }
  }
  private clearImmediate(executionId: string, version: number) {
    if (this.immediateWorkflows.get(executionId)?.version === version) this.immediateWorkflows.delete(executionId);
  }
  private async workflowResponse<W extends AnyWorkflow>(
    id: string,
    executionId: string,
    version: number,
    billing: BillingContext,
  ): Promise<WorkflowResponse<W>> {
    const { record, billing: receipt } = await this.state(id, executionId, billing);
    const full = this.immediateWorkflows.get(executionId);
    if (full?.version === version) this.immediateWorkflows.delete(executionId);
    const projection = await this.project<W>(id, record);
    if (
      full?.version === version &&
      full.status !== 'uncertain' &&
      record.version === version &&
      record.status === full.status &&
      record.result !== null &&
      receipt
    )
      return { kind: 'immediate', result: full.result as NativeWorkflowResult<W>, projection, billing: receipt };
    return { kind: 'replay', result: projection, billing: receipt };
  }
  async resume<W extends AnyWorkflow>(
    id: string,
    executionId: string,
    request: { step: string; resumeData: unknown; billing: BillingContext; idempotencyKey: string },
  ): Promise<WorkflowResponse<W>> {
    if (this.context.parent.getStore()) throw new BillingError('unsupported');
    const record = await this.owned(id, executionId, request.billing);
    this.compatible(id, record);
    const input = parseInput(
      z.strictObject({ step: identifierSchema, resumeData: z.unknown().transform(value => boundedJson(value)) }),
      { step: request.step, resumeData: request.resumeData },
    );
    await this.options.workflows[id].resumeInput(input.step, input.resumeData);
    const identity = await this.options.gateway.revalidate(request.billing, record.configuration, executionId);
    const claim = await this.options.workflowStorage.claim(
      identity,
      executionId,
      'resume',
      request.idempotencyKey,
      boundedJson(input),
      this.runtime,
    );
    if (!claim.claimed) return this.read(id, executionId, request.billing);
    try {
      const outcome = await this.runSegment(id, claim.record, identity, input);
      await this.options.accounting.finish(
        executionId,
        outcome,
        outcome.result === undefined ? null : boundedJson(outcome.result),
        { executionId, version: claim.record.version },
      );
      return await this.workflowResponse(id, executionId, claim.record.version, request.billing);
    } finally {
      this.clearImmediate(executionId, claim.record.version);
    }
  }
  async cancel<W extends AnyWorkflow>(
    id: string,
    executionId: string,
    request: { billing: BillingContext; idempotencyKey: string },
  ): Promise<WorkflowResponse<W>> {
    await this.owned(id, executionId, request.billing);
    const identity = await this.options.organizations.accountingIdentity(request.billing);
    const claim = await this.options.workflowStorage.claim(
      identity,
      executionId,
      'cancel',
      request.idempotencyKey,
      null,
      this.runtime,
    );
    if (!claim.claimed) {
      if (['canceling', 'uncertain'].includes(claim.record.status)) {
        const cancellation = await this.options.workflowStorage.claimExpiry(executionId, Date.now(), 60000, true);
        if (cancellation) await this.expireClaim(cancellation);
      }
      await this.options.accounting.settleReservation(executionId);
      return this.read(id, executionId, request.billing);
    }
    if (claim.cancelDeferred) {
      const pending = this.preparing.get(executionId);
      if (pending?.version === claim.record.version) pending.abort();
      return this.read(id, executionId, request.billing);
    }
    if (claim.record.status === 'canceled') {
      await this.options.accounting.settleReservation(executionId);
      return this.read(id, executionId, request.billing);
    }
    if (claim.cancellation) {
      await this.expireClaim(claim.cancellation);
      return this.read(id, executionId, request.billing);
    }
    const active = this.running.get(executionId);
    const stopped = await this.stopNative(
      id,
      executionId,
      claim.previous.owner === this.runtime && active?.version === claim.previous.version ? active : undefined,
      claim.expectsSuspension,
    );
    // The cancel won the new version. The previous owner's corroborated
    // terminal result can prove termination, but cannot authorize a charge.
    const status =
      stopped.kind === 'uncertain'
        ? 'uncertain'
        : stopped.kind === 'terminal' && stopped.result.status !== 'success'
          ? 'failed'
          : 'canceled';
    await this.options.accounting.finish(executionId, { status, measurements: [], measurementComplete: false }, null, {
      executionId,
      version: claim.record.version,
    });
    return this.read(id, executionId, request.billing);
  }
  private async stopNative(
    id: string,
    executionId: string,
    invocation: NativeInvocation | undefined,
    expectsSuspension: boolean,
  ): Promise<StopEvidence> {
    const workflow = this.options.workflows[id].native;
    try {
      const before = await workflow.getWorkflowRunById(executionId);
      let snapshot = before;
      let cancelAcknowledged = true;
      if (!isNativeTerminal(before?.status)) {
        try {
          await (invocation ?? (await workflow.createRun({ runId: executionId }))).cancel();
        } catch {
          // The call may have thrown after writing a canceled snapshot.
          cancelAcknowledged = false;
        }
      }
      let result = invocation?.result;
      if (cancelAcknowledged && invocation) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const completed = await Promise.race([
            invocation.finished.then(
              value => ({ value }),
              () => ({ value: undefined }),
            ),
            new Promise<null>(resolve => {
              timer = setTimeout(() => resolve(null), 1000);
            }),
          ]);
          if (completed === null) return { kind: 'uncertain' };
          result = completed.value;
        } finally {
          clearTimeout(timer);
        }
      }
      if (!isNativeTerminal(snapshot?.status)) snapshot = await workflow.getWorkflowRunById(executionId);
      if (
        snapshot?.status === 'canceled' &&
        ((expectsSuspension && before?.status === 'suspended') ||
          (result && result.status !== 'success' && result.status !== 'paused'))
      )
        return { kind: 'canceled' };
      if (
        result &&
        (result.status === 'success' || result.status === 'failed' || result.status === 'tripwire') &&
        snapshot?.status === result.status
      )
        return { kind: 'terminal', result };
    } catch {
      // A missing or conflicting native observation cannot settle a hold.
    }
    return { kind: 'uncertain' };
  }
  private async expireClaim(record: ExpiryClaim) {
    let confirmed = false;
    try {
      try {
        this.compatible(record.resourceId, record);
        const workflow = this.options.workflows[record.resourceId].native;
        const before = await workflow.getWorkflowRunById(record.id);
        if (before?.status === 'suspended') {
          if (!(await this.options.workflowStorage.confirmExpiredSuspension(record))) return;
          const run = await workflow.createRun({ runId: record.id });
          try {
            await run.cancel();
          } catch {
            // A lost local acknowledgement can still leave a corroborating
            // native snapshot. The persisted suspension proof remains required.
          }
          confirmed = (await workflow.getWorkflowRunById(record.id))?.status === 'canceled';
        } else confirmed = before?.status === 'canceled' && record.expiry.confirmedSuspended;
      } catch {
        // Missing, active or conflicting snapshots never prove safe release.
        confirmed = false;
      }
      await this.options.accounting.finish(
        record.id,
        { status: confirmed ? 'canceled' : 'uncertain', measurements: [], measurementComplete: false },
        null,
        { executionId: record.id, version: record.version, expiryToken: record.expiry.token },
      );
    } finally {
      await this.options.workflowStorage.releaseExpiry(record, !confirmed);
    }
  }

  async expireSuspensions(now = Date.now()) {
    parseInput(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), now);
    const expired: string[] = [];
    for (const candidate of await this.options.workflowStorage.overdue(now)) {
      const resource = this.options.workflows[candidate.resourceId];
      if (!resource || !resource.compatible(candidate.adapterVersion, this.options.agents)) continue;
      const record = await this.options.workflowStorage.claimExpiry(candidate.id, now);
      if (!record) continue;
      await this.expireClaim(record);
      expired.push(record.id);
    }
    return expired;
  }
}
