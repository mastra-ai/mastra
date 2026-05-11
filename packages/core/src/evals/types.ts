import type { CoreMessage, CoreSystemMessage } from '@internal/ai-sdk-v4';
import { z } from 'zod/v4';
import type { MastraDBMessage } from '../agent';
import { SpanType } from '../observability';
import type { ObservabilityContext } from '../observability';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import { dbTimestamps, paginationInfoSchema } from '../storage/domains/shared';
import type { StepResult } from '../workflows/types';

// ============================================================================
// Sampling Config
// ============================================================================

export type ScoringSamplingConfig = { type: 'none' } | { type: 'ratio'; rate: number };

// ============================================================================
// Scoring Source & Entity Type
// ============================================================================

export const scoringSourceSchema = z.enum(['LIVE', 'TEST']);

export type ScoringSource = z.infer<typeof scoringSourceSchema>;

export const scoringEntityTypeSchema = z.enum([
  'AGENT',
  'WORKFLOW',
  'TRAJECTORY',
  'STEP',
  ...Object.values(SpanType),
] as [string, string, ...string[]]);

export type ScoringEntityType = z.infer<typeof scoringEntityTypeSchema>;

// ============================================================================
// Scoring Prompts
// ============================================================================

export const scoringPromptsSchema = z.object({
  description: z.string(),
  prompt: z.string(),
});

export type ScoringPrompts = z.infer<typeof scoringPromptsSchema>;

// ============================================================================
// Shared Record Schemas
// ============================================================================

/** Reusable schema for required record fields (e.g., scorer, entity) */
const recordSchema = z.record(z.string(), z.unknown());

/** Reusable schema for optional record fields (e.g., metadata, additionalContext) */
const optionalRecordSchema = recordSchema.optional();

// ============================================================================
// Base Scoring Input (used for scorer functions)
// ============================================================================

export const scoringInputSchema = z.object({
  runId: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown(),
  additionalContext: optionalRecordSchema,
  requestContext: optionalRecordSchema,
  // Note: observabilityContext is not serializable, so we don't include it in the schema
  // It's added at runtime when needed
});

export type ScoringInput = z.infer<typeof scoringInputSchema> & Partial<ObservabilityContext>;

// ============================================================================
// Scoring Hook Input
// ============================================================================

export const scoringHookInputSchema = z.object({
  runId: z.string().optional(),
  scorer: recordSchema,
  input: z.unknown(),
  output: z.unknown(),
  metadata: optionalRecordSchema,
  additionalContext: optionalRecordSchema,
  source: scoringSourceSchema,
  entity: recordSchema,
  entityType: scoringEntityTypeSchema,
  requestContext: optionalRecordSchema,
  structuredOutput: z.boolean().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
  // Note: observabilityContext is not serializable, so we don't include it in the schema
});

export type ScoringHookInput = z.infer<typeof scoringHookInputSchema> & Partial<ObservabilityContext>;

// ============================================================================
// Extract Step Result
// ============================================================================

export const scoringExtractStepResultSchema = optionalRecordSchema;

export type ScoringExtractStepResult = z.infer<typeof scoringExtractStepResultSchema>;

// ============================================================================
// Analyze Step Result (Score Result)
// ============================================================================

export const scoringValueSchema = z.number();

export const scoreResultSchema = z.object({
  result: optionalRecordSchema,
  score: scoringValueSchema,
  prompt: z.string().optional(),
});

export type ScoringAnalyzeStepResult = z.infer<typeof scoreResultSchema>;

// ============================================================================
// Composite Input Types (for scorer step functions)
// ============================================================================

export const scoringInputWithExtractStepResultSchema = scoringInputSchema.extend({
  runId: z.string(), // Required in this context
  extractStepResult: optionalRecordSchema,
  extractPrompt: z.string().optional(),
});

export type ScoringInputWithExtractStepResult<TExtract = any> = Omit<
  z.infer<typeof scoringInputWithExtractStepResultSchema>,
  'extractStepResult'
