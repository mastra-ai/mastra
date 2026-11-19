import type { BillingProvider } from './contracts/provider.js';
import { z } from 'zod';
import { prepaid } from './contracts/reservations.js';
import type { ExecutionScope } from './runtime/execution-scope.js';
import type { AgentProjection } from './mastra-resources.js';
import type { ArtifactReader } from './contracts/artifacts.js';
import type { AnyWorkflow } from '@mastra/core/workflows';
import type { FullOutput } from '@mastra/core/stream';
import type { BillingContext } from './organizations.js';
import type { BillingHttpGateway, MastraBilling } from './mastra.js';
import { AgentResource, workflowResource } from './mastra-resources.js';
import type { AnyAgent, AgentOutput, WorkflowResource } from './mastra-resources.js';
import { BillingError, identifierSchema } from './contracts/core.js';
import { billingConfigurationSchema, billingPolicySchema } from './configuration/policy.js';
import type { BillingConfiguration } from './configuration/policy.js';
import { validateProviderConfiguration } from './configuration/providers.js';
import { Lifecycle } from './lifecycle.js';

export interface ResourceDependencies {
  /** Resolve only a declared nested agent, executing within the parent reservation. */
  nestedAgent(id: string): { generate(prompt: string, slot?: number): Promise<FullOutput<unknown>> };
}
export interface ActionContext {
  /** Billing facade that admits work, reserves credit and settles its outcome. */
  execution: BillingHttpGateway;
  /** Authenticate the caller and select a currently authorized workspace. */
  selected(workspaceId: string): Promise<BillingContext>;
}
export interface ResourceAction<S extends z.ZodType = z.ZodType<any, any>> {
  /** Unique registration key used by Mastra, billing policies and routes. */
  readonly id: string;
  /** Human-readable purpose shown to Studio and model callers. */
  readonly description: string;
  /** Deterministic input validation, including transformations and cross-field constraints. */
  readonly inputSchema: S;
  /** Validate and execute an action through the billing facade. */
  readonly execute: (input: unknown, context: ActionContext) => Promise<unknown>;
  /** Execute input already parsed by the SDK, without applying transformations twice. */
  readonly executeValidated: (input: z.output<S>, context: ActionContext) => Promise<unknown>;
}
export function resourceAction<S extends z.ZodType>(options: {
  id: string;
  description: string;
  inputSchema: S;
  execute(input: z.output<S>, context: ActionContext): Promise<unknown>;
}): ResourceAction<S> {
  return {
    ...options,
    execute: (input, context) => options.execute(options.inputSchema.parse(input), context),
    executeValidated: options.execute,
  };
}
type ResourceConfiguration = BillingConfiguration['resourcePolicies'][number];
interface DefinitionBase {
  /** Unique registration key used by Mastra, billing policies and routes. */
  readonly id: string;
  /** Versioned access, reservation and charging policy applied before execution. */
  readonly policy: ResourceConfiguration['policy'];
  /** Allowed public execution operations for this resource kind. */
  readonly operations: ResourceConfiguration['operations'];
  /** Trusted usage observations that the adapter can capture. */
  readonly measurements: ResourceConfiguration['measurements'];
  /** Optional authenticated Studio actions for this resource. */
  readonly actions?: readonly ResourceAction[];
  /** Explicit nested agents permitted within the parent execution budget. */
  readonly agentDependencies?: readonly string[];
}
export interface AgentDefinition<A extends AnyAgent = AnyAgent, Output = AgentOutput<A>> extends DefinitionBase {
  /** Discriminant selecting the agent or workflow adapter. */
  readonly kind: 'agent';
  /** Construct the native Mastra resource using only declared dependencies. */
  readonly create: (dependencies: ResourceDependencies) => A;
  /** Execution limits, durable output projection and compatible adapter version. */
  readonly adapter: {
    /** Stable execution contract version; change when executable behavior or schemas change. */
    readonly version: string;
    /** Maximum model steps allowed in one admitted agent call. */
    readonly maxSteps?: number;
    /** Maximum output tokens requested from the model. */
    readonly maxOutputTokens?: number;
    /** Schema for the validated, persistable output projection. */
    readonly outputSchema?: z.ZodType<Output, Output>;
    /** Schema for the trusted prompt supplied to the admitted agent. */
    readonly promptSchema?: z.ZodType<string, string>;
    /** Maximum durable artifact slots available within this billed execution. */
    readonly artifactSlots?: number;
    /** Certify the durable result before billing confirms successful execution. */
    readonly completion?: (scope: ExecutionScope) => Promise<AgentProjection<Output>>;
  };
  /** Release resources created by this factory during shutdown or partial startup failure. */
  readonly dispose?: (native: A) => void | Promise<void>;
}
export interface WorkflowDefinition<W extends AnyWorkflow = AnyWorkflow> extends DefinitionBase {
  /** Discriminant selecting the agent or workflow adapter. */
  readonly kind: 'workflow';
  /** Construct the native Mastra resource using only declared dependencies. */
  readonly create: (dependencies: ResourceDependencies) => W;
  /** Execution limits, durable output projection and compatible adapter version. */
  readonly adapter: {
    /** Stable execution contract version; change when executable behavior or schemas change. */
    readonly version: string;
    /** Maximum durable artifact slots available within this billed execution. */
    readonly artifactSlots?: number;
    /** Certify the durable result before billing confirms successful execution. */
    readonly completion?: (scope: ExecutionScope, output: unknown) => Promise<unknown>;
    /** Choose whether nested calls are measured by the billing facade. */
    readonly measurement?: 'facade-calls' | 'none';
    /** Required nested agent calls per workflow segment, including the segment before suspension. */
    readonly expectedCalls?: readonly number[];
    /** Explicit compatible historical dependency versions for paused runs. */
    readonly legacyAgentDefinitions?: readonly Readonly<Record<string, string>>[];
  };
  /** Release resources created by this factory during shutdown or partial startup failure. */
  readonly dispose?: (native: W) => void | Promise<void>;
}
export type ResourceDefinition = AgentDefinition<any, any> | WorkflowDefinition<any>;
export interface ResourceCatalog<D extends readonly ResourceDefinition[] = readonly ResourceDefinition[]> {
  /** Typed native factories paired with their billing policies and Studio actions. */
  readonly definitions: D;
  /** Optional authenticated reader for private execution artifacts. */
  readonly artifacts?: ArtifactReader;
  /** Commercial plans, logical billing keys and provider selection shared by the definitions. */
  readonly configuration: Omit<BillingConfiguration, 'resourcePolicies'>;
}
export type CatalogAgents<D extends readonly ResourceDefinition[]> = {
  [R in D[number] as R extends { kind: 'agent' } ? R['id'] : never]: R extends AgentDefinition<infer A, any>
    ? AgentResource<R extends { adapter: { outputSchema: z.ZodType<infer Output> } } ? Output : AgentOutput<A>, A>
    : never;
};
export type CatalogWorkflows<D extends readonly ResourceDefinition[]> = {
  [R in D[number] as R extends { kind: 'workflow' } ? R['id'] : never]: R extends WorkflowDefinition<infer W>
    ? WorkflowResource<W>
    : never;
};
const adapterSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('agent'),
    adapter: z.strictObject({
      version: identifierSchema,
      artifactSlots: z.number().int().min(1).max(3).optional(),
      completion: z.custom<Function>(value => typeof value === 'function').optional(),
      maxSteps: z.number().int().min(1).max(32).optional(),
      maxOutputTokens: z.number().int().min(1).max(8192).optional(),
      outputSchema: z
        .custom<z.ZodType>(value => !!value && typeof value === 'object' && 'safeParse' in value)
        .optional(),
      promptSchema: z
        .custom<z.ZodType>(value => !!value && typeof value === 'object' && 'safeParse' in value)
        .optional(),
    }),
  }),
  z.object({
    kind: z.literal('workflow'),
    adapter: z
      .strictObject({
        version: identifierSchema,
        artifactSlots: z.number().int().min(1).max(3).optional(),
        completion: z.custom<Function>(value => typeof value === 'function').optional(),
        measurement: z.enum(['facade-calls', 'none']).optional(),
        expectedCalls: z.array(z.number().int().min(0).max(32)).max(32).optional(),
        legacyAgentDefinitions: z.array(z.record(identifierSchema, identifierSchema)).max(16).optional(),
      })
      .refine(value => value.measurement !== 'facade-calls' || !!value.expectedCalls?.length),
  }),
]);
const graphSchema = z
  .array(
    z.object({
      id: identifierSchema,
      kind: z.enum(['agent', 'workflow']),
      policy: billingPolicySchema,
      measurements: z.array(z.unknown()).max(100),
      create: z.custom<Function>(value => typeof value === 'function'),
      dispose: z.custom<Function>(value => typeof value === 'function').optional(),
      agentDependencies: z.array(identifierSchema).max(100).default([]),
      actions: z
        .array(
          z.object({
            id: z
              .string()
              .min(1)
              .max(128)
              .regex(/^[a-zA-Z0-9-]+$/),
            description: z.string().min(1),
            execute: z.custom<Function>(value => typeof value === 'function'),
            executeValidated: z.custom<Function>(value => typeof value === 'function'),
            inputSchema: z.custom<z.ZodType>(value => !!value && typeof value === 'object' && 'safeParse' in value),
          }),
        )
        .default([]),
    }),
  )
  .max(100)
  .superRefine((definitions, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    const byId = new Map(definitions.map(definition => [definition.id, definition]));
    if (byId.size !== definitions.length) issue('Duplicate resource ID.');
    const actions = [
      'billing-account',
      ...definitions.flatMap(definition => definition.actions.map(action => action.id)),
    ];
    if (new Set(actions).size !== actions.length) issue('Duplicate action ID.');
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) {
        issue('Dependency cycle.');
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      const definition = byId.get(id)!;
      if (new Set(definition.agentDependencies).size !== definition.agentDependencies.length)
        issue('Duplicate dependency.');
      for (const dependency of definition.agentDependencies) {
        const target = byId.get(dependency);
        if (!target || target.kind !== 'agent') issue('Unknown dependency or wrong dependency kind.');
        if (target) visit(dependency);
      }
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of byId.keys()) visit(id);
  });
