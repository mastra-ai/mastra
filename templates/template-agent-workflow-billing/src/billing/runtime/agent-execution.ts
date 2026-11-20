import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import { withinExecution } from './execution-scope.js';
import type { FullOutput } from '@mastra/core/stream';
import { BillingError, identifierSchema, parseInput } from '../contracts/core.js';
import type { ExecutorOutcome } from './accounting.js';
import type { BillingGateway } from './gateway.js';
import type { OrganizationService, BillingContext } from '../organizations.js';
import type { AccountingStorage } from '../storage/accounting.js';
import type { WorkflowStorage } from '../storage/workflows.js';
import { AgentResource, generateRequestSchema, safeGenerateOptionsSchema } from '../mastra-resources.js';
import type { SafeGenerateOptions } from '../mastra-resources.js';
import type { AgentRegistry, AgentResult, GenerationResponse } from '../contracts/execution.js';
import { MeasurementCollector } from './measurement.js';
import type { InvocationContext } from './invocation-context.js';

export const agentExecutionInputSchema = z.strictObject({
  prompt: z.string().min(1).max(8192),
  adapterVersion: identifierSchema,
});
export type AgentExecutionInput = z.infer<typeof agentExecutionInputSchema>;

export class AgentExecution<Agents extends AgentRegistry> {
  private readonly invocationOutput = new AsyncLocalStorage<{ result?: FullOutput<any> }>();
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
        const input = parseInput(generateRequestSchema, { prompt: resource.validatePrompt(prompt), idempotencyKey });
        const safe = parseInput(safeGenerateOptionsSchema, options);
        const parent = this.context.parent.getStore();
        if (parent) {
          const dependencies = this.context.agentDependencies.getStore() ?? parent.agentDependencies;
          if (dependencies && !dependencies.includes(id)) throw new BillingError('unsupported');
          const identity = await this.options.organizations.accountingIdentity(billing);
          if (identity.actorId !== parent.identity.actorId || identity.workspaceId !== parent.identity.workspaceId)
            throw new BillingError('forbidden');
          return {
            kind: 'nested',
            result: await this.generateNested(resource, input.prompt, parent, safe),
            parentExecutionId: parent.executionId,
          };
        }
        const capture: { result?: FullOutput<any> } = {};
        return this.invocationOutput.run(capture, async () => {
          try {
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
            const immediate = response.billing.replayed ? undefined : capture.result;
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
          } finally {
            delete capture.result;
          }
        });
      },
    });
  }
  async read(id: string, context: BillingContext, key: string) {
    const resource = this.options.agents[id];
    if (!resource) throw new BillingError('unsupported');
    const response = await this.options.accounting.readRequest(
      await this.options.organizations.accountingIdentity(context),
      id,
      parseInput(identifierSchema, key),
    );
    return response === null
      ? null
      : {
          result: response.result === null ? null : resource.parseProjection(response.result),
          billing: response.billing,
        };
  }
  nestedAgent<K extends keyof Agents & string>(id: K) {
    const resource = this.options.agents[id];
    if (!resource) throw new BillingError('unsupported');
    return Object.freeze({
      generate: async (
        prompt: string,
        options: SafeGenerateOptions & { slot?: number } = {},
      ): Promise<FullOutput<AgentResult<Agents[K]>>> => {
        const parent = this.context.parent.getStore();
        const dependencies = this.context.agentDependencies.getStore() ?? parent?.agentDependencies;
        if (!parent || (dependencies && !dependencies.includes(id))) throw new BillingError('unsupported');
        const parsedPrompt = resource.validatePrompt(parseInput(z.string().min(1).max(8192), prompt));
        const { slot, ...behavior } = options;
        const safe = parseInput(safeGenerateOptionsSchema, behavior);
        return this.generateNested(
          resource,
          parsedPrompt,
          parent,
          safe,
          parseInput(z.number().int().min(0).max(2).optional(), slot),
        );
      },
    });
  }
  private async generateNested<Output>(
    resource: AgentResource<Output>,
    prompt: string,
    parent: MeasurementCollector,
    options: SafeGenerateOptions,
    slot = 0,
  ) {
    const deadline = await this.options.accounting.segmentDeadline(
      parent.identity,
      parent.executionId,
      parent.workflowVersion,
    );
    if (deadline !== null && Date.now() >= deadline) throw new BillingError('state_unavailable');
    return this.generate(resource, prompt, parent, options, slot);
  }
  private async generate<Output>(
    resource: AgentResource<Output>,
    prompt: string,
    collector: MeasurementCollector,
    options: SafeGenerateOptions,
    slot = 0,
  ) {
    const charge = collector.resource.policy.charge;
    if (charge.type === 'usage' && charge.funding === 'prepaid' && !resource.enforceableCallBound)
      throw new BillingError('unsupported');
    collector.controller.signal.throwIfAborted();
    const call = collector.nextCall(resource.limits.maxSteps);
    let step = 0;
    const signal = options.abortSignal
      ? AbortSignal.any([collector.controller.signal, options.abortSignal])
      : collector.controller.signal;
    try {
      const scope = {
        collector,
        prompt,
        slot,
        signal,
        checkpoint: async () => {
          signal.throwIfAborted();
          const deadline = await this.options.accounting.segmentDeadline(
            collector.identity,
            collector.executionId,
            collector.workflowVersion,
          );
          if (deadline !== null && Date.now() >= deadline) throw new BillingError('state_unavailable');
        },
      };
      return await this.context.agentDependencies.run(resource.agentDependencies, () =>
        withinExecution(scope, async () =>
          resource.complete(
            scope,
            await resource.generate(prompt, {
              abortSignal: signal,
              onStepFinish: async value => {
                await collector.capture(call, ++step, value.usage);
                if (!collector.deadlineExpired) await options.onStepFinish?.(value);
              },
            }),
          ),
        ),
      );
    } catch (error) {
      await collector.missing();
      throw error;
    }
  }
  async execute(id: string, request: AgentExecutionInput, executionId: string): Promise<ExecutorOutcome> {
    const resource = this.options.agents[id];
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
      undefined,
      0,
      resource.agentDependencies,
      resource.artifactSlots,
    );
    try {
      const deadline = await this.options.accounting.segmentDeadline(identity, executionId);
      const execution = await collector.runWithinDeadline(deadline, () =>
        this.context.parent.run(collector, () =>
          this.generate(resource, request.prompt, collector, this.context.agentOptions.getStore() ?? {}),
        ),
      );
      if (execution.status !== 'finished')
        return {
          status: execution.status === 'expired_before_dispatch' ? 'failed' : 'timed_out',
          measurements: [],
          measurementComplete: false,
        };
      const result = execution.value;
      if (collector.stepCount === 0) await collector.missing();
      const projection = resource.storedProjection(result);
      const capture = this.invocationOutput.getStore();
      if (capture) capture.result = result;
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