> & {
  extractStepResult?: TExtract;
} & Partial<ObservabilityContext>;

export const scoringInputWithExtractStepResultAndAnalyzeStepResultSchema =
  scoringInputWithExtractStepResultSchema.extend({
    score: z.number(),
    analyzeStepResult: optionalRecordSchema,
    analyzePrompt: z.string().optional(),
  });

export type ScoringInputWithExtractStepResultAndAnalyzeStepResult<TExtract = any, TScore = any> = Omit<
  z.infer<typeof scoringInputWithExtractStepResultAndAnalyzeStepResultSchema>,
  'extractStepResult' | 'analyzeStepResult'
> & {
  extractStepResult?: TExtract;
  analyzeStepResult?: TScore;
} & Partial<ObservabilityContext>;

export const scoringInputWithExtractStepResultAndScoreAndReasonSchema =
  scoringInputWithExtractStepResultAndAnalyzeStepResultSchema.extend({
    reason: z.string().optional(),
    reasonPrompt: z.string().optional(),
  });

export type ScoringInputWithExtractStepResultAndScoreAndReason = z.infer<
  typeof scoringInputWithExtractStepResultAndScoreAndReasonSchema
> &
  Partial<ObservabilityContext>;

// ============================================================================
// Score Row Data (stored in DB)
// ============================================================================

export const scoreRowDataSchema = z.object({
  id: z.string(),
  scorerId: z.string(),
  entityId: z.string(),

  // From ScoringInputWithExtractStepResultAndScoreAndReason
  runId: z.string(),
  input: z.unknown().optional(),
  output: z.unknown(),
  additionalContext: optionalRecordSchema,
  requestContext: optionalRecordSchema,
  extractStepResult: optionalRecordSchema,
  extractPrompt: z.string().optional(),
  score: z.number(),
  analyzeStepResult: optionalRecordSchema,
  analyzePrompt: z.string().optional(),
  reason: z.string().optional(),
  reasonPrompt: z.string().optional(),

  // From ScoringHookInput
  scorer: recordSchema,
  metadata: optionalRecordSchema,
  source: scoringSourceSchema,
  entity: recordSchema,
  entityType: scoringEntityTypeSchema.optional(),
  structuredOutput: z.boolean().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),

  // Additional ScoreRowData fields
  preprocessStepResult: optionalRecordSchema,
  preprocessPrompt: z.string().optional(),
  generateScorePrompt: z.string().optional(),
  generateReasonPrompt: z.string().optional(),

  // Timestamps
  ...dbTimestamps,
});

export type ScoreRowData = z.infer<typeof scoreRowDataSchema>;

// ============================================================================
// Save Score Payload (for creating new scores)
// ============================================================================

export const saveScorePayloadSchema = scoreRowDataSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SaveScorePayload = z.infer<typeof saveScorePayloadSchema>;

// ============================================================================
// List Scores Response
// ============================================================================

export const listScoresResponseSchema = z.object({
  pagination: paginationInfoSchema,
  scores: z.array(scoreRowDataSchema),
});

export type ListScoresResponse = z.infer<typeof listScoresResponseSchema>;

export type ExtractionStepFn = (input: ScoringInput) => Promise<Record<string, any>>;

export type AnalyzeStepFn = (input: ScoringInputWithExtractStepResult) => Promise<ScoringAnalyzeStepResult>;

export type ReasonStepFn = (
  input: ScoringInputWithExtractStepResultAndAnalyzeStepResult,
) => Promise<{ reason: string; reasonPrompt?: string } | null>;

export type ScorerOptions = {
  name: string;
  description: string;
  extract?: ExtractionStepFn;
  analyze: AnalyzeStepFn;
  reason?: ReasonStepFn;
  metadata?: Record<string, any>;
  isLLMScorer?: boolean;
};

