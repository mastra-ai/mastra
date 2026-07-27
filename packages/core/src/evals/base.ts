import { randomUUID } from 'node:crypto';
import { z } from 'zod/v4';
import { Agent, isSupportedLanguageModel } from '../agent';
import type { MastraDBMessage, MastraMessagePart, MastraToolInvocationPart } from '../agent/message-list';
import type { AgentMemoryOption, ToolsInput } from '../agent/types';
import { tryStreamWithJsonFallback } from '../agent/utils';
import { ErrorCategory, ErrorDomain, getErrorFromUnknown, MastraError } from '../error';
import { resolveModelConfig } from '../llm/model/resolve-model';
import type { MastraModelConfig } from '../llm/model/shared.types';
import { noopLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import {
  createObservabilityContext,
  EntityType,
  getOrCreateSpan,
  InternalSpans,
  resolveObservabilityContext,
  SpanType,
} from '../observability';
import type {
  CorrelationContext,
  DefinitionSource,
  ObservabilityContext,
  ScorerScoreSource,
  ScorerStepType,
  ScorerTargetScope,
  Span,
} from '../observability';
import { executeWithContext } from '../observability/utils';
import type {
  ErrorProcessorOrWorkflow,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '../processors/index';
import { RequestContext } from '../request-context';
import type { PublicSchema } from '../schema';
import { toStandardSchema, standardSchemaToJSONSchema } from '../schema';
import type { JSONValue, LanguageModelUsage, MastraOnFinishCallback } from '../stream';
import type { MastraOnStepFinishCallback } from '../stream/types';
import { createWorkflow } from '../workflows/create';
import { createStep } from '../workflows/workflow';
import type {
  ScoringSamplingConfig,
  ScorerRunInputForAgent,
  ScorerRunOutputForAgent,
  Trajectory,
  TrajectoryExpectation,
} from './types';

interface ScorerStepDefinition {
  name: string;
  definition: any;
  isPromptObject: boolean;
}

// Predefined type shortcuts for common scorer patterns
type ScorerTypeShortcuts = {
  agent: {
    input: ScorerRunInputForAgent;
    output: ScorerRunOutputForAgent;
  };
  trajectory: {
    input: ScorerRunInputForAgent;
    output: Trajectory;
  };
};

/**
 * LLM-as-judge configuration for a scorer (or an individual scorer step).
 *
 * When `tools` is provided, the internal judge agent can call them before
 * producing its score/output — e.g. a goal judge that inspects the workspace
 * with readonly tools to independently verify the agent's claims, rather than
 * grading text alone. Tools run in the judge agent's own tool-call loop and the
 * judge still returns the step's structured output at the end.
 */
export interface ScorerJudgeConfig {
  model: MastraModelConfig;
  instructions: string;
  /**
   * Controls how the judge's structured output schema reaches the model.
   * Defaults to automatic capability-based routing.
   */
  jsonPromptInjection?: boolean | 'system' | 'inline' | 'auto';
  /** Optional tools the judge agent may call while evaluating (e.g. readonly verification tools). */
  tools?: ToolsInput;
  /** Optional memory instance for the internal judge agent. */
  memory?: MastraMemory;
  /** Default memory options passed to the internal judge agent run. */
  defaultMemoryOptions?: AgentMemoryOption;
  /** Optional callback for observing the internal judge agent stream as soon as it starts. */
  onStream?: (stream: Awaited<ReturnType<Agent['stream']>>) => void | Promise<void>;
  /** Optional callback fired after each model step in the internal judge agent. */
  onStepFinish?: MastraOnStepFinishCallback<unknown>;
  /** Optional callback fired when an internal judge agent invocation finishes. */
  onFinish?: MastraOnFinishCallback<unknown>;
  /** Optional maximum number of agentic loop iterations for the internal judge agent. */
  maxSteps?: number;
  /**
   * Optional input processors for the internal judge agent. Run before the judge's
   * messages reach the model (e.g. redaction, validation).
   */
  inputProcessors?: InputProcessorOrWorkflow[];
  /**
   * Optional output processors for the internal judge agent. Run on the judge's
   * output before it is returned (e.g. moderation, transformation).
   */
  outputProcessors?: OutputProcessorOrWorkflow[];
  /**
   * Optional error processors for the internal V2+ judge agent. These implement
   * `processAPIError` and can inspect LLM API rejections and signal a retry,
   * e.g. `StreamErrorRetryProcessor`. V1 judges use `generateLegacy()` and do
   * not run error processors.
   */
  errorProcessors?: ErrorProcessorOrWorkflow[];
  /**
   * Maximum number of times error processors can retry one V2+ judge generation.
   * When errorProcessors are configured and this is omitted, the runtime cap is
   * 10. Set this explicitly to bound the coordinated retry budget.
   */
  maxProcessorRetries?: number;
  /**
   * Optional request context forwarded to the judge agent execution. When the judge
   * agent has memory with OM observers that read dynamic model config from controller
   * state (e.g. mastracode's `getObserverModel`), this lets the OM system resolve the
   * correct observer model and provider credentials.
   */
  requestContext?: RequestContext<any>;
}

/**
 * Step-level fields override scorer-level judge fields. Processor arrays replace
 * the scorer-level arrays; omit maxProcessorRetries to inherit its numeric cap.
 */
export type ScorerStepJudgeConfig = Omit<ScorerJudgeConfig, 'memory' | 'defaultMemoryOptions'> & {
  /** Per-step memory options merged onto scorer-level `judge.defaultMemoryOptions`. */
  memory?: AgentMemoryOption;
};

// Pipeline scorer
// TInput and TRunOutput establish the type contract for the entire scorer pipeline,
// ensuring type safety flows through all steps and contexts
interface ScorerConfig<TID extends string, TInput = any, TRunOutput = any> {
  id: TID;
  name?: string;
  description: string;
  judge?: ScorerJudgeConfig;
  // Optional type specification - can be enum shortcut or explicit schemas
  type?:
    | keyof ScorerTypeShortcuts
    | {
        input: z.ZodSchema<TInput>;
        output: z.ZodSchema<TRunOutput>;
      };

  /**
   * Transform the scorer run data before the SCORER_RUN span is created.
   * Use this to strip unnecessary data from `input` and `output`, reducing
   * what flows into both the scorer pipeline and the observability span.
   *
   * Runs synchronously before any span creation or pipeline execution.
   */
  prepareRun?: (
    run: ScorerRun<TInput, TRunOutput>,
  ) => ScorerRun<TInput, TRunOutput> | Promise<ScorerRun<TInput, TRunOutput>>;
}

// Standardized input type for all scorer runs.
// This captures both the scorer's evaluation inputs and the optional target
// identity/context used for tracing and score emission.
interface ScorerRun<TInput = any, TOutput = any> {
  /** Unique ID for this scorer execution. Generated by scorer.run() when omitted. */
  runId?: string;

  /** Primary scorer input. This is often model input/messages, but can be any structured value. */
  input?: TInput;

  /** Primary scorer target output. This is the required value the scorer evaluates. */
  output: TOutput;

  /** Optional expected label/reference value for judged or supervised evaluations. */
  groundTruth?: any;

  /** Expected trajectory config for trajectory scorers. Flows from dataset items or scorer constructor. */
  expectedTrajectory?: TrajectoryExpectation;

  /** Optional request context forwarded to scorers and judge prompts. */
  requestContext?: Record<string, any> | RequestContext;

  /** What kind of scoring flow produced this score, such as live runs, trace scoring, or experiments. */
  scoreSource?: ScorerScoreSource;

  /**
   * How the scorer interpreted the target data.
   * `span` means a single span's input/output was scored.
   * `trajectory` means a trajectory/path was scored.
   */
  targetScope?: ScorerTargetScope;

  /** Entity type of the scored target when known. */
  targetEntityType?: EntityType;

  /** Trace anchor for the target being scored when available. */
  targetTraceId?: string;

  /** Optional span anchor for the target being scored. */
  targetSpanId?: string;

  /** Live correlation snapshot for the target span/trace when available. */
  targetCorrelationContext?: CorrelationContext;

  /** Live target metadata to merge into emitted score metadata when available. */
  targetMetadata?: Record<string, unknown>;
}

// Prompt object definition with conditional typing
interface PromptObject<
  TOutput,
  TAccumulated extends Record<string, any>,
  TStepName extends string = string,
  TInput = any,
  TRunOutput = any,
> {
  description: string;
  /**
   * Schema defining the expected output structure.
   * Accepts any schema type supported by Mastra (Zod v4, JSON Schema, AI SDK Schema, or StandardSchema).
   * Will be converted to StandardSchemaWithJSON at runtime via toStandardSchema().
   *
   * The TOutput generic is inferred from this schema's output type.
   */
  outputSchema: PublicSchema<TOutput>;
  judge?: ScorerStepJudgeConfig;

  // Support both sync and async createPrompt
  createPrompt: (context: PromptObjectContext<TAccumulated, TStepName, TInput, TRunOutput>) => string | Promise<string>;
}

// Helper types
type StepResultKey<T extends string> = `${T}StepResult`;

// Simple utility type to extract resolved types from potentially async functions
type Awaited<T> = T extends Promise<infer U> ? U : T;

// Simplified context type
type StepContext<TAccumulated extends Record<string, any>, TInput, TRunOutput> = Partial<ObservabilityContext> & {
  run: ScorerRun<TInput, TRunOutput>;
  results: TAccumulated;
};

// Simplified AccumulatedResults - don't try to resolve Promise types here
type AccumulatedResults<T extends Record<string, any>, K extends string, V> = T & Record<StepResultKey<K>, V>;

// Special context type for generateReason that includes the score
type GenerateReasonContext<TAccumulated extends Record<string, any>, TInput, TRunOutput> = StepContext<
  TAccumulated,
  TInput,
  TRunOutput
> & {
  score: TAccumulated extends Record<'generateScoreStepResult', infer TScore> ? TScore : never;
};

export type ScorerJudgeStepName = 'preprocess' | 'analyze' | 'generateScore' | 'generateReason';

export interface ScorerJudgeUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
}

export interface ScorerJudgeCost {
  amount: number;
  unit: string;
  source: string;
}

export interface ScorerJudgeExecution {
  prompt: string;
  output: JSONValue;
  judgeModelId: string;
  judgeProvider?: string;
  usage: ScorerJudgeUsage;
  attemptCount: number;
  modelCallCount: number;
  durationMs: number;
  cost?: ScorerJudgeCost;
}

export interface ScorerJudgeStepResult {
  executions: ScorerJudgeExecution[];
}

export type ScorerJudgeResults = Partial<Record<ScorerJudgeStepName, ScorerJudgeStepResult>>;

export type ScorerRunResult<
  TAccumulatedResults extends Record<string, any> = Record<string, any>,
  TInput = any,
  TRunOutput = any,
> = ScorerRun<TInput, TRunOutput> & {
  scoreTraceId?: string;
  score: TAccumulatedResults extends Record<'generateScoreStepResult', infer TScore> ? TScore : never;
  reason?: TAccumulatedResults extends Record<'generateReasonStepResult', infer TReason> ? TReason : undefined;

  // Prompts
  preprocessPrompt?: string;
  analyzePrompt?: string;
  generateScorePrompt?: string;
  generateReasonPrompt?: string;

  // Results
  preprocessStepResult?: TAccumulatedResults extends Record<'preprocessStepResult', infer TPreprocess>
    ? TPreprocess
    : undefined;
  analyzeStepResult?: TAccumulatedResults extends Record<'analyzeStepResult', infer TAnalyze> ? TAnalyze : undefined;

  judge?: ScorerJudgeResults;
} & { runId: string };

const jsonValueSchema: z.ZodType<JSONValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number(),
    z.boolean(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const scorerJudgeUsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  reasoningTokens: z.number().optional(),
  cachedInputTokens: z.number().optional(),
  cacheCreationInputTokens: z.number().optional(),
});

