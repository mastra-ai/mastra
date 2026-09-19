import { z } from 'zod/v4';
import type { Agent } from '../agent/agent';
import type { AgentExecutionOptions } from '../agent/agent.types';
import type { SubAgent } from '../agent/subagent';
import type { AgentStreamOptions } from '../agent/types';
import type { ActorSignal } from '../auth/ee';
import type { Classifier, ClassifierQuestions, ClassifierState } from '../classifier';
import type { MastraScorers } from '../evals';
import { toStandardSchema } from '../schema';
import type { PublicSchema, StandardSchemaWithJSON } from '../schema';
import type { DynamicArgument } from '../types';
import { runAgentEntry, runClassifierEntry, runMappingEntry, runToolEntry } from './entry-executors';
import type { ClassifierStepOutput } from './entry-executors';
import type { ExecuteFunction, ExecuteFunctionParams, Step } from './step';
import type {
  ClassifierStateMapping,
  DefaultEngineType,
  MappingConfig,
  SerializableClassifierStepOptions,
  StepMetadata,
  ToolStep,
} from './types';

// Options that can be passed when wrapping an agent with createStep
// These work for both stream() (v2) and streamLegacy() (v1) methods
export type AgentStepOptions<TOUTPUT> = Omit<
  AgentExecutionOptions<TOUTPUT> & AgentStreamOptions,
  | 'format'
  | 'tracingContext'
  | 'requestContext'
  | 'abortSignal'
  | 'context'
  | 'onStepFinish'
  | 'output'
  | 'experimental_output'
  | 'resourceId'
  | 'threadId'
  | 'scorers'
>;

export function createStepFromAgent<TStepId extends string, TStepOutput>(
  params: SubAgent<TStepId, any> | Agent<TStepId, any, any>,
  agentOrToolOptions?: AgentStepOptions<TStepOutput> & {
    structuredOutput?: { schema: StandardSchemaWithJSON<TStepOutput> };
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
    metadata?: StepMetadata;
  },
): Step<TStepId, unknown, { prompt: string }, TStepOutput, unknown, unknown, DefaultEngineType> {
  const options = (agentOrToolOptions ?? {}) as
    | (AgentStepOptions<TStepOutput> & {
        retries?: number;
        scorers?: DynamicArgument<MastraScorers>;
        metadata?: StepMetadata;
      })
    | undefined;
  // Determine output schema based on structuredOutput option
  const outputSchema = toStandardSchema(
    (options?.structuredOutput?.schema ?? z.object({ text: z.string() })) as PublicSchema<TStepOutput>,
  );
  const { retries, scorers, metadata } =
    options ??
    ({} as AgentStepOptions<TStepOutput> & {
      retries?: number;
      scorers?: DynamicArgument<MastraScorers>;
      metadata?: StepMetadata;
    });

  return {
    id: params.id,
    description: params.getDescription(),
    inputSchema: toStandardSchema(
      z.object({
        prompt: z.string(),
      }),
    ),
    outputSchema,
    retries,
    scorers,
    metadata,
    // The run logic lives in `runAgentEntry` (shared with the engines'
    // declarative-entry dispatch); this closure just binds the live agent.
    execute: async ctx =>
      runAgentEntry({ type: 'agent', id: params.id, agentId: params.id, agent: params, options }, ctx),
    component: 'AGENT',
    // Preserve the declarative inputs so the workflow builder can emit a
    // `{ type: 'agent', agentId, options }` graph entry instead of an opaque step.
    __agentRef: params,
    __agentOptions: agentOrToolOptions,
  } as Step<TStepId, unknown, any, TStepOutput, unknown, unknown, DefaultEngineType>;
}

export type ClassifierStepOptions<TStepInput = unknown> = SerializableClassifierStepOptions & {
  id?: string;
  state?:
    | ClassifierStateMapping
    | ((context: ExecuteFunctionParams<any, TStepInput, any, any, any, DefaultEngineType>) =>
        | ClassifierState
        | Promise<ClassifierState>);
};

export function createStepFromClassifier<QUESTIONS extends ClassifierQuestions, TStepInput = unknown>(
  classifier: Classifier<QUESTIONS>,
  options: ClassifierStepOptions<TStepInput> = {},
): Step<
  string,
  unknown,
  TStepInput,
  ClassifierStepOutput<QUESTIONS>,
  unknown,
  unknown,
  DefaultEngineType
> {
  if (!classifier.questions) {
    throw new TypeError(
      `Classifier '${classifier.id}' must be configured with questions before it can be used as a workflow step.`,
    );
  }

  const id = options.id ?? classifier.id;
  return {
    id,
    inputSchema: toStandardSchema(z.any()),
    outputSchema: toStandardSchema(z.any()),
    retries: options.retries,
    metadata: options.metadata,
    execute: async ctx => {
      return runClassifierEntry<QUESTIONS>(
        {
          type: 'classifier',
          id,
          classifierId: classifier.id,
          classifier,
          state: options.state as any,
          options,
        },
        ctx,
      );
    },
    component: 'CLASSIFIER',
    __classifierRef: classifier,
    __classifierOptions: options,
  } as Step<string, unknown, TStepInput, ClassifierStepOutput<QUESTIONS>, unknown, unknown, DefaultEngineType>;
}

export function createStepFromTool<TStepInput, TSuspend, TResume, TStepOutput>(
  params: ToolStep<TStepInput, TSuspend, TResume, TStepOutput, any>,
  toolOpts?: {
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
    metadata?: StepMetadata;
    /**
     * Overrides the FGA actor for this tool call. Wins over a propagating run
     * actor; pass `undefined` explicitly to drop back to user-actor resolution.
     */
    actor?: ActorSignal;
  },
): Step<string, any, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType> {
  if (!params.inputSchema || !params.outputSchema) {
    throw new Error('Tool must have input and output schemas defined');
  }

  return {
    id: params.id,
    description: params.description,
    inputSchema: params.inputSchema,
    outputSchema: params.outputSchema,
    resumeSchema: params.resumeSchema,
    suspendSchema: params.suspendSchema,
    retries: toolOpts?.retries,
    scorers: toolOpts?.scorers,
    metadata: toolOpts?.metadata,
    // The run logic lives in `runToolEntry` (shared with the engines'
    // declarative-entry dispatch); this closure just binds the live tool.
    execute: async ctx =>
      runToolEntry({ type: 'tool', id: params.id, toolId: params.id, tool: params, options: toolOpts }, ctx),
    component: 'TOOL',
    // Preserve the declarative inputs so the workflow builder can emit a
    // `{ type: 'tool', toolId, options }` graph entry instead of an opaque step.
    __toolRef: params,
    __toolOptions: toolOpts,
  } as Step<string, any, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType>;
}

/**
 * Builds a runnable step from a `.map()` mapping config or mapping function.
 *
 * The interpretation of a `{ type: 'mapping' }` graph entry lives in
 * `runMappingEntry` (shared with the engines' declarative-entry dispatch);
 * this factory just wraps it in a step shell.
 */
export function createMappingStep(
  id: string,
  mappingConfig: MappingConfig | ExecuteFunction<any, any, any, any, any, DefaultEngineType>,
): Step<string, any, any, any, any, any, DefaultEngineType> {
  return {
    id,
    inputSchema: toStandardSchema(z.any()),
    outputSchema: toStandardSchema(z.any()),
    execute: async ctx => runMappingEntry({ type: 'mapping', id, mapConfig: mappingConfig }, ctx),
  } as Step<string, any, any, any, any, any, DefaultEngineType>;
}
