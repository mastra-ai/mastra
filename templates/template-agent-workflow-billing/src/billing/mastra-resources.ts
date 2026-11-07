import { z } from 'zod';
import type { Agent, AgentExecutionOptionsBase } from '@mastra/core/agent';
import type { FullOutput } from '@mastra/core/stream';
import type { AnyWorkflow, Workflow, Step } from '@mastra/core/workflows';
import { BillingError, identifierSchema, parseInput } from './contracts.js';
import { boundedJson, boundedJsonSchema, fingerprint } from './accounting.js';

export type AnyAgent = Agent<string, any, any, any, any>;
export type AgentOutput<A> = A extends Agent<string, any, infer Output, any, any> ? Output : never;
export type WorkflowInput<W> = W extends Workflow<any, any, any, any, infer Input, any, any, any> ? Input : never;
export type WorkflowOutput<W> = W extends Workflow<any, any, any, any, any, infer Output, any, any> ? Output : never;
type WorkflowSteps<W> = W extends Workflow<any, infer Steps, any, any, any, any, any, any> ? Steps[number] : never;
type StepResume<S> = S extends Step<any, any, any, any, infer Resume, any, any, any> ? Resume : never;
export type WorkflowResume<W> = {
  [S in WorkflowSteps<W> as S['id']]: { step: S['id']; resumeData: StepResume<S> };
}[WorkflowSteps<W>['id']];
export type NativeWorkflowResult<W extends AnyWorkflow> = Awaited<
  ReturnType<Awaited<ReturnType<W['createRun']>>['start']>
>;
export type StepCallback = NonNullable<AgentExecutionOptionsBase<unknown>['onStepFinish']>;
export const generateRequestSchema = z.strictObject({
  prompt: z.string().min(1).max(8192),
  idempotencyKey: identifierSchema,
});
export const safeGenerateOptionsSchema = z.strictObject({
  abortSignal: z.instanceof(AbortSignal).optional(),
  onStepFinish: z.custom<StepCallback>(value => typeof value === 'function').optional(),
});
export type SafeGenerateOptions = z.infer<typeof safeGenerateOptionsSchema>;
export interface AgentProjection<Output> {
  readonly text: string;
  readonly finishReason: string;
  readonly object?: Output;
}
export interface WorkflowProjection<Output> {
  readonly executionId: string;
  readonly status:
    | 'created'
    | 'running'
    | 'suspended'
    | 'canceling'
    | 'completed'
    | 'failed'
    | 'canceled'
    | 'uncertain';
  readonly output?: Output;
  readonly suspendedSteps?: readonly string[];
  readonly expiresAt: number | null;
}
const limitsSchema = z.strictObject({
  version: identifierSchema,
  maxSteps: z.number().int().min(1).max(32).default(1),
  maxOutputTokens: z.number().int().min(1).max(8192).default(512),
});

export class AgentResource<Output> {
  readonly limits;
  readonly definition: string;
  constructor(
    readonly native: AnyAgent,
    options: { version: string; maxSteps?: number; maxOutputTokens?: number; outputSchema?: z.ZodType<Output, Output> },
  ) {
    const { outputSchema, ...limits } = options;
    this.limits = Object.freeze(parseInput(limitsSchema, limits));
    this.outputSchema = outputSchema;
    this.definition = `agent:${fingerprint(boundedJson({ id: native.id, limits: this.limits, structured: outputSchema !== undefined, maxProcessorRetries: 0, maxRetries: native.maxRetries ?? 0, selection: Array.isArray(native.model) ? 'fallback' : typeof native.model === 'function' ? 'dynamic' : 'static' }))}`;
  }
  readonly outputSchema: z.ZodType<Output, Output> | undefined;
  get enforceableCallBound() {
    return (
      (this.native.maxRetries ?? 0) === 0 &&
      typeof this.native.model !== 'function' &&
      !Array.isArray(this.native.model)
    );
  }
  async generate(
    prompt: string,
    options: { abortSignal: AbortSignal; onStepFinish: StepCallback },
  ): Promise<FullOutput<Output>> {
    // Only this trusted adapter supplies model settings, persistence and lifecycle options.
    const trusted = {
      ...options,
      maxSteps: this.limits.maxSteps,
      maxProcessorRetries: 0,
      modelSettings: { maxOutputTokens: this.limits.maxOutputTokens, maxRetries: 0 },
    };
    if (this.outputSchema)
      return this.native.generate<z.ZodType<Output, Output>, Output>(prompt, {
        ...trusted,
        structuredOutput: { schema: this.outputSchema },
      });
    return this.native.generate(prompt, trusted);
  }
  private envelope(value: unknown) {
    return parseInput(
      z.strictObject({
        text: z.string().max(8192),
        finishReason: z.string().min(1).max(64),
        object: this.outputSchema ? boundedJsonSchema.optional() : z.never().optional(),
      }),
      boundedJson(value),
    );
  }
  project(result: FullOutput<Output>): AgentProjection<Output> {
    // The configured SDK structured-output parser has already validated/transformed this object.
    const fields = this.envelope({
      text: result.text,
      finishReason: result.finishReason,
      ...(result.object === undefined ? {} : { object: result.object }),
    });
    return {
      text: fields.text,
      finishReason: fields.finishReason,
      ...(result.object === undefined ? {} : { object: result.object }),
    };
  }
  storedProjection(result: FullOutput<Output>) {
    return boundedJson({ definition: this.definition, projection: this.project(result) });
  }
  parseProjection(value: unknown): AgentProjection<Output> {
    const stored = parseInput(
      z.strictObject({ definition: z.literal(this.definition), projection: boundedJsonSchema }),
      value,
    );
    const fields = this.envelope(stored.projection);
    // Only SDK-validated capture writes this persisted envelope. The matching
    // definition and operation fingerprint bind its output type; never rerun transforms on replay.
    return {
      text: fields.text,
      finishReason: fields.finishReason,
      ...(fields.object === undefined ? {} : { object: fields.object as Output }),
    };
  }
}
type AgentLimits = { version: string; maxSteps?: number; maxOutputTokens?: number };
export function agentResource<A extends AnyAgent, Output>(
  agent: A,
  options: AgentLimits & { outputSchema: z.ZodType<Output, Output> },
): AgentResource<Output>;
export function agentResource<A extends AnyAgent>(
  agent: A,
  options: AgentLimits & { outputSchema?: never },
): AgentResource<AgentOutput<A>>;
export function agentResource(agent: AnyAgent, options: AgentLimits & { outputSchema?: z.ZodType<any, any> }) {
  return new AgentResource(agent, options);
}