const scorerJudgeExecutionSchema = z.object({
  prompt: z.string(),
  output: jsonValueSchema,
  judgeModelId: z.string(),
  judgeProvider: z.string().optional(),
  usage: scorerJudgeUsageSchema,
  attemptCount: z.number().int().positive(),
  modelCallCount: z.number().int().positive(),
  durationMs: z.number().int().nonnegative(),
  cost: z
    .object({
      amount: z.number(),
      unit: z.string(),
      source: z.string(),
    })
    .optional(),
});

const scorerJudgeStepResultSchema = z.object({
  executions: z.array(scorerJudgeExecutionSchema),
});

const scorerJudgeResultsSchema = z.object({
  preprocess: scorerJudgeStepResultSchema.optional(),
  analyze: scorerJudgeStepResultSchema.optional(),
  generateScore: scorerJudgeStepResultSchema.optional(),
  generateReason: scorerJudgeStepResultSchema.optional(),
});

const scorerJudgeUsageKeys = [
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'reasoningTokens',
  'cachedInputTokens',
  'cacheCreationInputTokens',
] as const satisfies readonly (keyof ScorerJudgeUsage)[];

function normalizeScorerJudgeUsage(usage: unknown): ScorerJudgeUsage {
  if (!usage || typeof usage !== 'object') {
    return {};
  }

  const usageRecord = usage as Record<string, unknown>;
  const inputTokens = usageRecord.inputTokens ?? usageRecord.promptTokens;
  const outputTokens = usageRecord.outputTokens ?? usageRecord.completionTokens;
  const totalTokens =
    usageRecord.totalTokens ??
    (typeof inputTokens === 'number' || typeof outputTokens === 'number'
      ? (typeof inputTokens === 'number' ? inputTokens : 0) + (typeof outputTokens === 'number' ? outputTokens : 0)
      : undefined);

  return {
    ...(typeof inputTokens === 'number' ? { inputTokens } : {}),
    ...(typeof outputTokens === 'number' ? { outputTokens } : {}),
    ...(typeof totalTokens === 'number' ? { totalTokens } : {}),
    ...(typeof usageRecord.reasoningTokens === 'number' ? { reasoningTokens: usageRecord.reasoningTokens } : {}),
    ...(typeof usageRecord.cachedInputTokens === 'number' ? { cachedInputTokens: usageRecord.cachedInputTokens } : {}),
    ...(typeof usageRecord.cacheCreationInputTokens === 'number'
      ? { cacheCreationInputTokens: usageRecord.cacheCreationInputTokens }
      : {}),
  };
}

