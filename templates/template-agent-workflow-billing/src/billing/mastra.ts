import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FullOutput, LanguageModelUsage } from '@mastra/core/stream';
import type { AnyWorkflow } from '@mastra/core/workflows';
import { BillingError, identifierSchema, parseInput, quantitySchema } from './contracts.js';
import type { BillingProvider } from './contracts.js';
import { boundedJson, fingerprint } from './accounting.js';
import type {
  AdmissionIdentity,
  BillingResponse,
  BoundedExecutor,
  ExecutorOutcome,
  Json,
  ResourceConfiguration,
} from './accounting.js';
import { BillingGateway } from './gateway.js';
import { parseBillingConfiguration } from './configuration.js';
import { OrganizationService } from './organizations.js';
import type { BillingContext } from './organizations.js';
import { AccountingStorage } from './storage/accounting.js';
import { WorkflowStorage } from './storage/workflows.js';
import type { WorkflowRecord } from './storage/workflows.js';
import {
  AgentResource,
  WorkflowResource,
  generateRequestSchema,
  safeGenerateOptionsSchema,
} from './mastra-resources.js';
import type {
  AgentProjection,
  NativeWorkflowResult,
  SafeGenerateOptions,
  WorkflowInput,
  WorkflowOutput,
  WorkflowProjection,
  WorkflowResume,
} from './mastra-resources.js';

const runtime = randomUUID();
const measures = ['tokens', 'input-tokens', 'output-tokens', 'model-calls'] as const;
type Measurement = NonNullable<ExecutorOutcome['measurements']>[number];
type Receipt = BillingResponse['billing'];
export type GenerationResponse<Output> =
  | {
      readonly kind: 'immediate';
      readonly result: FullOutput<Output>;
      readonly projection: AgentProjection<Output>;
      readonly billing: Receipt;
    }
  | { readonly kind: 'replay'; readonly result: AgentProjection<Output> | null; readonly billing: Receipt }
  | { readonly kind: 'nested'; readonly result: FullOutput<Output>; readonly parentExecutionId: string };
export type WorkflowResponse<W extends AnyWorkflow> =
  | {
      readonly kind: 'immediate';
      readonly result: NativeWorkflowResult<W>;
      readonly projection: WorkflowProjection<WorkflowOutput<W>>;
      readonly billing: Receipt;
    }
  | {
      readonly kind: 'replay';
      readonly result: WorkflowProjection<WorkflowOutput<W>>;
      readonly billing: Receipt | null;
    };