export type ScorerRunInputForAgent = {
  inputMessages: MastraDBMessage[];
  rememberedMessages: MastraDBMessage[];
  systemMessages: CoreMessage[];
  taggedSystemMessages: Record<string, CoreSystemMessage[]>;
};

export type ScorerRunOutputForAgent = MastraDBMessage[];

// ============================================================================
// Trajectory Types — Discriminated Union
// ============================================================================

/**
 * Base properties shared by all trajectory step types.
 */
export type TrajectoryStepBase = {
  /** Name of the tool called, model used, or step executed */
  name: string;
  /** Duration of this step in milliseconds */
  durationMs?: number;
  /** Additional metadata about this step */
  metadata?: Record<string, unknown>;
  /** Nested child steps (e.g., tool calls inside a workflow step, or steps inside an agent run) */
  children?: TrajectoryStep[];
};

// --- Individual step types ---

export type ToolCallStep = TrajectoryStepBase & {
  stepType: 'tool_call';
  /** Arguments passed to the tool */
  toolArgs?: Record<string, unknown>;
  /** Result returned by the tool */
  toolResult?: Record<string, unknown>;
  /** Whether the tool call succeeded */
  success?: boolean;
};

export type McpToolCallStep = TrajectoryStepBase & {
  stepType: 'mcp_tool_call';
  /** Arguments passed to the MCP tool */
  toolArgs?: Record<string, unknown>;
  /** Result returned by the MCP tool */
  toolResult?: Record<string, unknown>;
  /** The MCP server that handled this tool call */
  mcpServer?: string;
  /** Whether the tool call succeeded */
  success?: boolean;
};

export type ModelGenerationStep = TrajectoryStepBase & {
  stepType: 'model_generation';
  /** The model ID used for generation */
  modelId?: string;
  /** Number of prompt tokens consumed */
  promptTokens?: number;
  /** Number of completion tokens generated */
  completionTokens?: number;
  /** Reason the generation finished (e.g., 'stop', 'tool-calls') */
  finishReason?: string;
};

export type AgentRunStep = TrajectoryStepBase & {
  stepType: 'agent_run';
  /** The ID of the agent that was run */
  agentId?: string;
};

export type WorkflowStepStep = TrajectoryStepBase & {
  stepType: 'workflow_step';
  /** The step ID within the workflow */
  stepId?: string;
  /** Status of the step (e.g., 'success', 'failed', 'suspended') */
  status?: string;
  /** Output data from the step */
  output?: Record<string, unknown>;
};

export type WorkflowRunStep = TrajectoryStepBase & {
  stepType: 'workflow_run';
  /** The ID of the workflow that was run */
  workflowId?: string;
  /** Status of the workflow run */
  status?: string;
};

export type WorkflowConditionalStep = TrajectoryStepBase & {
  stepType: 'workflow_conditional';
  /** Number of conditions evaluated */
  conditionCount?: number;
  /** Steps selected by the conditional */
  selectedSteps?: string[];
};

export type WorkflowParallelStep = TrajectoryStepBase & {
  stepType: 'workflow_parallel';
  /** Number of parallel branches */
  branchCount?: number;
  /** Steps that ran in parallel */
  parallelSteps?: string[];
};

export type WorkflowLoopStep = TrajectoryStepBase & {
  stepType: 'workflow_loop';
  /** Type of loop (e.g., 'dowhile', 'dountil') */
  loopType?: string;
  /** Total number of iterations executed */
  totalIterations?: number;
};

export type WorkflowSleepStep = TrajectoryStepBase & {
  stepType: 'workflow_sleep';
  /** Sleep duration in milliseconds */
  sleepDurationMs?: number;
  /** Type of sleep */
  sleepType?: string;
};

export type WorkflowWaitEventStep = TrajectoryStepBase & {
  stepType: 'workflow_wait_event';
  /** Name of the event being waited on */
  eventName?: string;
  /** Whether the event was received */
  eventReceived?: boolean;
};

