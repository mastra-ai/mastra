import { z } from 'zod';
import type { FullOutput } from '@mastra/core/stream';
import { BillingError, identifierSchema, parseInput } from './contracts.js';
import type { Json, ExecutorOutcome } from './accounting.js';
import type { BillingGateway } from './gateway.js';
import type { OrganizationService, BillingContext } from './organizations.js';
import type { AccountingStorage } from './storage/accounting.js';
import type { WorkflowStorage } from './storage/workflows.js';
import { AgentResource, generateRequestSchema, safeGenerateOptionsSchema } from './mastra-resources.js';
import type { SafeGenerateOptions } from './mastra-resources.js';
import type { AgentRegistry, AgentResult, GenerationResponse } from './execution-types.js';
import { MeasurementCollector } from './measurement.js';
import type { InvocationContext } from './invocation-context.js';

export class AgentExecution<Agents extends AgentRegistry> {
  private readonly immediateAgents = new Map<string, FullOutput<any>>();
  constructor(
    private readonly options: {
      organizations: OrganizationService;
      accounting: AccountingStorage;
      workflowStorage: WorkflowStorage;
      agents: Agents;
      gateway: BillingGateway;
    },
    private readonly context: InvocationContext,
  ) {}
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
        const parent = this.context.parent.getStore();
        if (parent) {
          if (parent.agentDependencies && !parent.agentDependencies.includes(id)) throw new BillingError('unsupported');
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
        const response = await this.context.identity.run(identity, () =>
          this.context.agentOptions.run(safe, () =>
            this.options.gateway.execute(billing, {
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
        const parent = this.context.parent.getStore();
        if (!parent || (parent.agentDependencies && !parent.agentDependencies.includes(id)))
          throw new BillingError('unsupported');
        parseInput(z.string().min(1).max(8192), prompt);
        const safe = parseInput(safeGenerateOptionsSchema, options);
        // Recheck the existing admitted identity without persisting bearer credentials in snapshots.
        await this.options.accounting.read(parent.identity, parent.executionId);
        return this.generate(resource, prompt, parent, safe);
      },
    });
  }
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
  async execute(id: string, input: Json, executionId: string): Promise<ExecutorOutcome> {
    const resource = this.options.agents[id];
    const request = parseInput(
      z.strictObject({ prompt: z.string().min(1).max(8192), adapterVersion: identifierSchema }),
      input,
    );
    const identity = this.context.identity.getStore();
    if (!identity) throw new BillingError('state_unavailable');
    const collector = new MeasurementCollector(
      executionId,
      1,
      identity,
      this.options.gateway.resource(id),
      this.options.accounting,
      this.options.workflowStorage,
      false,
    );
    try {
      const result = await this.context.parent.run(collector, () =>
        this.generate(resource, request.prompt, collector, this.context.agentOptions.getStore() ?? {}),
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
}