function addScorerJudgeUsage(accumulated: ScorerJudgeUsage, usage: ScorerJudgeUsage): void {
  for (const key of scorerJudgeUsageKeys) {
    const value = usage[key];
    if (value !== undefined) {
      accumulated[key] = (accumulated[key] ?? 0) + value;
    }
  }
}

interface ScorerJudgeTelemetryAccumulator {
  usage: ScorerJudgeUsage;
  attemptCount: number;
  modelCallCount: number;
  judgeModelId?: string;
  judgeProvider?: string;
}

// Conditional type for PromptObject context
type PromptObjectContext<
  TAccumulated extends Record<string, any>,
  TStepName extends string,
  TInput,
  TRunOutput,
> = TStepName extends 'generateReason'
  ? GenerateReasonContext<TAccumulated, TInput, TRunOutput>
  : StepContext<TAccumulated, TInput, TRunOutput>;

// Function step types that support both sync and async
type FunctionStep<TAccumulated extends Record<string, any>, TInput, TRunOutput, TOutput> =
  | ((context: StepContext<TAccumulated, TInput, TRunOutput>) => TOutput)
  | ((context: StepContext<TAccumulated, TInput, TRunOutput>) => Promise<TOutput>);

type GenerateReasonFunctionStep<TAccumulated extends Record<string, any>, TInput, TRunOutput> =
  | ((context: GenerateReasonContext<TAccumulated, TInput, TRunOutput>) => any)
  | ((context: GenerateReasonContext<TAccumulated, TInput, TRunOutput>) => Promise<any>);

type GenerateScoreFunctionStep<TAccumulated extends Record<string, any>, TInput, TRunOutput> =
  | ((context: StepContext<TAccumulated, TInput, TRunOutput>) => number)
  | ((context: StepContext<TAccumulated, TInput, TRunOutput>) => Promise<number>);

// Special prompt object type for generateScore that always returns a number
interface GenerateScorePromptObject<TAccumulated extends Record<string, any>, TInput, TRunOutput> {
  description: string;
  judge?: ScorerStepJudgeConfig;
  // Support both sync and async createPrompt
  createPrompt: (context: StepContext<TAccumulated, TInput, TRunOutput>) => string | Promise<string>;
}

// Special prompt object type for generateReason that always returns a string
interface GenerateReasonPromptObject<TAccumulated extends Record<string, any>, TInput, TRunOutput> {
  description: string;
  judge?: ScorerStepJudgeConfig;
  // Support both sync and async createPrompt
  createPrompt: (context: GenerateReasonContext<TAccumulated, TInput, TRunOutput>) => string | Promise<string>;
}

// Step definition types that support both function and prompt object steps
type PreprocessStepDef<TAccumulated extends Record<string, any>, TStepOutput, TInput, TRunOutput> =
  | FunctionStep<TAccumulated, TInput, TRunOutput, TStepOutput>
  | (PromptObject<TStepOutput, TAccumulated, 'preprocess', TInput, TRunOutput> & {
      outputSchema: PublicSchema<TStepOutput>;
    });

type AnalyzeStepDef<TAccumulated extends Record<string, any>, TStepOutput, TInput, TRunOutput> =
  | FunctionStep<TAccumulated, TInput, TRunOutput, TStepOutput>
  | (PromptObject<TStepOutput, TAccumulated, 'analyze', TInput, TRunOutput> & {
      outputSchema: PublicSchema<TStepOutput>;
    });

// Conditional type for generateScore step definition
type GenerateScoreStepDef<TAccumulated extends Record<string, any>, TInput, TRunOutput> =
  | GenerateScoreFunctionStep<TAccumulated, TInput, TRunOutput>
  | GenerateScorePromptObject<TAccumulated, TInput, TRunOutput>;

// Conditional type for generateReason step definition
type GenerateReasonStepDef<TAccumulated extends Record<string, any>, TInput, TRunOutput> =
  | GenerateReasonFunctionStep<TAccumulated, TInput, TRunOutput>
  | GenerateReasonPromptObject<TAccumulated, TInput, TRunOutput>;

class MastraScorer<
  TID extends string = string,
  TInput = any,
  TRunOutput = any,
  TAccumulatedResults extends Record<string, any> = {},