export class WorkflowResource<W extends AnyWorkflow> {
  readonly version: string;
  readonly measurement: 'facade-calls' | 'none';
  readonly expectedCalls: readonly number[];
  constructor(
    readonly native: W,
    options: { version: string; measurement?: 'facade-calls' | 'none'; expectedCalls?: readonly number[] },
  ) {
    const validated = parseInput(
      z
        .strictObject({
          version: identifierSchema,
          measurement: z.enum(['facade-calls', 'none']).default('none'),
          expectedCalls: z.array(z.number().int().min(0).max(32)).max(32).default([]),
        })
        .refine(value => value.measurement !== 'facade-calls' || value.expectedCalls.length > 0),
      options,
    );
    this.version = validated.version;
    this.measurement = validated.measurement;
    this.expectedCalls = Object.freeze(validated.expectedCalls);
    if (native.options?.autoRestartActiveRuns !== false) throw new BillingError('invalid_configuration');
  }
  async input(value: unknown): Promise<WorkflowInput<W>> {
    if (!this.native.inputSchema) throw new BillingError('invalid_configuration');
    const checked = await this.native.inputSchema['~standard'].validate(value);
    if (checked.issues) throw new BillingError('invalid_input');
    // Forward original JSON so the SDK applies input transforms once.
    return boundedJson(value) as WorkflowInput<W>;
  }
  async output(value: unknown): Promise<WorkflowOutput<W>> {
    if (!this.native.outputSchema) throw new BillingError('invalid_configuration');
    const checked = await this.native.outputSchema['~standard'].validate(value);
    if (checked.issues) throw new BillingError('invalid_input');
    boundedJson(checked.value);
    return checked.value;
  }
  async resumeInput(step: string, value: unknown): Promise<void> {
    const definition = this.native.steps[step];
    if (!definition) throw new BillingError('invalid_input');
    if (definition.resumeSchema) {
      const checked = await definition.resumeSchema['~standard'].validate(value);
      if (checked.issues) throw new BillingError('invalid_input');
      boundedJson(checked.value);
    } else boundedJson(value);
  }
  async parseProjection(value: unknown, definition: string): Promise<WorkflowProjection<WorkflowOutput<W>>> {
    const stored = parseInput(
      z.strictObject({ definition: z.literal(definition), projection: boundedJsonSchema }),
      value,
    );
    const parsed = parseInput(
      z.strictObject({
        executionId: identifierSchema,
        status: z.enum([
          'created',
          'running',
          'suspended',
          'canceling',
          'completed',
          'failed',
          'canceled',
          'uncertain',
        ]),
        output: boundedJsonSchema.optional(),
        suspendedSteps: z.array(identifierSchema).max(100).optional(),
        expiresAt: z.number().int().nonnegative().nullable(),
      }),
      stored.projection,
    );
    const { output, ...projection } = parsed;
    // Output was schema-validated once at capture and is read only under its
    // persisted definition. Reapplying a transforming schema would change replay data.
    return { ...projection, ...(output === undefined ? {} : { output: output as WorkflowOutput<W> }) };
  }
}
export const workflowResource = <W extends AnyWorkflow>(
  workflow: W,
  options: ConstructorParameters<typeof WorkflowResource<W>>[1],
) => new WorkflowResource(workflow, options);
