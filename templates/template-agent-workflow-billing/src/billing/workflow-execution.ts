import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AnyWorkflow } from '@mastra/core/workflows';
import { BillingError, identifierSchema, parseInput } from './contracts.js';
import { boundedJson } from './accounting.js';
import type { AdmissionIdentity, ExecutorOutcome, Json } from './accounting.js';
import type { BillingGateway } from './gateway.js';
import type { OrganizationService, BillingContext } from './organizations.js';
import type { AccountingStorage } from './storage/accounting.js';
import type { WorkflowStorage, WorkflowRecord, ExpiryClaim } from './storage/workflows.js';
import type {
  WorkflowResource,
  WorkflowInput,
  WorkflowOutput,
  WorkflowProjection,
  WorkflowResume,
  NativeWorkflowResult,
} from './mastra-resources.js';
import type { AgentRegistry, WorkflowRegistry, NativeWorkflow, WorkflowResponse } from './execution-types.js';
import { MeasurementCollector } from './measurement.js';
import type { InvocationContext } from './invocation-context.js';

const runtime = randomUUID();
export class WorkflowExecution<Agents extends AgentRegistry, Workflows extends WorkflowRegistry> {
  private readonly immediateWorkflows = new Map<string, unknown>();
  private readonly running = new Map<string, { cancel: () => Promise<void>; finished: Promise<unknown> }>();
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
  private async receipt(record: WorkflowRecord, billing: BillingContext) {
    await this.options.organizations.accountingIdentity(billing);
    if (record.status === 'created' || !(await this.options.accounting.hasExecution(record.id))) return null;
    return (await this.options.accounting.read(await this.options.organizations.accountingIdentity(billing), record.id))
      .billing;
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
    const record = await this.owned(id, executionId, billing);
    return { kind: 'replay', result: await this.project(id, record), billing: await this.receipt(record, billing) };
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
      runtime,
    );
    if (!claim.claimed) return this.read(id, executionId, request.billing);
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
    return this.workflowResponse(id, executionId, request.billing);
  }
  async execute(id: string, input: Json, executionId: string): Promise<ExecutorOutcome> {
    const request = parseInput(
      z.strictObject({ executionId: identifierSchema, inputData: z.unknown(), version: z.number().int().positive() }),
      input,
    );
    const record = await this.options.workflowStorage.current(executionId);
    if (record.status !== 'running' || record.version !== request.version || record.owner !== runtime)
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
      () => run.cancel(),
      previous.billing.observedUnits ?? 0,
      resource.agentDependencies,
    );
    const abort = () => collector.controller.abort();
    run.abortController.signal.addEventListener('abort', abort, { once: true });
    const pending = this.context.parent.run(collector, () =>
      'inputData' in operation ? run.start({ inputData: operation.inputData }) : run.resume(operation),
    );
    this.running.set(record.id, { cancel: () => run.cancel(), finished: pending });
    try {
      const result = await pending;
      this.immediateWorkflows.set(record.id, result);
      if (resource.measurement !== 'facade-calls' || collector.callCount !== resource.expectedCalls[record.version - 1])
        await collector.missing();
      const projection =
        result.status === 'success'
          ? { output: await resource.output(result.result) }
          : result.status === 'suspended'
            ? { suspendedSteps: [...new Set(result.suspended.flat())] }
            : {};
      const status = collector.captureFailed
        ? 'uncertain'
        : collector.overflow
          ? 'failed'
          : result.status === 'success'
            ? 'succeeded'
            : result.status === 'suspended'
              ? 'suspended'
              : result.status === 'canceled'
                ? 'canceled'
                : 'failed';
      return {
        status,
        result: boundedJson({ definition: record.adapterVersion, ...projection }),
        measurements: [],
        measurementComplete: collector.complete,
      };
    } catch (error) {
      return {
        status: error instanceof BillingError && error.code === 'invalid_input' ? 'failed' : 'uncertain',
        measurements: [],
        measurementComplete: false,
      };
    } finally {
      run.abortController.signal.removeEventListener('abort', abort);
      this.running.delete(record.id);
    }
  }
  private async workflowResponse<W extends AnyWorkflow>(
    id: string,
    executionId: string,
    billing: BillingContext,
  ): Promise<WorkflowResponse<W>> {
    const record = await this.owned(id, executionId, billing);
    const full = this.immediateWorkflows.get(executionId);
    this.immediateWorkflows.delete(executionId);
    const projection = await this.project<W>(id, record);
    const receipt = await this.receipt(record, billing);
    // This object is the actual SDK return retained for this invocation, never a persisted projection.
    if (full && receipt)
      return { kind: 'immediate', result: full as NativeWorkflowResult<W>, projection, billing: receipt };
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
      runtime,
    );
    if (!claim.claimed) return this.read(id, executionId, request.billing);
    const outcome = await this.runSegment(id, claim.record, identity, input);
    await this.options.accounting.finish(
      executionId,
      outcome,
      outcome.result === undefined ? null : boundedJson(outcome.result),
      { executionId, version: claim.record.version },
    );
    return this.workflowResponse(id, executionId, request.billing);
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
      runtime,
    );
    if (!claim.claimed) return this.read(id, executionId, request.billing);
    if (claim.previous.status === 'created') {
      await this.options.workflowStorage.transition(executionId, claim.record.version, 'canceled');
      return this.read(id, executionId, request.billing);
    }
    await this.terminate(id, claim.record, claim.previous.status === 'suspended');
    return this.read(id, executionId, request.billing);
  }
  private async terminate(id: string, record: WorkflowRecord, confirmedSuspended: boolean) {
    let confirmed = false;
    try {
      const active = this.running.get(record.id);
      const before = await this.options.workflows[id].native.getWorkflowRunById(record.id);
      const suspended = confirmedSuspended && before?.status === 'suspended';
      const run = active ?? (await this.options.workflows[id].native.createRun({ runId: record.id }));
      await run.cancel();
      if (active) {
        await active.finished;
        confirmed = true;
      } else confirmed = suspended;
      const snapshot = await this.options.workflows[id].native.getWorkflowRunById(record.id);
      confirmed &&= snapshot?.status === 'canceled';
    } catch {
      confirmed = false;
    }
    await this.options.accounting.finish(
      record.id,
      { status: confirmed ? 'canceled' : 'uncertain', measurements: [], measurementComplete: false },
      null,
      { executionId: record.id, version: record.version },
    );
  }
  private async expireClaim(record: ExpiryClaim) {
    let confirmed = false;
    try {
      try {
        const workflow = this.options.workflows[record.resourceId].native;
        const before = await workflow.getWorkflowRunById(record.id);
        if (before?.status === 'suspended') {
          if (!(await this.options.workflowStorage.confirmExpiredSuspension(record))) return;
          const run = await workflow.createRun({ runId: record.id });
          await run.cancel();
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