export type ProcessorRunStep = TrajectoryStepBase & {
  stepType: 'processor_run';
  /** The ID of the processor that was run */
  processorId?: string;
};

/**
 * A single step in an agent's or workflow's trajectory.
 * Discriminated union on `stepType` — each variant carries properties specific
 * to that kind of action.
 */
export type TrajectoryStep =
  | ToolCallStep
  | McpToolCallStep
  | ModelGenerationStep
  | AgentRunStep
  | WorkflowStepStep
  | WorkflowRunStep
  | WorkflowConditionalStep
  | WorkflowParallelStep
  | WorkflowLoopStep
  | WorkflowSleepStep
  | WorkflowWaitEventStep
  | ProcessorRunStep;

/**
 * The type of action taken in a trajectory step.
 * Derived from the discriminated union for convenience.
 */
export type TrajectoryStepType = TrajectoryStep['stepType'];

/**
 * A complete trajectory: the ordered sequence of steps an agent or workflow took
 * to go from input to output.
 */
export type Trajectory = {
  /** Ordered list of steps taken */
  steps: TrajectoryStep[];
  /** Total duration of the full trajectory in milliseconds */
  totalDurationMs?: number;
  /** The raw agent output messages, preserved for scorers that need text context */
  rawOutput?: ScorerRunOutputForAgent;
  /** The raw workflow result, preserved for scorers that need workflow-specific data */
  rawWorkflowResult?: {
    stepResults: Record<string, StepResult<any, any, any, any>>;
    stepExecutionPath?: string[];
  };
};

/**
 * Configuration for trajectory comparison behavior.
 */
export type TrajectoryComparisonOptions = {
  /**
   * How to compare step ordering.
   * - 'strict': exact match (same steps, same order, no extras)
   * - 'relaxed': subsequence match (extra steps OK, order matters)
   * - 'unordered': just check presence (don't care about order)
   * @default 'relaxed'
   */
  ordering?: 'strict' | 'relaxed' | 'unordered';
  /**
   * Whether to allow repeated steps in the trajectory.
   * When false, repeated steps (loops) are penalized.
   * @default true
   */
  allowRepeatedSteps?: boolean;
};

/**
 * Discriminated union mirroring `TrajectoryStep` — specify a `stepType` for autocomplete
 * on that variant's fields (e.g., `toolArgs` for `tool_call`). All variant-specific fields
 * are optional; only specified fields are used for comparison.
 *
 * Omit `stepType` to match any step by name only.
 *
 * @example
 * ```ts
 * // Match any step named 'search'
 * { name: 'search' }
 *
 * // Match a tool_call with specific args (autocomplete for toolArgs, toolResult, success)
 * { name: 'search', stepType: 'tool_call', toolArgs: { query: 'weather' } }
 *
 * // Match an agent run with nested expectations for its children
 * {
 *   name: 'researchAgent',
 *   stepType: 'agent_run',
 *   children: {
 *     ordering: 'unordered',
 *     steps: [
 *       { name: 'search', stepType: 'tool_call' },
 *       { name: 'summarize', stepType: 'tool_call' },
 *     ],
 *   },
 * }
 * ```
 */
/**
 * Utility type: derive an expected-step variant from an actual TrajectoryStep variant.
 *
 * - Keeps `name` and `stepType` required (for discriminant narrowing)
 * - Makes all other variant-specific fields optional
 * - Drops `durationMs` and `metadata` (not useful for expectations)
 * - Replaces `children: TrajectoryStep[]` with `children: TrajectoryExpectation`
 */
type ToExpected<T extends TrajectoryStep> = Pick<T, 'name' | 'stepType'> &
  Partial<Omit<T, 'name' | 'stepType' | 'children' | 'durationMs' | 'metadata'>> & {
    /** Nested trajectory expectation for this step's children */
    children?: TrajectoryExpectation;
  };

