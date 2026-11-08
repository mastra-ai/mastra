import { z } from 'zod';
import type { AnyWorkflow } from '@mastra/core/workflows';
import { BillingError, identifierSchema, parseInput } from './contracts.js';
import type { BillingProvider } from './contracts.js';
import { boundedJson } from './accounting.js';
import type { BillingResponse, BoundedExecutor, Json } from './accounting.js';
import { BillingGateway } from './gateway.js';
import { parseBillingConfiguration } from './configuration.js';
import type { OrganizationService, BillingContext } from './organizations.js';
import type { AccountingStorage } from './storage/accounting.js';
import type { WorkflowStorage } from './storage/workflows.js';
import type { AgentRegistry, WorkflowRegistry, WorkflowResponse } from './execution-types.js';
import { AgentExecution } from './agent-execution.js';
import { WorkflowExecution } from './workflow-execution.js';
import { InvocationContext } from './invocation-context.js';
export type { GenerationResponse, WorkflowResponse } from './execution-types.js';

const measures = ['tokens', 'input-tokens', 'output-tokens', 'model-calls'] as const;
type Receipt = BillingResponse['billing'];
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
  private readonly agentExecution: AgentExecution<Agents>;
  private readonly workflowExecution: WorkflowExecution<Agents, Workflows>;
  constructor(options: {
    organizations: OrganizationService;
    accounting: AccountingStorage;
    workflowStorage: WorkflowStorage;
    provider: BillingProvider;
    configuration: unknown;
    agents: Agents;
    workflows: Workflows;
  }) {
    for (const workflow of Object.values(options.workflows)) workflow.definition(options.agents);
    const executors: BoundedExecutor[] = [];
    for (const id of Object.keys(options.agents))
      executors.push({
        resourceId: id,
        operation: 'generate',
        measurements: [],
        execute: (input, budget) => this.agentExecution.execute(id, input, budget.executionId),
      });
    for (const id of Object.keys(options.workflows))
      executors.push({
        resourceId: id,
        operation: 'start',
        measurements: [],
        execute: (input, budget) => this.workflowExecution.execute(id, input, budget.executionId),
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
    const context = new InvocationContext();
    this.agentExecution = new AgentExecution(
      {
        organizations: options.organizations,
        accounting: options.accounting,
        workflowStorage: options.workflowStorage,
        agents: options.agents,
        gateway: this.gateway,
      },
      context,
    );
    this.workflowExecution = new WorkflowExecution(
      {
        organizations: options.organizations,
        accounting: options.accounting,
        workflowStorage: options.workflowStorage,
        agents: options.agents,
        workflows: options.workflows,
        gateway: this.gateway,
      },
      context,
    );
  }

  agent<K extends keyof Agents & string>(id: K) {
    return this.agentExecution.agent(id);
  }
  nestedAgent<K extends keyof Agents & string>(id: K) {
    return this.agentExecution.nestedAgent(id);
  }
  workflow<K extends keyof Workflows & string>(id: K) {
    return this.workflowExecution.workflow(id);
  }
  expireSuspensions(now = Date.now()) {
    return this.workflowExecution.expireSuspensions(now);
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
      if (operation === 'status') response = await this.workflowExecution.read(resourceId, executionId, billing);
      else {
        if (!key) throw new BillingError('invalid_input');
        if (operation === 'start')
          response = await this.workflowExecution.start(resourceId, executionId, {
            billing,
            idempotencyKey: key,
            inputData: input,
          });
        else if (operation === 'resume') {
          const parsed = parseInput(z.strictObject({ step: identifierSchema, resumeData: z.unknown() }), input);
          response = await this.workflowExecution.resume(resourceId, executionId, {
            ...parsed,
            resumeData: parsed.resumeData,
            billing,
            idempotencyKey: key,
          });
        } else
          response = await this.workflowExecution.cancel(resourceId, executionId, { billing, idempotencyKey: key });
      }
      return {
        result: boundedJson(response.kind === 'immediate' ? response.projection : response.result),
        billing: response.billing,
      };
    },
  };
}