> {
  #mastra?: Mastra;
  #rawConfig?: Record<string, unknown>;

  /**
   * Tracks whether this scorer was defined in code or loaded from storage.
   * Set by `Mastra.addScorer()` when the `source` option is provided.
   */
  public source?: DefinitionSource;

  constructor(
    public config: ScorerConfig<TID, TInput, TRunOutput>,
    private steps: Array<ScorerStepDefinition> = [],
    private originalPromptObjects: Map<
      string,
      | PromptObject<any, any, any, TInput, TRunOutput>
      | GenerateReasonPromptObject<any, TInput, TRunOutput>
      | GenerateScorePromptObject<any, TInput, TRunOutput>
    > = new Map(),
    mastra?: Mastra,
  ) {
    this.#mastra = mastra;
    if (!this.config.id) {
      throw new MastraError({
        id: 'MASTR_SCORER_FAILED_TO_CREATE_MISSING_ID',
        domain: ErrorDomain.SCORER,
        category: ErrorCategory.USER,
        text: `Scorers must have an ID field. Please provide an ID in the scorer config.`,
      });
    }
  }

  /**
   * Registers the Mastra instance with the scorer.
   * This enables access to custom gateways for model resolution.
   * @internal
   */
  __registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }

  /**
   * Returns the raw storage configuration this scorer was created from,
   * or undefined if it was created from code.
   */
  toRawConfig(): Record<string, unknown> | undefined {
    return this.#rawConfig;
  }

  /**
   * Sets the raw storage configuration for this scorer.
   * @internal
   */
  __setRawConfig(rawConfig: Record<string, unknown>): void {
    this.#rawConfig = rawConfig;
  }

  get type() {
    return this.config.type;
  }

  get id(): TID {
    return this.config.id;
  }

  get name(): string {
    return this.config.name ?? this.config.id;
  }

  get description(): string {
    return this.config.description;
  }

  get judge() {
    return this.config.judge;
  }

  preprocess<TPreprocessOutput>(
    stepDef: PreprocessStepDef<TAccumulatedResults, TPreprocessOutput, TInput, TRunOutput>,
  ): MastraScorer<
    TID,
    TInput,
    TRunOutput,
    AccumulatedResults<TAccumulatedResults, 'preprocess', Awaited<TPreprocessOutput>>
  > {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as PromptObject<
        TPreprocessOutput,
        TAccumulatedResults,
        'preprocess',
        TInput,
        TRunOutput
      >;
      this.originalPromptObjects.set('preprocess', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'preprocess',
          definition: stepDef as FunctionStep<any, TInput, TRunOutput, TPreprocessOutput>,
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
      this.#mastra,
    );
  }

  analyze<TAnalyzeOutput>(
    stepDef: AnalyzeStepDef<TAccumulatedResults, TAnalyzeOutput, TInput, TRunOutput>,
  ): MastraScorer<
    TID,
    TInput,
    TRunOutput,
    AccumulatedResults<TAccumulatedResults, 'analyze', Awaited<TAnalyzeOutput>>
  > {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as PromptObject<TAnalyzeOutput, TAccumulatedResults, 'analyze', TInput, TRunOutput>;
      this.originalPromptObjects.set('analyze', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'analyze',
          definition: isPromptObj ? undefined : (stepDef as FunctionStep<any, TInput, TRunOutput, TAnalyzeOutput>),
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
      this.#mastra,
    );
  }

  generateScore<TScoreOutput extends number = number>(
    stepDef: GenerateScoreStepDef<TAccumulatedResults, TInput, TRunOutput>,
  ): MastraScorer<
    TID,
    TInput,
    TRunOutput,
    AccumulatedResults<TAccumulatedResults, 'generateScore', Awaited<TScoreOutput>>
  > {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as GenerateScorePromptObject<TAccumulatedResults, TInput, TRunOutput>;
      this.originalPromptObjects.set('generateScore', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'generateScore',
          definition: isPromptObj ? undefined : (stepDef as GenerateScoreFunctionStep<any, TInput, TRunOutput>),
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
      this.#mastra,
    );
  }

  generateReason<TReasonOutput = string>(
    stepDef: GenerateReasonStepDef<TAccumulatedResults, TInput, TRunOutput>,
  ): MastraScorer<
    TID,
    TInput,
    TRunOutput,
    AccumulatedResults<TAccumulatedResults, 'generateReason', Awaited<TReasonOutput>>
  > {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as GenerateReasonPromptObject<TAccumulatedResults, TInput, TRunOutput>;
      this.originalPromptObjects.set('generateReason', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'generateReason',
          definition: isPromptObj ? undefined : (stepDef as GenerateReasonFunctionStep<any, TInput, TRunOutput>),
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
      this.#mastra,
    );
  }

  private get hasGenerateScore(): boolean {
    return this.steps.some(step => step.name === 'generateScore');
  }

  private normalizeRunRequestContext(
    requestContext?: Record<string, any> | RequestContext,
  ): RequestContext | undefined {
    if (!requestContext) {
      return undefined;
    }

    if (requestContext instanceof RequestContext) {
      return requestContext;
    }

    return new RequestContext(Object.entries(requestContext));
  }

  async run(input: ScorerRun<TInput, TRunOutput>): Promise<ScorerRunResult<TAccumulatedResults, TInput, TRunOutput>> {
    // Runtime check: execute only allowed after generateScore
    if (!this.hasGenerateScore) {
      throw new MastraError({
        id: 'MASTR_SCORER_FAILED_TO_RUN_MISSING_GENERATE_SCORE',
        domain: ErrorDomain.SCORER,
        category: ErrorCategory.USER,
        text: `Cannot execute pipeline without generateScore() step`,
        details: {
          scorerId: this.config.id ?? this.config.name,
          steps: this.steps.map(s => s.name).join(', '),
        },
      });
    }

    // Apply prepareRun transformation before span creation to reduce data
    // flowing into both the observability span and the scorer pipeline.
    const prepared = this.config.prepareRun ? await this.config.prepareRun(input) : input;

    let runId = prepared.runId;
    if (!runId) {
      runId = randomUUID();
    }

    const normalizedRequestContext = this.normalizeRunRequestContext(prepared.requestContext);
    const evalSpan = getOrCreateSpan({
      type: SpanType.SCORER_RUN,
      name: `scorer run: '${this.id}'`,
      entityType: EntityType.SCORER,
      entityId: this.id,
      input: {
        input: prepared.input,
        output: prepared.output,
        groundTruth: prepared.groundTruth,
        expectedTrajectory: prepared.expectedTrajectory,
        requestContext: normalizedRequestContext?.serializeForSpan(),
      },
      attributes: {
        scorerId: this.id,
        scorerName: this.name,
        ...(prepared.scoreSource ? { scoreSource: prepared.scoreSource } : {}),
        ...(prepared.targetScope ? { targetScope: prepared.targetScope } : {}),
        ...(prepared.targetEntityType ? { targetEntityType: prepared.targetEntityType } : {}),
        ...(this.source ? { scorerDefinition: this.source } : {}),
      },
      metadata: {
        ...(prepared.targetTraceId ? { targetTraceId: prepared.targetTraceId } : {}),
        ...(prepared.targetSpanId ? { targetSpanId: prepared.targetSpanId } : {}),
      },
      mastra: this.#mastra,
    });
    const run: ScorerRun<TInput, TRunOutput> & { runId: string; scoreTraceId?: string } = {
      ...prepared,
      runId,
      ...(evalSpan?.traceId ? { scoreTraceId: evalSpan.traceId } : {}),
    };
    const scorerObservabilityContext = createObservabilityContext({ currentSpan: evalSpan });

    let workflow;
    let workflowRun;
    try {
      workflow = this.toMastraWorkflow();
      workflowRun = await workflow.createRun();
    } catch (error) {
      evalSpan?.error({ error: error as Error, endSpan: true });
      throw error;
    }
    let workflowResult;
    try {
      workflowResult = await executeWithContext({
        span: evalSpan,
        fn: () =>
          workflowRun.start({
            inputData: {
              run,
            },
            ...scorerObservabilityContext,
          }),
      });
    } catch (error) {
      evalSpan?.error({ error: error as Error, endSpan: true });
      throw error;
    }

    if (workflowResult.status === 'failed') {
      const workflowFailure = getErrorFromUnknown(workflowResult.error, {
        fallbackMessage: 'Scorer workflow failed',
      });
      evalSpan?.error({ error: workflowFailure, endSpan: true });
      throw new MastraError(
        {
          id: 'MASTR_SCORER_FAILED_TO_RUN_WORKFLOW_FAILED',
          domain: ErrorDomain.SCORER,
          category: ErrorCategory.USER,
          text: `Scorer Run Failed: ${workflowFailure.message}`,
          details: {
            scorerId: this.config.id ?? this.config.name,
            steps: this.steps.map(s => s.name).join(', '),
          },
        },
        workflowFailure,
      );
    }

    const scorerResult = this.transformToScorerResult({ workflowResult, originalInput: run });
    evalSpan?.end({
      output: {
        success: true,
        score: typeof scorerResult.score === 'number' ? scorerResult.score : null,
        reason: typeof scorerResult.reason === 'string' ? scorerResult.reason : null,
      },
    });

    if (this.#mastra?.observability.addScore && typeof scorerResult.score === 'number') {
      try {
        const targetTraceId = input.targetTraceId ?? input.targetCorrelationContext?.traceId;
        const targetSpanId = input.targetSpanId ?? input.targetCorrelationContext?.spanId;

        await this.#mastra.observability.addScore({
          ...(targetTraceId ? { traceId: targetTraceId } : {}),
          ...(targetSpanId ? { spanId: targetSpanId } : {}),
          ...(input.targetCorrelationContext ? { correlationContext: input.targetCorrelationContext } : {}),
          score: {
            scorerId: this.id,
            scorerName: this.name,
            ...(input.scoreSource ? { scoreSource: input.scoreSource } : {}),
            score: scorerResult.score,
            ...(typeof scorerResult.reason === 'string' ? { reason: scorerResult.reason } : {}),
            ...(typeof scorerResult.scoreTraceId === 'string' ? { scoreTraceId: scorerResult.scoreTraceId } : {}),
            ...(input.targetEntityType ? { targetEntityType: input.targetEntityType } : {}),
            metadata: {
              ...(input.targetMetadata ?? {}),
              hasGroundTruth: input.groundTruth !== undefined,
              ...(input.targetScope ? { targetScope: input.targetScope } : {}),
              ...(this.source ? { scorerDefinition: this.source } : {}),
            },
            // TODO: Add targetEntityId / targetEntityName once the score event/storage
            // contract has first-class fields for unanchored score target identity.
            // TODO: Add any remaining correlation context that is useful when a
            // score is emitted without a target trace/span anchor.
          },
        });
      } catch (error) {
        this.#mastra.getLogger()?.warn?.(`Failed to emit score to observability for scorer ${this.id}:`, error);
      }
    }

    return scorerResult;
  }

  private isPromptObject(stepDef: any): boolean {
    // Check if it's a generateScore prompt object (has description and createPrompt, but no outputSchema)
    if (
      typeof stepDef === 'object' &&
      'description' in stepDef &&
      'createPrompt' in stepDef &&
      !('outputSchema' in stepDef)
    ) {
      return true;
    }

    // For other steps, check for description, outputSchema, and createPrompt
    const isOtherPromptObject =
      typeof stepDef === 'object' && 'description' in stepDef && 'outputSchema' in stepDef && 'createPrompt' in stepDef;

    return isOtherPromptObject;
  }

  getSteps(): Array<{ name: string; type: ScorerStepType; description?: string }> {
    return this.steps.map(step => {
      const description = step.isPromptObject
        ? this.originalPromptObjects.get(step.name)?.description
        : step.definition?.description;

      return {
        name: step.name,
        type: step.isPromptObject ? 'prompt' : 'function',
        description,
      };
    });
  }

  private toMastraWorkflow() {
    // Convert each scorer step to a workflow step
    const workflowSteps = this.steps.map(scorerStep => {
      return createStep({
        id: scorerStep.name,
        description: `Scorer step: ${scorerStep.name}`,
        inputSchema: z.any(),
        outputSchema: z.any(),
        execute: async ({ inputData, getInitData, ...rest }) => {
          const observabilityContext = resolveObservabilityContext(rest);
          const { accumulatedResults = {}, generatedPrompts = {}, judge } = inputData;
          const { run } = getInitData<{ run: ScorerRun<TInput, TRunOutput> }>();

          const context = this.createScorerContext(scorerStep.name, run, accumulatedResults);
          const currentSpan = observabilityContext.tracingContext.currentSpan;
          const scorerRunSpan =
            currentSpan?.type === SpanType.SCORER_RUN
              ? (currentSpan as Span<SpanType.SCORER_RUN>)
              : (currentSpan?.findParent(SpanType.SCORER_RUN) as Span<SpanType.SCORER_RUN> | undefined);
          const stepSpan = scorerRunSpan?.createChildSpan({
            type: SpanType.SCORER_STEP,
            name: `scorer step: '${scorerStep.name}'`,
            entityType: EntityType.SCORER,
            entityId: this.config.id ?? this.config.name,
            input: context,
            attributes: {
              step: scorerStep.name,
              stepType: scorerStep.isPromptObject ? 'prompt' : 'function',
            },
          });
          const stepObservabilityContext = createObservabilityContext({ currentSpan: stepSpan });
          const executionContext = {
            ...context,
            ...stepObservabilityContext,
          };

          let stepResult: unknown;
          let prompt: string | undefined;
          let judgeModel: string | undefined;
          let judgeExecution: ScorerJudgeExecution | undefined;

          try {
            await executeWithContext({
              span: stepSpan,
              fn: async () => {
                if (scorerStep.isPromptObject) {
                  const promptStepResult = await this.executePromptStep(
                    scorerStep,
                    stepObservabilityContext,
                    executionContext,
                  );
                  stepResult = promptStepResult.result;
                  prompt = promptStepResult.prompt;
                  judgeModel = promptStepResult.judgeModel;
                  judgeExecution = promptStepResult.execution;
                } else {
                  stepResult = await this.executeFunctionStep(scorerStep, executionContext);
                }
              },
            });
          } catch (error) {
            stepSpan?.error({ error: error as Error, endSpan: true });
            throw error;
          }

          if (prompt !== undefined || judgeModel !== undefined) {
            stepSpan?.update({
              attributes: {
                ...(prompt !== undefined ? { prompt } : {}),
                ...(judgeModel !== undefined ? { judgeModel } : {}),
              },
            });
          }

          stepSpan?.end({ output: stepResult });

          const newGeneratedPrompts =
            prompt !== undefined
              ? {
                  ...generatedPrompts,
                  [`${scorerStep.name}Prompt`]: prompt,
                }
              : generatedPrompts;

          const newAccumulatedResults = {
            ...accumulatedResults,
            [`${scorerStep.name}StepResult`]: stepResult,
          };
          const judgeStepName = scorerStep.name as ScorerJudgeStepName;
          const newJudge = judgeExecution
            ? {
                ...(judge ?? {}),
                [judgeStepName]: {
                  executions: [...(judge?.[judgeStepName]?.executions ?? []), judgeExecution],
                },
              }
            : judge;

          return {
            stepResult,
            accumulatedResults: newAccumulatedResults,
            generatedPrompts: newGeneratedPrompts,
            ...(newJudge ? { judge: newJudge } : {}),
          };
        },
      });
    });

    const workflow = createWorkflow({
      id: `scorer-${this.config.id ?? this.config.name}`,
      description: this.config.description,
      inputSchema: z.object({
        run: z.any(), // ScorerRun
      }),
      outputSchema: z.object({
        run: z.any(),
        score: z.number(),
        reason: z.string().optional(),
        preprocessResult: z.any().optional(),
        analyzeResult: z.any().optional(),
        preprocessPrompt: z.string().optional(),
        analyzePrompt: z.string().optional(),
        generateScorePrompt: z.string().optional(),
        generateReasonPrompt: z.string().optional(),
        judge: scorerJudgeResultsSchema.optional(),
      }),
      options: {
        validateInputs: false,
        // The scorer pipeline is mastra-owned plumbing — only the SCORER_RUN
        // span (created in run()) is user-facing. Mark all workflow spans as
        // internal so they're hidden from exported traces by default. Any
        // user-defined agents/tools/models invoked from a scorer step keep
        // their own tracing policy and stay visible.
        tracingPolicy: {
          internal: InternalSpans.WORKFLOW,
        },
      },
    });

    // update logger
    workflow.__setLogger(this.#mastra?.getLogger() ?? noopLogger);

    let chainedWorkflow = workflow;
    for (const step of workflowSteps) {
      chainedWorkflow = chainedWorkflow.then(step);
    }

    return chainedWorkflow.commit();
  }

  private createScorerContext(
    stepName: string,
    run: ScorerRun<TInput, TRunOutput>,
    accumulatedResults: Record<string, any>,
  ) {
    if (stepName === 'generateReason') {
      const score = accumulatedResults.generateScoreStepResult;
      return { run, results: accumulatedResults, score };
    }

    return { run, results: accumulatedResults };
  }

  private async executeFunctionStep(scorerStep: ScorerStepDefinition, context: any) {
    return await scorerStep.definition(context);
  }

  private async executePromptStep(
    scorerStep: ScorerStepDefinition,
    observabilityContext: ObservabilityContext,
    context: any,
  ): Promise<{ result: unknown; prompt: string; judgeModel?: string; execution: ScorerJudgeExecution }> {
    const startedAt = performance.now();
    const originalStep = this.originalPromptObjects.get(scorerStep.name);
    if (!originalStep) {
      throw new Error(`Step "${scorerStep.name}" is not a prompt object`);
    }

    const prompt = await originalStep.createPrompt(context);
    const modelConfig = originalStep.judge?.model ?? this.config.judge?.model;
    const instructions = originalStep.judge?.instructions ?? this.config.judge?.instructions;
    const jsonPromptInjection =
      originalStep.judge?.jsonPromptInjection ?? this.config.judge?.jsonPromptInjection ?? 'auto';
    // Step-level tools override scorer-level tools. When present, the judge agent
    // can call them (in its own tool-call loop) before producing the step output.
    const tools = originalStep.judge?.tools ?? this.config.judge?.tools;
    const memory = this.config.judge?.memory;
    const defaultMemoryOptions = this.config.judge?.defaultMemoryOptions;
    const stepMemoryOptions = originalStep.judge?.memory;
    const onStream = originalStep.judge?.onStream ?? this.config.judge?.onStream;
    const onStepFinish = originalStep.judge?.onStepFinish ?? this.config.judge?.onStepFinish;
    const onFinish = originalStep.judge?.onFinish ?? this.config.judge?.onFinish;
    const maxSteps = originalStep.judge?.maxSteps ?? this.config.judge?.maxSteps;
    const inputProcessors = originalStep.judge?.inputProcessors ?? this.config.judge?.inputProcessors;
    const outputProcessors = originalStep.judge?.outputProcessors ?? this.config.judge?.outputProcessors;
    const errorProcessors = originalStep.judge?.errorProcessors ?? this.config.judge?.errorProcessors;
    const maxProcessorRetries = originalStep.judge?.maxProcessorRetries ?? this.config.judge?.maxProcessorRetries;
    const memoryOptions = stepMemoryOptions
      ? {
          ...defaultMemoryOptions,
          ...stepMemoryOptions,
          options:
            defaultMemoryOptions?.options || stepMemoryOptions.options
              ? { ...defaultMemoryOptions?.options, ...stepMemoryOptions.options }
              : undefined,
        }
      : defaultMemoryOptions;

    if (!modelConfig || !instructions) {
      throw new MastraError({
        id: 'MASTR_SCORER_FAILED_TO_RUN_MISSING_MODEL_OR_INSTRUCTIONS',
        domain: ErrorDomain.SCORER,
        category: ErrorCategory.USER,
        text: `Step "${scorerStep.name}" requires a model and instructions`,
        details: {
          scorerId: this.config.id ?? this.config.name,
          step: scorerStep.name,
        },
      });
    }

    // Resolve the model configuration to a LanguageModel instance
    // Pass the Mastra instance to enable custom gateway resolution
    const resolvedModel = await resolveModelConfig(
      modelConfig,
      this.config.judge?.requestContext ?? undefined,
      this.#mastra,
    );
    const judgeModel = resolvedModel.modelId;
    const telemetry: ScorerJudgeTelemetryAccumulator = {
      usage: {},
      attemptCount: 0,
      modelCallCount: 0,
      judgeModelId: judgeModel,
      judgeProvider: resolvedModel.provider,
    };
    let pendingStepUsage: ScorerJudgeUsage = {};
    let pendingStepCount = 0;
    let completedOnFinishCount = 0;
    const recordCurrentUsage = (usage: LanguageModelUsage) => {
      addScorerJudgeUsage(telemetry.usage, normalizeScorerJudgeUsage(usage));
    };
    const recordStreamResult = async (result: Awaited<ReturnType<Agent['stream']>>) => {
      if (typeof result.consumeStream === 'function') {
        await result.consumeStream();
      }
      const [totalUsageResult, stepsResult] = await Promise.allSettled([result.totalUsage, result.steps]);
      const totalUsage = totalUsageResult.status === 'fulfilled' ? totalUsageResult.value : undefined;
      const steps = stepsResult.status === 'fulfilled' && Array.isArray(stepsResult.value) ? stepsResult.value : [];

      telemetry.attemptCount += 1;
      telemetry.modelCallCount += Math.max(steps.length, pendingStepCount, 1);
      if (totalUsage) {
        recordCurrentUsage(totalUsage);
      } else {
        addScorerJudgeUsage(telemetry.usage, pendingStepUsage);
      }

      if (completedOnFinishCount < telemetry.attemptCount) {
        const lastStep = steps.at(-1);
        const finishEvent = {
          ...(lastStep ?? {}),
          steps,
          totalUsage: totalUsage ?? pendingStepUsage,
          model: {
            modelId: telemetry.judgeModelId ?? judgeModel,
            provider: telemetry.judgeProvider,
          },
        } as Parameters<MastraOnFinishCallback<unknown>>[0];
        completedOnFinishCount += 1;
        await onFinish?.(finishEvent);
      }

      pendingStepUsage = {};
      pendingStepCount = 0;
    };
    const recordLegacyUsage = (usage: unknown, steps: unknown) => {
      telemetry.attemptCount += 1;
      telemetry.modelCallCount += Array.isArray(steps) ? Math.max(steps.length, 1) : 1;
      addScorerJudgeUsage(telemetry.usage, normalizeScorerJudgeUsage(usage));
    };
    const createExecution = (output: JSONValue): ScorerJudgeExecution => ({
      prompt,
      output,
      judgeModelId: telemetry.judgeModelId ?? judgeModel,
      ...(telemetry.judgeProvider ? { judgeProvider: telemetry.judgeProvider } : {}),
      usage: telemetry.usage,
      attemptCount: Math.max(telemetry.attemptCount, 1),
      modelCallCount: Math.max(telemetry.modelCallCount, 1),
      durationMs: Math.round(performance.now() - startedAt),
    });

    const judge = new Agent({
      id: 'judge',
      name: 'judge',
      model: resolvedModel,
      instructions,
      ...(tools ? { tools } : {}),
      ...(memory ? { memory } : {}),
      ...(inputProcessors ? { inputProcessors } : {}),
      ...(outputProcessors ? { outputProcessors } : {}),
      ...(errorProcessors ? { errorProcessors } : {}),
      ...(maxProcessorRetries !== undefined ? { maxProcessorRetries } : {}),
    });
    if (this.#mastra) {
      judge.__registerMastra(this.#mastra);
    }
    const judgeRunOptions = {
      ...observabilityContext,
      ...(memoryOptions ? { memory: memoryOptions } : {}),
      ...(maxSteps ? { maxSteps } : {}),
      ...(this.config.judge?.requestContext ? { requestContext: this.config.judge.requestContext } : {}),
    };
    const createJudgeStreamRunOptions = () => ({
      ...judgeRunOptions,
      onStepFinish: async (event: Parameters<MastraOnStepFinishCallback<unknown>>[0]) => {
        pendingStepCount += 1;
        addScorerJudgeUsage(pendingStepUsage, normalizeScorerJudgeUsage(event.usage));
        if (event.model?.modelId) {
          telemetry.judgeModelId = event.model.modelId;
        }
        if (event.model?.provider) {
          telemetry.judgeProvider = event.model.provider;
        }
        await onStepFinish?.(event);
      },
      onFinish: async (event: Parameters<MastraOnFinishCallback<unknown>>[0]) => {
        completedOnFinishCount += 1;
        if (event.model?.modelId) {
          telemetry.judgeModelId = event.model.modelId;
        }
        if (event.model?.provider) {
          telemetry.judgeProvider = event.model.provider;
        }
        await onFinish?.(event);
      },
    });

    // GenerateScore output must be a number
    if (scorerStep.name === 'generateScore') {
      let result;
      if (isSupportedLanguageModel(resolvedModel)) {
        result = await tryStreamWithJsonFallback(judge, prompt, {
          structuredOutput: {
            schema: z.object({ score: z.number() }),
            jsonPromptInjection,
          },
          ...createJudgeStreamRunOptions(),
          ...(onStream ? { onStream } : {}),
          onStreamFinish: recordStreamResult,
        });
        const object = await result.object;
        const score = (object as { score: number }).score;
        return { result: score, prompt, judgeModel, execution: createExecution(score) };
      } else {
        const schema = z.object({
          score: z.number(),
        });
        const standardSchema = toStandardSchema(schema as PublicSchema);
        result = await judge.generateLegacy(prompt, {
          output: standardSchemaToJSONSchema(standardSchema),
          ...judgeRunOptions,
        });
        recordLegacyUsage(result.usage, (result as { steps?: unknown }).steps);
        const score = (result.object as { score: number }).score;
        return { result: score, prompt, judgeModel, execution: createExecution(score) };
      }

      // GenerateReason output must be a string
    } else if (scorerStep.name === 'generateReason') {
      if (isSupportedLanguageModel(resolvedModel)) {
        const result = await judge.stream(prompt, createJudgeStreamRunOptions());
        void onStream?.(result as unknown as Awaited<ReturnType<Agent['stream']>>);
        const reason = await result.text;
        await recordStreamResult(result);
        return { result: reason, prompt, judgeModel, execution: createExecution(reason) };
      }

      const result = await judge.generateLegacy(prompt, judgeRunOptions);
      recordLegacyUsage(result.usage, (result as { steps?: unknown }).steps);
      const reason = await result.text;
      return { result: reason, prompt, judgeModel, execution: createExecution(reason) };
    } else {
      const promptStep = originalStep as PromptObject<any, any, any, TInput, TRunOutput>;
      // Convert to StandardSchemaWithJSON at runtime to ensure ~standard.jsonSchema is available
      // Cast to PublicSchema since outputSchema can be any schema type
      const standardSchema = toStandardSchema(promptStep.outputSchema as PublicSchema);
      let result;
      if (isSupportedLanguageModel(resolvedModel)) {
        // Use type assertion to any to bypass complex type checking - runtime schema is validated by toStandardSchema
        result = await tryStreamWithJsonFallback(judge, prompt, {
          structuredOutput: {
            schema: standardSchema as any,
            jsonPromptInjection,
          },
          ...createJudgeStreamRunOptions(),
          ...(onStream ? { onStream } : {}),
          onStreamFinish: recordStreamResult,
        });
        const object = (await result.object) as JSONValue;
        return { result: object, prompt, judgeModel, execution: createExecution(object) };
      } else {
        result = await judge.generateLegacy(prompt, {
          output: standardSchemaToJSONSchema(standardSchema),
          ...judgeRunOptions,
        });
        recordLegacyUsage(result.usage, (result as { steps?: unknown }).steps);
        const object = result.object as JSONValue;
        return { result: object, prompt, judgeModel, execution: createExecution(object) };
      }
    }
  }

  private transformToScorerResult({
    workflowResult,
    originalInput,
  }: {
    workflowResult: any;
    originalInput: ScorerRun<TInput, TRunOutput> & { runId: string; scoreTraceId?: string };
  }) {
    const finalStepResult = workflowResult.result;
    const accumulatedResults = finalStepResult?.accumulatedResults || {};
    const generatedPrompts = finalStepResult?.generatedPrompts || {};
    const judge = finalStepResult?.judge as ScorerJudgeResults | undefined;

    return {
      ...originalInput,
      score: accumulatedResults.generateScoreStepResult,
      generateScorePrompt: generatedPrompts.generateScorePrompt,
      reason: accumulatedResults.generateReasonStepResult,
      generateReasonPrompt: generatedPrompts.generateReasonPrompt,
      preprocessStepResult: accumulatedResults.preprocessStepResult,
      preprocessPrompt: generatedPrompts.preprocessPrompt,
      analyzeStepResult: accumulatedResults.analyzeStepResult,
      analyzePrompt: generatedPrompts.analyzePrompt,
      ...(judge && Object.keys(judge).length > 0 ? { judge } : {}),
    };
  }
}

// Overload: enum type shortcuts (e.g., type: 'agent')
export function createScorer<TID extends string, TType extends keyof ScorerTypeShortcuts>(
  config: Omit<ScorerConfig<TID, any, any>, 'type'> & {
    type: TType;
  },
): MastraScorer<TID, ScorerTypeShortcuts[TType]['input'], ScorerTypeShortcuts[TType]['output'], {}>;

// Overload: infer TInput/TRunOutput from provided Zod schemas in config.type
export function createScorer<TID extends string, TInputSchema extends z.ZodTypeAny, TOutputSchema extends z.ZodTypeAny>(
  config: Omit<ScorerConfig<TID, z.infer<TInputSchema>, z.infer<TOutputSchema>>, 'type'> & {
    type: { input: TInputSchema; output: TOutputSchema };
  },
): MastraScorer<TID, z.infer<TInputSchema>, z.infer<TOutputSchema>, {}>;

// Overload: explicit generics (backwards compatible)
export function createScorer<TInput = any, TRunOutput = any, TID extends string = string>(
  config: ScorerConfig<TID, TInput, TRunOutput>,
): MastraScorer<TID, TInput, TRunOutput, {}>;

// Implementation
export function createScorer(config: any): any {
  return new MastraScorer({
    id: config.id,
    name: config.name ?? config.id,
    description: config.description,
    judge: config.judge,
    type: config.type,
    prepareRun: config.prepareRun,
  });
}

export type MastraScorerEntry = {
  scorer: MastraScorer<any, any, any, any>;
  sampling?: ScoringSamplingConfig;
};

export type MastraScorers = Record<string, MastraScorerEntry>;

// ============================================================================
// filterRun — declarative utility for prepareRun
// ============================================================================

/**
 * Known MastraMessagePart type values. Provides autocomplete for common types
 * while still allowing arbitrary `data-*` strings via the `string & {}` escape hatch.
 */
export type MastraPartType =
  // Core part types
  | 'text'
  | 'tool-invocation'
  | 'step-start'
  | 'reasoning'
  | 'image'
  | 'file'
  | 'source'
  | 'source-document'
  // Data part prefixes (prefix-matched)
  | 'data-'
  | 'data-om-'
  | 'data-om-status'
  | 'data-om-observation-start'
  | 'data-om-observation-end'
  | 'data-om-observation-failed'
  | 'data-om-buffering-start'
  | 'data-om-buffering-end'
  | 'data-om-buffering-failed'
  | 'data-om-activation'
  | 'data-om-thread-update'
  | 'data-workspace-'
  | 'data-workspace-metadata'
  | 'data-sandbox-'
  | 'data-sandbox-stdout'
  | 'data-sandbox-stderr'
  | 'data-sandbox-exit'
  | 'data-sandbox-command'
  | 'data-tool-'
  | 'data-tool-call-approval'
  | 'data-tool-call-suspended'
  | 'data-system-reminder'
  | 'data-signal'
  | 'data-user-message'
  | 'data-tripwire'
  | 'data-structured-output'
  // Allow arbitrary strings for custom data-* types
  | (string & {});

export interface FilterRunOptions {
  /**
   * Keep only messages whose parts match these MastraMessagePart type patterns.
   * Applied to both `input.rememberedMessages` and `output` when they contain
   * MastraDBMessage arrays (the `type: 'agent'` scorer shape).
   *
   * Each entry is prefix-matched against `MastraMessagePart.type`:
   * - `'text'` — text parts
   * - `'tool-invocation'` — tool invocation parts
   * - `'step-start'` — step markers
   * - `'data-'` — all data parts (OM, workspace, sandbox, etc.)
   * - `'data-om-'` — only observational memory data parts
   *
   * Messages where no part matches are dropped. Plain text messages (user text,
   * assistant text without tool parts) are always kept regardless of this filter.
   *
   * To filter by specific tool names, use `toolNames` instead.
   */
  partTypes?: MastraPartType[];

  /**
   * Keep only tool-invocation messages for these specific tools.
   * Each entry is prefix-matched against `toolInvocation.toolName`.
   * Non-tool messages (text, data) are unaffected by this filter.
   *
   * @example `['execute_command', 'write_file', 'string_replace']`
   */
  toolNames?: string[];

  /**
   * Maximum number of messages to keep in `input.rememberedMessages`.
   * Taken from the end (most recent messages). Useful for limiting context window.
   */
  maxRememberedMessages?: number;

  /**
   * Maximum number of messages to keep in `output` (response messages).
   * Taken from the end.
   */
  maxOutputMessages?: number;

  /**
   * Drop `requestContext` entirely from the run.
   */
  dropRequestContext?: boolean;

  /**
   * Drop `expectedTrajectory` from the run.
   */
  dropExpectedTrajectory?: boolean;

  /**
   * Drop `groundTruth` from the run.
   */
  dropGroundTruth?: boolean;
}

/**
 * Creates a `prepareRun` function from declarative options.
 * Use this with `createScorer({ prepareRun: filterRun({ ... }) })`.
 *
 * @example
 * ```ts
 * createScorer({
 *   id: 'my-scorer',
 *   description: '...',
 *   type: 'agent',
 *   prepareRun: filterRun({
 *     toolNames: ['execute_command', 'write_file', 'string_replace_lsp'],
 *     maxRememberedMessages: 20,
 *   }),
 * })
 * ```
 */
export function filterRun<TInput = unknown, TOutput = unknown>(
  options: FilterRunOptions,
): (run: ScorerRun<TInput, TOutput>) => ScorerRun<TInput, TOutput> {
  return (run: ScorerRun<TInput, TOutput>): ScorerRun<TInput, TOutput> => {
    const result = { ...run };

    if (options.dropRequestContext) {
      result.requestContext = undefined;
    }
    if (options.dropExpectedTrajectory) {
      result.expectedTrajectory = undefined;
    }
    if (options.dropGroundTruth) {
      result.groundTruth = undefined;
    }

    const hasMessageFilters = options.partTypes || options.toolNames;

    // Filter input (ScorerRunInputForAgent shape)
    if (result.input && typeof result.input === 'object' && 'rememberedMessages' in (result.input as object)) {
      const agentInput = result.input as unknown as ScorerRunInputForAgent;

      let remembered = agentInput.rememberedMessages ?? [];
      if (hasMessageFilters) {
        remembered = filterMessages(remembered, options);
      }
      if (options.maxRememberedMessages && remembered.length > options.maxRememberedMessages) {
        remembered = remembered.slice(-options.maxRememberedMessages);
      }

      result.input = {
        ...agentInput,
        rememberedMessages: remembered,
      } as unknown as TInput;
    }

    // Filter output (MastraDBMessage[] shape)
    if (Array.isArray(result.output)) {
      let output: MastraDBMessage[] = result.output as unknown as MastraDBMessage[];
      if (hasMessageFilters) {
        output = filterMessages(output, options);
      }
      if (options.maxOutputMessages && output.length > options.maxOutputMessages) {
        output = output.slice(-options.maxOutputMessages);
      }
      result.output = output as unknown as TOutput;
    }

    return result;
  };
}

/**
 * Get the tool name from a MastraMessagePart if it's a tool-invocation.
 * Handles the Mastra `tool-invocation` shape: `{ type: 'tool-invocation', toolInvocation: { toolName } }`.
 */
function getToolName(part: MastraMessagePart): string | undefined {
  if (part.type === 'tool-invocation') {
    return (part as MastraToolInvocationPart).toolInvocation?.toolName;
  }
  return undefined;
}

/**
 * Check if a message part is a tool-invocation.
 */
function isToolPart(part: MastraMessagePart): boolean {
  return part.type === 'tool-invocation';
}

/**
 * Get the `type` string from a MastraMessagePart.
 * All part types in the union have a `type` discriminator.
 */
function getPartType(part: MastraMessagePart): string {
  return part.type;
}

/**
 * Filter messages by part type patterns and/or tool names.
 *
 * - `partTypes` prefix-matches against `MastraMessagePart.type`
 * - `toolNames` prefix-matches against `toolInvocation.toolName` for tool-invocation parts
 * - Plain text messages (no tool-invocation parts) are always kept
 */
function filterMessages(messages: MastraDBMessage[], options: FilterRunOptions): MastraDBMessage[] {
  return messages.filter(msg => {
    const parts = msg?.content?.parts;
    if (!Array.isArray(parts)) return true; // Keep non-structured messages (plain string content)

    const typedParts = parts as MastraMessagePart[];
    const hasToolInvocations = typedParts.some(isToolPart);

    // Plain text messages — no tool invocations — always kept (unless partTypes explicitly excludes them)
    if (!hasToolInvocations) {
      if (!options.partTypes) return true;
      // If partTypes is set, keep only if at least one part type matches
      return typedParts.some(p => {
        const type = getPartType(p);
        return options.partTypes!.some(pattern => type.startsWith(pattern));
      });
    }

    // Message has tool invocations — apply filters
    if (options.toolNames) {
      // Keep if any tool-invocation matches a tool name prefix
      const hasMatchingTool = typedParts.some(p => {
        const name = getToolName(p);
        return name != null && options.toolNames!.some(pattern => name.startsWith(pattern));
      });
      if (!hasMatchingTool) return false;
    }

    if (options.partTypes) {
      // Keep if any part type matches
      const hasMatchingType = typedParts.some(p => {
        const type = getPartType(p);
        return options.partTypes!.some(pattern => type.startsWith(pattern));
      });
      if (!hasMatchingType) return false;
    }

    return true;
  });
}

// Export types and interfaces for use in test files
export type { ScorerConfig, ScorerRun, PromptObject };

export { MastraScorer };