/**
 * Expected step with no specific `stepType` — matches any step by name only.
 * Use this when you don't care about the step type, just the name.
 */
type ExpectedGenericStep = {
  /** Step name to match (tool name, agent ID, workflow step name, etc.) */
  name: string;
  /** Must be omitted for generic matching */
  stepType?: undefined;
  /** Nested trajectory expectation for this step's children */
  children?: TrajectoryExpectation;
};

/**
 * A step expectation for trajectory evaluation.
 *
 * Discriminated union derived from `TrajectoryStep` — when you specify a `stepType`,
 * you get autocomplete for that variant's fields (e.g., `toolArgs` for `tool_call`).
 * Omit `stepType` to match any step by name only.
 *
 * @example
 * ```ts
 * // Name-only matching (any step type)
 * { name: 'search' }
 *
 * // Type-narrowed with autocomplete for toolArgs, toolResult, success
 * { name: 'search', stepType: 'tool_call', toolArgs: { query: 'weather' } }
 *
 * // Nested expectations for a sub-agent
 * {
 *   name: 'research-agent',
 *   stepType: 'agent_run',
 *   children: {
 *     ordering: 'unordered',
 *     steps: [
 *       { name: 'search', stepType: 'tool_call' },
 *       { name: 'summarize', stepType: 'tool_call' },
 *     ],
 *   },
 * }
 * ```
 */
export type ExpectedStep =
  | ToExpected<ToolCallStep>
  | ToExpected<McpToolCallStep>
  | ToExpected<ModelGenerationStep>
  | ToExpected<AgentRunStep>
  | ToExpected<WorkflowStepStep>
  | ToExpected<WorkflowRunStep>
  | ToExpected<WorkflowConditionalStep>
  | ToExpected<WorkflowParallelStep>
  | ToExpected<WorkflowLoopStep>
  | ToExpected<WorkflowSleepStep>
  | ToExpected<WorkflowWaitEventStep>
  | ToExpected<ProcessorRunStep>
  | ExpectedGenericStep;

/**
 * Full trajectory expectation config for the unified trajectory scorer.
 * Can be set as constructor defaults (agent-level) or per dataset item (prompt-specific).
 * Per-item values override constructor defaults.
 */
export type TrajectoryExpectation = {
  // --- Accuracy ---

  /** Expected steps for accuracy checking */
  steps?: ExpectedStep[];

  /**
   * How to compare step ordering.
   * - 'strict': exact match (same steps, same order, no extras)
   * - 'relaxed': subsequence match (extra steps OK, order matters)
   * - 'unordered': just check presence (don't care about order)
   * @default 'relaxed'
   */
  ordering?: 'strict' | 'relaxed' | 'unordered';

  /** Whether to allow repeated steps in accuracy evaluation. @default true */
  allowRepeatedSteps?: boolean;

  // --- Efficiency ---

  /** Maximum number of steps allowed */
  maxSteps?: number;

  /** Maximum total tokens across all model_generation steps */
  maxTotalTokens?: number;

  /** Maximum total duration in milliseconds */
  maxTotalDurationMs?: number;

  /** Whether to penalize redundant calls (same tool + same args consecutively). @default true */
  noRedundantCalls?: boolean;

  // --- Blacklist ---

  /** Tool names that should never appear in the trajectory */
  blacklistedTools?: string[];

  /** Tool name sequences that should never appear (contiguous subsequences) */
  blacklistedSequences?: string[][];

  // --- Tool failure tolerance ---

  /** Maximum acceptable retries per tool before penalizing. @default 2 */
  maxRetriesPerTool?: number;
};

// ============================================================================
// Trajectory Extraction — Agent
// ============================================================================

/**
 * Extracts a Trajectory from agent output messages by walking through
 * tool invocations.
 *
 * This is called automatically by `runEvals` when using `AgentScorerConfig.trajectory`
 * scorers — trajectory scorers receive a pre-extracted `Trajectory` as their `output`
 * instead of raw `MastraDBMessage[]`.
 *
 * @param output - The raw agent output messages
 * @returns A Trajectory with ToolCallStep entries extracted from tool invocations
 */