class MeasurementCollector {
  private call = 0;
  private steps = 0;
  private observed = 0;
  private reservedCalls = 0;
  complete = true;
  overflow = false;
  captureFailed = false;
  readonly controller = new AbortController();
  constructor(
    readonly executionId: string,
    readonly segment: number,
    readonly identity: AdmissionIdentity,
    readonly resource: ResourceConfiguration,
    private readonly storage: AccountingStorage,
    private readonly workflows: WorkflowStorage,
    private readonly workflow: boolean,
    private readonly cancel?: () => Promise<void>,
    initialUnits = 0,
  ) {
    this.observed = initialUnits;
  }
  nextCall(maxSteps: number) {
    const charge = this.resource.policy.charge;
    if (
      charge.type === 'usage' &&
      charge.measure === 'model-calls' &&
      this.reservedCalls + maxSteps > charge.maxUnits
    ) {
      this.overflow = true;
      this.controller.abort();
      throw new BillingError('conflict');
    }
    this.reservedCalls += maxSteps;
    return ++this.call;
  }
  get callCount() {
    return this.call;
  }
  get stepCount() {
    return this.steps;
  }
  async missing() {
    this.complete = false;
    if (this.workflow) await this.workflows.incomplete(this.executionId);
  }
  async capture(call: number, step: number, usage: LanguageModelUsage) {
    this.steps++;
    const numeric = (value: unknown) => quantitySchema.safeParse(value);
    const input = numeric(usage.inputTokens),
      output = numeric(usage.outputTokens),
      total = numeric(usage.totalTokens);
    const coherent =
      input.success &&
      output.success &&
      total.success &&
      BigInt(input.data) + BigInt(output.data) === BigInt(total.data);
    const values: Record<string, number | undefined> = {
      'input-tokens': input.success ? input.data : undefined,
      'output-tokens': output.success ? output.data : undefined,
      tokens: coherent ? total.data : undefined,
      'model-calls': 1,
    };
    const observations: Measurement[] = [];
    for (const measure of this.resource.measurements) {
      const units = values[measure.key];
      if (units !== undefined)
        observations.push({
          id: `segment:${this.segment}:call:${call}:step:${step}:${measure.key}`,
          measure: measure.key,
          units,
        });
    }
    try {
      await this.storage.capture(this.executionId, observations);
      const charge = this.resource.policy.charge;
      if (charge.type !== 'usage' && this.resource.measurements.some(measure => values[measure.key] === undefined))
        await this.missing();
      if (charge.type === 'usage') {
        const units = values[charge.measure];
        if (units === undefined) await this.missing();
        else {
          this.observed += units;
          if (!Number.isSafeInteger(this.observed) || this.observed > charge.maxUnits) {
            this.overflow = true;
            this.controller.abort();
            await this.cancel?.();
          }
        }
      }
    } catch (error) {
      this.captureFailed = true;
      this.controller.abort();
      throw error;
    }
  }
}
const parentExecution = new AsyncLocalStorage<MeasurementCollector>();
type AgentRegistry = Record<string, AgentResource<any>>;
type WorkflowRegistry = Record<string, WorkflowResource<any>>;
type AgentResult<R> = R extends AgentResource<infer Output> ? Output : never;
type NativeWorkflow<R> = R extends WorkflowResource<infer W> ? W : never;

export interface BillingHttpGateway {
  generate(
    resourceId: string,
    prompt: string,
    billing: BillingContext,
    key: string,
  ): Promise<{ result: Json | null; billing: Receipt }>;
  createRun(resourceId: string, billing: BillingContext, key: string): Promise<{ executionId: string }>;
  workflowOperation(
    resourceId: string,
    executionId: string,
    operation: 'start' | 'resume' | 'cancel' | 'status',
    billing: BillingContext,
    key: string | undefined,
    input: Json,
  ): Promise<{ result: Json; billing: Receipt | null }>;
}

export class MastraBilling<Agents extends AgentRegistry, Workflows extends WorkflowRegistry> {
  readonly gateway: BillingGateway;
  private readonly immediateAgents = new Map<string, FullOutput<any>>();
  private readonly immediateWorkflows = new Map<string, unknown>();
  private readonly running = new Map<string, { cancel: () => Promise<void>; finished: Promise<unknown> }>();
  constructor(
    private readonly options: {
      organizations: OrganizationService;
      accounting: AccountingStorage;
      workflowStorage: WorkflowStorage;
      provider: BillingProvider;
      configuration: unknown;
      agents: Agents;
      workflows: Workflows;
    },
  ) {
    const executors: BoundedExecutor[] = [];
    for (const id of Object.keys(options.agents))
      executors.push({
        resourceId: id,
        operation: 'generate',
        measurements: [],
        execute: (input, budget) => this.executeAgent(id, input, budget.executionId),
      });
    for (const id of Object.keys(options.workflows))
      executors.push({
        resourceId: id,
        operation: 'start',
        measurements: [],
        execute: (input, budget) => this.executeWorkflow(id, input, budget.executionId),
      });
    // Resolve the configuration once, then certify only capabilities this adapter actually supplies.
    const raw = parseBillingConfiguration(options.configuration, options.provider.capabilities);
    for (const executor of executors) {
      const resource = raw.resources?.find(item => item.id === executor.resourceId);
      if (!resource) throw new BillingError('invalid_configuration');
      const agent = options.agents[executor.resourceId];
      const workflow = options.workflows[executor.resourceId];
      if (
        resource.kind !== (agent ? 'agent' : 'workflow') ||
        resource.measurements.some(measure => !measures.includes(measure.key as (typeof measures)[number]))
      )
        throw new BillingError('invalid_configuration');
      const charge = resource.policy.charge;
      if (
        charge.type === 'usage' &&
        ((!agent && (workflow.measurement !== 'facade-calls' || charge.funding === 'prepaid')) ||
          (agent && charge.funding === 'prepaid' && charge.measure !== 'model-calls'))
      )
        throw new BillingError('invalid_configuration');
      const descriptors = resource.measurements.map(measure => ({
        key: measure.key,
        maxUnits: charge.type === 'usage' ? charge.maxUnits : Number.MAX_SAFE_INTEGER,
        enforceableBound: !!agent && measure.key === 'model-calls',
      }));
      if (agent && charge.type === 'usage' && charge.funding === 'prepaid' && !agent.enforceableCallBound)
        throw new BillingError('invalid_configuration');
      if (
        agent &&
        charge.type === 'usage' &&
        charge.measure === 'model-calls' &&
        agent.limits.maxSteps > charge.maxUnits
      )
        throw new BillingError('invalid_configuration');
      Object.assign(executor, { measurements: descriptors });
    }
    this.gateway = new BillingGateway(
      options.organizations,
      options.accounting,
      options.provider,
      options.configuration,
      executors,
    );
  }

