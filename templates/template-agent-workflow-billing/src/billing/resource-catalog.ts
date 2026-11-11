import { z } from 'zod';
import type { ExecutionScope } from './execution-scope.js';
import type { AgentProjection } from './mastra-resources.js';
import type { ArtifactReader } from './artifacts.js';
import type { AnyWorkflow } from '@mastra/core/workflows';
import type { FullOutput } from '@mastra/core/stream';
import type { BillingContext } from './organizations.js';
import type { BillingHttpGateway, MastraBilling } from './mastra.js';
import { AgentResource, workflowResource } from './mastra-resources.js';
import type { AnyAgent, AgentOutput, WorkflowResource } from './mastra-resources.js';
import { BillingError, identifierSchema } from './contracts.js';
import { billingConfigurationSchema, billingPolicySchema } from './configuration.js';
import type { BillingConfiguration } from './configuration.js';
import { validateProviderConfiguration } from './setup.js';
import { Lifecycle } from './lifecycle.js';

export interface ResourceDependencies {
  nestedAgent(id: string): { generate(prompt: string, slot?: number): Promise<FullOutput<unknown>> };
}
export interface ActionContext {
  execution: BillingHttpGateway;
  selected(workspaceId: string): Promise<BillingContext>;
}
export interface ResourceAction<S extends z.ZodType = z.ZodType<any, any>> {
  readonly id: string;
  readonly description: string;
  readonly inputSchema: S;
  readonly execute: (input: unknown, context: ActionContext) => Promise<unknown>;
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
type ResourceConfiguration = BillingConfiguration['resources'][number];
interface DefinitionBase {
  readonly id: string;
  readonly policy: ResourceConfiguration['policy'];
  readonly operations: ResourceConfiguration['operations'];
  readonly measurements: ResourceConfiguration['measurements'];
  readonly actions?: readonly ResourceAction[];
  readonly agentDependencies?: readonly string[];
}
export interface AgentDefinition<A extends AnyAgent = AnyAgent, Output = AgentOutput<A>> extends DefinitionBase {
  readonly kind: 'agent';
  readonly create: (dependencies: ResourceDependencies) => A;
  readonly adapter: {
    readonly version: string;
    readonly maxSteps?: number;
    readonly maxOutputTokens?: number;
    readonly outputSchema?: z.ZodType<Output, Output>;
    readonly promptSchema?: z.ZodType<string, string>;
    readonly artifactSlots?: number;
    readonly completion?: (scope: ExecutionScope) => Promise<AgentProjection<Output>>;
  };
  readonly dispose?: (native: A) => void | Promise<void>;
}
export interface WorkflowDefinition<W extends AnyWorkflow = AnyWorkflow> extends DefinitionBase {
  readonly kind: 'workflow';
  readonly create: (dependencies: ResourceDependencies) => W;
  readonly adapter: {
    readonly version: string;
    readonly artifactSlots?: number;
    readonly completion?: (scope: ExecutionScope, output: unknown) => Promise<unknown>;
    readonly measurement?: 'facade-calls' | 'none';
    readonly expectedCalls?: readonly number[];
    readonly legacyAgentDefinitions?: readonly Readonly<Record<string, string>>[];
  };
  readonly dispose?: (native: W) => void | Promise<void>;
}
export type ResourceDefinition = AgentDefinition<any, any> | WorkflowDefinition<any>;
export interface ResourceCatalog<D extends readonly ResourceDefinition[] = readonly ResourceDefinition[]> {
  readonly resources: D;
  readonly artifacts?: ArtifactReader;
  readonly configuration: Omit<BillingConfiguration, 'resources'>;
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
) {
  if (
    !graphSchema.safeParse(catalog.resources).success ||
    catalog.resources.some(resource => !adapterSchema.safeParse(resource).success)
  )
    throw new BillingError('invalid_configuration');
  const resources = catalog.resources.map(({ id, kind, operations, measurements, policy }) => ({
    id,
    kind,
    operations,
    measurements,
    policy,
  }));
  const configuration = validateProviderConfiguration({ ...catalog.configuration, resources });
  if (!adapterPolicySchema.safeParse(catalog.resources).success) throw new BillingError('invalid_configuration');
  // Full environment overrides may change commercial/provider bindings, never create a second resource/policy source.
  if (override !== undefined) {
    const selected = validateProviderConfiguration(override);
    const canonical = billingConfigurationSchema.parse({ ...selected, resources });
    if (JSON.stringify(canonical.resources) !== JSON.stringify(selected.resources))
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
        if (!billing) throw new BillingError('state_unavailable');
        if (!definition.agentDependencies?.includes(id)) throw new BillingError('unsupported');
        return {
          generate: (prompt, slot) =>
            billing!.nestedAgent(id as keyof CatalogAgents<D> & string).generate(prompt, { slot }),
        };
      },
    };
    if (definition.kind === 'agent') {
      const native = definition.create(dependencies);
      if (definition.dispose) lifecycle.own(() => definition.dispose!(native));
      agents[definition.id] = new AgentResource(native, definition.adapter);
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