export function extractTrajectory(output: ScorerRunOutputForAgent): Trajectory {
  const steps: ToolCallStep[] = [];

  for (const message of output) {
    const toolInvocations = message?.content?.toolInvocations;
    if (!toolInvocations) continue;

    for (const invocation of toolInvocations) {
      if (invocation && invocation.toolName && (invocation.state === 'result' || invocation.state === 'call')) {
        const toolArgs =
          invocation.args != null && typeof invocation.args === 'object' && !Array.isArray(invocation.args)
            ? (invocation.args as Record<string, unknown>)
            : invocation.args != null
              ? { value: invocation.args }
              : undefined;

        const rawResult = invocation.state === 'result' ? invocation.result : undefined;
        const toolResult =
          rawResult != null && typeof rawResult === 'object' && !Array.isArray(rawResult)
            ? (rawResult as Record<string, unknown>)
            : rawResult != null
              ? { value: rawResult }
              : undefined;

        steps.push({
          stepType: 'tool_call',
          name: invocation.toolName,
          toolArgs,
          toolResult,
          success: invocation.state === 'result',
        });
      }
    }
  }

  return { steps, rawOutput: output };
}

// ============================================================================
// Trajectory Extraction — Workflow
// ============================================================================

/**
 * Extracts a Trajectory from workflow step results.
 *
 * Converts the `stepResults` record (and optional `stepExecutionPath` ordering)
 * into a flat list of `WorkflowStepStep` entries. Each step captures its status,
 * output, and timing.
 *
 * This is called automatically by `runEvals` when using `WorkflowScorerConfig.trajectory`
 * scorers.
 *
 * @param stepResults - The workflow step results record
 * @param stepExecutionPath - Optional ordered list of step IDs for execution ordering
 * @returns A Trajectory with WorkflowStepStep entries
 */
export function extractWorkflowTrajectory(
  stepResults: Record<string, StepResult<any, any, any, any>>,
  stepExecutionPath?: string[],
): Trajectory {
  const steps: WorkflowStepStep[] = [];

  // Use stepExecutionPath ordering when available, fall back to stepResults keys
  const stepIds = stepExecutionPath ?? Object.keys(stepResults);

  let totalStartedAt: number | undefined;
  let totalEndedAt: number | undefined;

  for (const stepId of stepIds) {
    const result = stepResults[stepId];
    if (!result) continue;

    // Track overall timing
    if (result.startedAt != null) {
      if (totalStartedAt == null || result.startedAt < totalStartedAt) {
        totalStartedAt = result.startedAt;
      }
    }

    const endedAt = 'endedAt' in result ? (result as { endedAt?: number }).endedAt : undefined;
    if (endedAt != null) {
      if (totalEndedAt == null || endedAt > totalEndedAt) {
        totalEndedAt = endedAt;
      }
    }

    const durationMs = result.startedAt != null && endedAt != null ? endedAt - result.startedAt : undefined;

    const output =
      'output' in result && result.output != null && typeof result.output === 'object' && !Array.isArray(result.output)
        ? (result.output as Record<string, unknown>)
        : 'output' in result && result.output != null
          ? { value: result.output }
          : undefined;

    steps.push({
      stepType: 'workflow_step',
      name: stepId,
      stepId,
      status: result.status,
      output,
      durationMs,
      metadata: result.metadata as Record<string, unknown> | undefined,
    });
  }

  const totalDurationMs = totalStartedAt != null && totalEndedAt != null ? totalEndedAt - totalStartedAt : undefined;

  return {
    steps,
    totalDurationMs,
    rawWorkflowResult: { stepResults, stepExecutionPath },
  };
}

// ============================================================================
// Trajectory Extraction — From Trace (Hierarchical)
// ============================================================================