  agent<K extends keyof Agents & string>(id: K) {
    const resource = this.options.agents[id];
    if (!resource) throw new BillingError('unsupported');
    return Object.freeze({
      generate: async (
        prompt: string,
        request: SafeGenerateOptions & { idempotencyKey: string; billing: BillingContext },
      ): Promise<GenerationResponse<AgentResult<Agents[K]>>> => {
        const { billing, idempotencyKey, ...options } = request;
        const input = parseInput(generateRequestSchema, { prompt, idempotencyKey });
        const safe = parseInput(safeGenerateOptionsSchema, options);
        const parent = parentExecution.getStore();
        if (parent) {
          const identity = await this.options.organizations.accountingIdentity(billing);
          if (identity.actorId !== parent.identity.actorId || identity.workspaceId !== parent.identity.workspaceId)
            throw new BillingError('forbidden');
          return {
            kind: 'nested',
            result: await this.generate(resource, input.prompt, parent, safe),
            parentExecutionId: parent.executionId,
          };
        }
        // Callbacks and signals are per-invocation behavior, never persisted or fingerprinted.
        const identity = await this.options.organizations.accountingIdentity(billing);
        const response = await this.invocationIdentity.run(identity, () =>
          this.agentOptions.run(safe, () =>
            this.gateway.execute(billing, {
              resourceId: id,
              operation: 'generate',
              idempotencyKey: input.idempotencyKey,
              input: { prompt: input.prompt, adapterVersion: resource.definition },
            }),
          ),
        );
        const immediate = response.billing.replayed
          ? undefined
          : this.immediateAgents.get(response.billing.executionId);
        if (!response.billing.replayed) this.immediateAgents.delete(response.billing.executionId);
        if (immediate && !response.billing.replayed)
          return {
            kind: 'immediate',
            result: immediate,
            projection: resource.project(immediate),
            billing: response.billing,
          };
        return {
          kind: 'replay',
          result: response.result === null ? null : resource.parseProjection(response.result),
          billing: response.billing,
        };
      },
    });
  }
  nestedAgent<K extends keyof Agents & string>(id: K) {
    const resource = this.options.agents[id];
    if (!resource) throw new BillingError('unsupported');
    return Object.freeze({
      generate: async (
        prompt: string,
        options: SafeGenerateOptions = {},
      ): Promise<FullOutput<AgentResult<Agents[K]>>> => {
        const parent = parentExecution.getStore();
        if (!parent) throw new BillingError('unsupported');
        parseInput(z.string().min(1).max(8192), prompt);
        const safe = parseInput(safeGenerateOptionsSchema, options);
        // Recheck the existing admitted identity without persisting bearer credentials in snapshots.
        await this.options.accounting.read(parent.identity, parent.executionId);
        return this.generate(resource, prompt, parent, safe);
      },
    });
  }
  private readonly agentOptions = new AsyncLocalStorage<SafeGenerateOptions>();
  private async generate<Output>(
    resource: AgentResource<Output>,
    prompt: string,
    collector: MeasurementCollector,
    options: SafeGenerateOptions,
  ) {
    const charge = collector.resource.policy.charge;
    if (charge.type === 'usage' && charge.funding === 'prepaid' && !resource.enforceableCallBound)
      throw new BillingError('unsupported');
    const call = collector.nextCall(resource.limits.maxSteps);
    let step = 0;
    const signal = options.abortSignal
      ? AbortSignal.any([collector.controller.signal, options.abortSignal])
      : collector.controller.signal;
    try {
      return await resource.generate(prompt, {
        abortSignal: signal,
        onStepFinish: async value => {
          await collector.capture(call, ++step, value.usage);
          await options.onStepFinish?.(value);
        },
      });
    } catch (error) {
      await collector.missing();
      throw error;
    }
  }
  private async executeAgent(id: string, input: Json, executionId: string): Promise<ExecutorOutcome> {
    const resource = this.options.agents[id];
    const request = parseInput(
      z.strictObject({ prompt: z.string().min(1).max(8192), adapterVersion: identifierSchema }),
      input,
    );
    const identity = this.invocationIdentity.getStore();
    if (!identity) throw new BillingError('state_unavailable');
    const collector = new MeasurementCollector(
      executionId,
      1,
      identity,
      this.gateway.resource(id),
      this.options.accounting,
      this.options.workflowStorage,
      false,
    );
    try {
      const result = await parentExecution.run(collector, () =>
        this.generate(resource, request.prompt, collector, this.agentOptions.getStore() ?? {}),
      );
      if (collector.stepCount === 0) await collector.missing();
      const projection = resource.storedProjection(result);
      this.immediateAgents.set(executionId, result);
      return {
        status: collector.captureFailed
          ? 'uncertain'
          : collector.overflow
            ? 'failed'
            : result.finishReason === 'aborted'
              ? 'canceled'
              : ['stop', 'length'].includes(result.finishReason ?? '')
                ? 'succeeded'
                : 'failed',
        result: projection,
        measurements: [],
        measurementComplete: collector.complete,
      };
    } catch {
      return { status: collector.captureFailed ? 'uncertain' : 'failed', measurements: [], measurementComplete: false };
    }
  }
  private readonly invocationIdentity = new AsyncLocalStorage<AdmissionIdentity>();

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
        if (parentExecution.getStore()) throw new BillingError('unsupported');
        const identity = await this.options.organizations.accountingIdentity(request.billing);
        const record = await this.options.workflowStorage.create(
          identity,
          this.gateway.resource(id),
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
    const definition = this.adapterVersion(id);
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
  private async read<W extends AnyWorkflow>(
    id: string,
    executionId: string,
    billing: BillingContext,
  ): Promise<WorkflowResponse<W>> {
    const record = await this.owned(id, executionId, billing);
    return { kind: 'replay', result: await this.project(id, record), billing: await this.receipt(record, billing) };
  }
  private adapterVersion(id: string) {
    const workflow = this.options.workflows[id];
    return `definition:${fingerprint(
      boundedJson({
        version: workflow.version,
        measurement: workflow.measurement,
        expectedCalls: workflow.expectedCalls,
        agents: Object.entries(this.options.agents)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([key, agent]) => ({ key, definition: agent.definition })),
      }),
    )}`;
  }
  private compatible(id: string, record: WorkflowRecord) {
    if (record.adapterVersion !== this.adapterVersion(id)) throw new BillingError('state_unavailable');
  }
  private async start<W extends AnyWorkflow>(
    id: string,
    executionId: string,
    request: { inputData: WorkflowInput<W>; billing: BillingContext; idempotencyKey: string },
  ): Promise<WorkflowResponse<W>> {
    if (parentExecution.getStore()) throw new BillingError('unsupported');
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
      await this.invocationIdentity.run(identity, () =>
        this.gateway.execute(
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
  private async executeWorkflow(id: string, input: Json, executionId: string): Promise<ExecutorOutcome> {
    const request = parseInput(
      z.strictObject({ executionId: identifierSchema, inputData: z.unknown(), version: z.number().int().positive() }),
      input,
    );
    const record = await this.options.workflowStorage.current(executionId);
    if (record.status !== 'running' || record.version !== request.version || record.owner !== runtime)
      return { status: 'uncertain', measurements: [], measurementComplete: false };
    const identity = this.invocationIdentity.getStore();
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
    );
    const abort = () => collector.controller.abort();
    run.abortController.signal.addEventListener('abort', abort, { once: true });
    const pending = parentExecution.run(collector, () =>
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
  private async resume<W extends AnyWorkflow>(
    id: string,
    executionId: string,
    request: { step: string; resumeData: unknown; billing: BillingContext; idempotencyKey: string },
  ): Promise<WorkflowResponse<W>> {
    if (parentExecution.getStore()) throw new BillingError('unsupported');
    const record = await this.owned(id, executionId, request.billing);
    this.compatible(id, record);
    const input = parseInput(
      z.strictObject({ step: identifierSchema, resumeData: z.unknown().transform(value => boundedJson(value)) }),
      { step: request.step, resumeData: request.resumeData },
    );
    await this.options.workflows[id].resumeInput(input.step, input.resumeData);
    const identity = await this.gateway.revalidate(request.billing, record.configuration);
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
  private async cancel<W extends AnyWorkflow>(
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
  startExpiryWorker(options: { intervalMs?: number; onError?: (error: unknown) => void } = {}) {
    const intervalMs = parseInput(z.number().int().min(100).max(3600000), options.intervalMs ?? 30000);
    let active = false;
    let stopped = false;
    const tick = async () => {
      if (active || stopped) return;
      active = true;
      try {
        await this.expireSuspensions();
      } finally {
        active = false;
      }
    };
    const ready = tick();
    const timer = setInterval(() => {
      void tick().catch(error => options.onError?.(error));
    }, intervalMs);
    timer.unref();
    return {
      ready,
      stop: () => {
        stopped = true;
        clearInterval(timer);
      },
    };
  }

  readonly http: BillingHttpGateway = {
    generate: async (resourceId, prompt, billing, key) => {
      const response = await this.agent(resourceId).generate(prompt, { billing, idempotencyKey: key });
      if (response.kind === 'nested') throw new BillingError('unsupported');
      return {
        result:
          response.kind === 'immediate'
            ? boundedJson(response.projection)
            : response.result === null
              ? null
              : boundedJson(response.result),
        billing: response.billing,
      };
    },
    createRun: async (resourceId, billing, key) => ({
      executionId: (await this.workflow(resourceId).createRun({ billing, idempotencyKey: key })).executionId,
    }),
    workflowOperation: async (resourceId, executionId, operation, billing, key, input) => {
      let response: WorkflowResponse<AnyWorkflow>;
      if (operation === 'status') response = await this.read(resourceId, executionId, billing);
      else {
        if (!key) throw new BillingError('invalid_input');
        if (operation === 'start')
          response = await this.start(resourceId, executionId, { billing, idempotencyKey: key, inputData: input });
        else if (operation === 'resume') {
          const parsed = parseInput(z.strictObject({ step: identifierSchema, resumeData: z.unknown() }), input);
          response = await this.resume(resourceId, executionId, {
            ...parsed,
            resumeData: parsed.resumeData,
            billing,
            idempotencyKey: key,
          });
        } else response = await this.cancel(resourceId, executionId, { billing, idempotencyKey: key });
      }
      return {
        result: boundedJson(response.kind === 'immediate' ? response.projection : response.result),
        billing: response.billing,
      };
    },
  };

  async expireSuspensions(now = Date.now()) {
    parseInput(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), now);
    const expired: string[] = [];
    for (const candidate of await this.options.workflowStorage.overdue(now)) {
      const resource = this.options.workflows[candidate.resourceId];
      if (!resource || this.adapterVersion(candidate.resourceId) !== candidate.adapterVersion) continue;
      const record = await this.options.workflowStorage.claimExpiry(candidate.id, now);
      if (!record) continue;
      await this.terminate(candidate.resourceId, record, true);
      expired.push(record.id);
    }
    return expired;
  }
}