const adapterPolicySchema = z.array(z.custom<ResourceDefinition>()).superRefine((resources, context) => {
  for (const resource of resources) {
    const charge = resource.policy.charge;
    if (resource.adapter.artifactSlots !== undefined && !prepaid(resource.policy))
      context.addIssue({ code: 'custom', message: 'Artifact slots require a prepaid reservation.' });
    if (
      resource.measurements.some(
        measure => !['tokens', 'input-tokens', 'output-tokens', 'model-calls'].includes(measure.key),
      )
    )
      context.addIssue({ code: 'custom', message: 'Unsupported adapter measurement or charge bound.' });
    if (
      charge.type === 'usage' &&
      ((resource.kind === 'workflow' &&
        (resource.adapter.measurement !== 'facade-calls' || charge.funding === 'prepaid')) ||
        (resource.kind === 'agent' &&
          charge.funding === 'prepaid' &&
          (charge.measure !== 'model-calls' || (resource.adapter.maxSteps ?? 1) > charge.maxUnits)))
    )
      context.addIssue({ code: 'custom', message: 'Unsupported adapter measurement or charge bound.' });
  }
});
export function validateResourceCatalog<D extends readonly ResourceDefinition[]>(
  catalog: ResourceCatalog<D>,
  override?: unknown,
  billingProvider?: BillingProvider,
) {
  if (
    !graphSchema.safeParse(catalog.definitions).success ||
    catalog.definitions.some(resource => !adapterSchema.safeParse(resource).success)
  )
    throw new BillingError('invalid_configuration');
  const resourcePolicies = catalog.definitions.map(({ id, kind, operations, measurements, policy }) => ({
    id,
    kind,
    operations,
    measurements,
    policy,
  }));
  const configuration = validateProviderConfiguration({ ...catalog.configuration, resourcePolicies }, billingProvider);
  if (!adapterPolicySchema.safeParse(catalog.definitions).success) throw new BillingError('invalid_configuration');
  // Full environment overrides may change commercial/provider bindings, never create a second resource/policy source.
  if (override !== undefined) {
    const selected = validateProviderConfiguration(override, billingProvider);
    const canonical = billingConfigurationSchema.parse({ ...selected, resourcePolicies });
    if (JSON.stringify(canonical.resourcePolicies) !== JSON.stringify(selected.resourcePolicies))
      throw new BillingError('invalid_configuration');
    return selected;
  }
  return configuration;
}
export function materializeResources<const D extends readonly ResourceDefinition[]>(
  definitions: D,
  lifecycle: Lifecycle,
) {
  let billing: MastraBilling<CatalogAgents<D>, CatalogWorkflows<D>> | undefined;
  const agents: Record<string, AgentResource<any>> = Object.create(null);
  const workflows: Record<string, WorkflowResource<any>> = Object.create(null);
  for (const definition of definitions) {
    const dependencies: ResourceDependencies = {
      nestedAgent: id => {
        if (!definition.agentDependencies?.includes(id)) throw new BillingError('unsupported');
        return {
          generate: (prompt, slot) => {
            if (!billing) throw new BillingError('state_unavailable');
            return billing.nestedAgent(id as keyof CatalogAgents<D> & string).generate(prompt, { slot });
          },
        };
      },
    };
    if (definition.kind === 'agent') {
      const native = definition.create(dependencies);
      if (definition.dispose) lifecycle.own(() => definition.dispose!(native));
      agents[definition.id] = new AgentResource(native, {
        ...definition.adapter,
        agentDependencies: definition.agentDependencies,
      });
    } else {
      const native = definition.create(dependencies);
      if (definition.dispose) lifecycle.own(() => definition.dispose!(native));
      workflows[definition.id] = workflowResource(native, {
        ...definition.adapter,
        agentDependencies: definition.agentDependencies,
      });
    }
  }
  // The checked discriminant and ID uniqueness above make these the only heterogeneous map assertions.
  const typedAgents = agents as CatalogAgents<D>;
  const typedWorkflows = workflows as CatalogWorkflows<D>;
  return {
    agents: typedAgents,
    workflows: typedWorkflows,
    nativeAgents: Object.fromEntries(Object.entries(agents).map(([id, resource]) => [id, resource.native])) as {
      [R in D[number] as R extends { kind: 'agent' } ? R['id'] : never]: R extends AgentDefinition<infer A, any>
        ? A
        : never;
    },
    nativeWorkflows: Object.fromEntries(Object.entries(workflows).map(([id, resource]) => [id, resource.native])) as {
      [R in D[number] as R extends { kind: 'workflow' } ? R['id'] : never]: R extends WorkflowDefinition<infer W>
        ? W
        : never;
    },
    actions: definitions.flatMap(definition => definition.actions ?? []),
    ready: (runtime: MastraBilling<CatalogAgents<D>, CatalogWorkflows<D>>) => {
      if (billing) throw new BillingError('invalid_configuration');
      billing = runtime;
    },
  };
}