/**
 * Span types that are considered noise and should be skipped during
 * trace-to-trajectory conversion (internal implementation details, not
 * meaningful trajectory steps).
 */
const SKIPPED_SPAN_TYPES = new Set([
  SpanType.SCORER_RUN,
  SpanType.SCORER_STEP,
  SpanType.GENERIC,
  SpanType.MODEL_STEP,
  SpanType.MODEL_INFERENCE,
  SpanType.MODEL_CHUNK,
  SpanType.WORKFLOW_CONDITIONAL_EVAL,
]);

type SpanTreeNode = {
  span: SpanRecord;
  children: SpanTreeNode[];
};

/**
 * Converts a `SpanTreeNode` to `TrajectoryStep` entries.
 *
 * Returns an array because a skipped span promotes its children into the
 * parent's list rather than dropping them entirely.
 */
function spanToTrajectorySteps(node: SpanTreeNode): TrajectoryStep[] {
  const { span, children: childNodes } = node;

  if (SKIPPED_SPAN_TYPES.has(span.spanType)) {
    // Promote children of skipped spans so their subtree is preserved
    return childNodes.flatMap(spanToTrajectorySteps);
  }

  const durationMs =
    span.endedAt != null && span.startedAt != null ? span.endedAt.getTime() - span.startedAt.getTime() : undefined;

  const childSteps = childNodes.flatMap(spanToTrajectorySteps);

  const base: TrajectoryStepBase = {
    name: span.name,
    durationMs,
    metadata: span.metadata as Record<string, unknown> | undefined,
    ...(childSteps.length > 0 ? { children: childSteps } : {}),
  };

  const attrs = (span.attributes ?? {}) as Record<string, unknown>;

  switch (span.spanType) {
    case SpanType.TOOL_CALL: {
      const toolArgs = toRecordOrUndefined(span.input);
      const toolResult = toRecordOrUndefined(span.output);
      return [
        {
          ...base,
          stepType: 'tool_call' as const,
          toolArgs,
          toolResult,
          success: typeof attrs.success === 'boolean' ? attrs.success : undefined,
        },
      ];
    }

    case SpanType.MCP_TOOL_CALL: {
      const toolArgs = toRecordOrUndefined(span.input);
      const toolResult = toRecordOrUndefined(span.output);
      return [
        {
          ...base,
          stepType: 'mcp_tool_call' as const,
          toolArgs,
          toolResult,
          mcpServer: typeof attrs.mcpServer === 'string' ? attrs.mcpServer : undefined,
          success: typeof attrs.success === 'boolean' ? attrs.success : undefined,
        },
      ];
    }

    case SpanType.MODEL_GENERATION: {
      const usage = attrs.usage as { inputTokens?: number; outputTokens?: number } | undefined;
      return [
        {
          ...base,
          stepType: 'model_generation' as const,
          modelId: typeof attrs.model === 'string' ? attrs.model : undefined,
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          finishReason: typeof attrs.finishReason === 'string' ? attrs.finishReason : undefined,
        },
      ];
    }

    case SpanType.AGENT_RUN:
      return [{ ...base, stepType: 'agent_run' as const, agentId: span.entityId ?? undefined }];

    case SpanType.WORKFLOW_RUN:
      return [{ ...base, stepType: 'workflow_run' as const, workflowId: span.entityId ?? undefined }];

    case SpanType.WORKFLOW_STEP: {
      const output = toRecordOrUndefined(span.output);
      return [{ ...base, stepType: 'workflow_step' as const, stepId: span.name, output }];
    }

    case SpanType.WORKFLOW_CONDITIONAL:
      return [{ ...base, stepType: 'workflow_conditional' as const }];

    case SpanType.WORKFLOW_PARALLEL:
      return [{ ...base, stepType: 'workflow_parallel' as const }];

    case SpanType.WORKFLOW_LOOP:
      return [{ ...base, stepType: 'workflow_loop' as const }];

    case SpanType.WORKFLOW_SLEEP:
      return [{ ...base, stepType: 'workflow_sleep' as const }];

    case SpanType.WORKFLOW_WAIT_EVENT:
      return [{ ...base, stepType: 'workflow_wait_event' as const }];

    case SpanType.PROCESSOR_RUN:
      return [{ ...base, stepType: 'processor_run' as const }];

    default:
      // Unknown span type — promote children if any
      return childSteps;
  }
}

/**
 * Safely converts a value to `Record<string, unknown>` or returns undefined.
 */
function toRecordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

/**
 * Extracts a hierarchical Trajectory from trace spans (as returned by the
 * observability store's `getTrace()`).
 *
 * Builds a parent-child tree from `parentSpanId` references, then recursively
 * converts each span to the appropriate `TrajectoryStep` discriminated union
 * type with nested `children`.
 *
 * Noise spans (`generic`, `model_step`, `model_chunk`, `workflow_conditional_eval`)
 * are automatically skipped.
 *
 * This is used by `runEvals` when storage is available to produce richer,
 * hierarchical trajectories that include nested agent runs, tool calls, and
 * model generations inside workflow or agent steps.
 *
 * @param spans - Flat array of span records from `getTrace().spans`
 * @param rootSpanId - Optional span ID to use as root. If omitted, spans with
 *   no parent are used as roots.
 * @returns A Trajectory with hierarchical TrajectoryStep entries
 *
 * @example
 * ```ts
 * const trace = await observabilityStore.getTrace({ traceId });
 * const trajectory = extractTrajectoryFromTrace(trace.spans, workflowSpanId);
 * ```
 */
export function extractTrajectoryFromTrace(spans: SpanRecord[], rootSpanId?: string): Trajectory {
  if (spans.length === 0) {
    return { steps: [] };
  }

  // Build lookup map
  const nodeMap = new Map<string, SpanTreeNode>();
  for (const span of spans) {
    nodeMap.set(span.spanId, { span, children: [] });
  }

  // Attach children to parents
  const roots: SpanTreeNode[] = [];
  for (const span of spans) {
    const node = nodeMap.get(span.spanId)!;
    if (span.parentSpanId && nodeMap.has(span.parentSpanId)) {
      nodeMap.get(span.parentSpanId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by start time
  for (const node of nodeMap.values()) {
    node.children.sort((a, b) => a.span.startedAt.getTime() - b.span.startedAt.getTime());
  }

  // Find the root to start from
  let targetRoots: SpanTreeNode[];
  if (rootSpanId) {
    const rootNode = nodeMap.get(rootSpanId);
    targetRoots = rootNode ? [rootNode] : roots;
  } else {
    targetRoots = roots;
  }

  // If the target is a single root span (e.g., a workflow_run or agent_run),
  // convert its children directly as the trajectory steps (the root itself
  // is the "container", not a step in the trajectory)
  let stepsToConvert: SpanTreeNode[];
  if (targetRoots.length === 1) {
    const root = targetRoots[0]!;
    // If root is a container span type, use its children as trajectory steps
    const containerTypes = new Set([SpanType.WORKFLOW_RUN, SpanType.AGENT_RUN]);
    if (containerTypes.has(root.span.spanType)) {
      stepsToConvert = root.children;
    } else {
      stepsToConvert = targetRoots;
    }
  } else {
    stepsToConvert = targetRoots;
  }

  const steps = stepsToConvert.flatMap(spanToTrajectorySteps);

  // Calculate total duration from the root span(s)
  let totalDurationMs: number | undefined;
  if (targetRoots.length === 1) {
    const root = targetRoots[0]!.span;
    if (root.endedAt && root.startedAt) {
      totalDurationMs = root.endedAt.getTime() - root.startedAt.getTime();
    }
  }

  return { steps, totalDurationMs };
}
