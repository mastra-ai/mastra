import type { Agent } from '../../agent';
import { isSupportedLanguageModel } from '../../agent';
import type { MessageListInput } from '../../agent/message-list';
import type { MastraScorer } from '../../evals/base';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../../evals/types';
import type { ScoringData } from '../../llm/model/base.types';
import type { VersionOverrides } from '../../mastra/types';
import { resolveObservabilityContext } from '../../observability';
import { RequestContext } from '../../request-context';
import type { TargetType } from '../../storage/types';
import type { ToolHooks } from '../../tools/types';
import type { StepResult, Workflow } from '../../workflows';
import type { ItemToolMock, ToolMockReport } from './tool-mocks';
import { ToolMockMatcher } from './tool-mocks';

/**
 * Common fields extracted from both FullOutput (v2/v3) and GenerateTextResult/GenerateObjectResult (v1).
 * Used to type the agent result uniformly without coupling to the full return types.
 */
interface AgentGenerateResult {
  text?: string;
  object?: unknown;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  sources?: unknown[];
  files?: unknown[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  reasoningText?: string;
  traceId?: string;
  error?: Error;
  scoringData?: ScoringData;
}

/**
 * Target types supported for dataset execution.
 * Agent and Workflow are Phase 2; scorer and processor are Phase 4.
 */
export type Target = Agent | Workflow | MastraScorer<any, any, any, any>;

/**
 * Result from executing a target against a dataset item.
 */
export interface ExecutionResult {
  /** Output from the target (null if failed) */
  output: unknown;
  /** Structured error if execution failed */
  error: { message: string; stack?: string; code?: string } | null;
  /** Whether execution failed with an explicit AbortError */
  aborted?: boolean;
  /** Trace ID from agent/workflow execution (null for scorers or errors) */
  traceId: string | null;
  /** Root span ID from agent/workflow execution (null when not traced) */
  spanId?: string | null;
  /** Structured input for scorers (extracted from agent scoring data) */
  scorerInput?: ScorerRunInputForAgent;
  /** Structured output for scorers (extracted from agent scoring data) */
  scorerOutput?: ScorerRunOutputForAgent;
  /** Per-step results from a workflow run, keyed by step ID */
  stepResults?: Record<string, StepResult<any, any, any, any>>;
  /** Order in which workflow steps actually executed */
  stepExecutionPath?: string[];
  /** Diagnostic receipt for item-level tool mocks (agent targets only) */
  toolMockReport?: ToolMockReport;
}

/**
 * Execute a dataset item against a scorer (LLM-as-judge calibration).
 * item.input should contain exactly what the scorer expects - direct passthrough.
 * For calibration: item.input = { input, output, groundTruth } (user structures it)
 */
async function executeScorer(
  scorer: MastraScorer<any, any, any, any>,
  item: { input: unknown; groundTruth?: unknown },
): Promise<ExecutionResult> {
  try {
    // Direct passthrough - scorer receives item.input exactly as provided
    // User structures item.input to match scorer's expected shape (e.g., { input, output, groundTruth })
    const result = await scorer.run(item.input as any);

    // Validate score is a number
    const score = typeof result.score === 'number' && !isNaN(result.score) ? result.score : null;

    if (score === null && result.score !== undefined) {
      console.warn(`Scorer ${scorer.id} returned invalid score: ${result.score}`);
    }

    return {
      output: {
        score,
        reason: typeof result.reason === 'string' ? result.reason : null,
      },
      error: null,
      traceId: null, // Scorers don't produce traces
    };
  } catch (error) {
    return {
      output: null,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      ...(error instanceof Error && error.name === 'AbortError' ? { aborted: true } : {}),
      traceId: null,
    };
  }
}

/** Maximum number of suspend/resume cycles to prevent infinite loops */
const MAX_RESUME_CYCLES = 10;

/**
 * Execute a dataset item against a target (agent, workflow, scorer, processor).
 * Phase 2: agent/workflow. Phase 4: scorer. Processor deferred.
 */
export async function executeTarget(
  target: Target,
  targetType: TargetType,
  item: {
    input: unknown;
    groundTruth?: unknown;
    metadata?: Record<string, unknown>;
    resumeSteps?: Record<string, unknown>;
    resumeData?: unknown;
  },
  options?: {
    signal?: AbortSignal;
    requestContext?: Record<string, unknown>;
    experimentId?: string;
    versions?: VersionOverrides;
    /** Item-level static tool mocks (agent targets only). */
    toolMocks?: ItemToolMock[];
  },
): Promise<ExecutionResult> {
  try {
    const signal = options?.signal;

    // Check if already aborted before starting
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
    }

    let executionPromise: Promise<ExecutionResult>;
    switch (targetType) {
      case 'agent':
        executionPromise = executeAgent(
          target as Agent,
          item,
          signal,
          options?.requestContext,
          options?.experimentId,
          options?.versions,
          options?.toolMocks,
        );
        break;
      case 'workflow':
        executionPromise = executeWorkflow(target as Workflow, item, options?.requestContext);
        break;
      case 'scorer':
        executionPromise = executeScorer(target as MastraScorer<any, any, any, any>, item);
        break;
      case 'processor':
        // Processor targets dropped from roadmap - not a core use case
        throw new Error(`Target type '${targetType}' not yet supported.`);
      default:
        throw new Error(`Unknown target type: ${targetType}`);
    }

    // Race execution against signal abort (ensures timeout works even if target ignores signal)
    if (signal) {
      return await raceWithSignal(executionPromise, signal);
    }

    return await executionPromise;
  } catch (error) {
    return {
      output: null,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      ...(error instanceof Error && error.name === 'AbortError' ? { aborted: true } : {}),
      traceId: null,
    };
  }
}

/**
 * Race a promise against an AbortSignal. Rejects with the signal's reason when aborted.
 */
export function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      err => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

/**
 * Execute a dataset item against an agent.
 * Uses generate() for both v1 and v2 models.
 */
async function executeAgent(
  agent: Agent,
  item: { input: unknown; groundTruth?: unknown },
  signal?: AbortSignal,
  requestContext?: Record<string, unknown>,
  experimentId?: string,
  versions?: VersionOverrides,
  toolMocks?: ItemToolMock[],
): Promise<ExecutionResult> {
  const model = await agent.getModel();

  // Both generate() and generateLegacy() return different types (FullOutput vs GenerateTextResult)
  // but share the fields we extract. Cast input to MessageListInput at the boundary.
  const input = item.input as MessageListInput;

  const reqCtx: RequestContext | undefined = requestContext
    ? new RequestContext(Object.entries(requestContext))
    : undefined;

  // Pass experimentId as tracing metadata so it appears on the AGENT_RUN span
  const tracingOptions = experimentId ? { metadata: { experimentId } } : undefined;

  // Build a fresh matcher per item run so ordered consumption is deterministic and
  // not leaked across retries. Compose with the agent's configured hooks.
  const matcher = new ToolMockMatcher(toolMocks);

  // When the item declares mocks, abort the whole run the instant a mocked tool is
  // mis-called so the model cannot go on to invoke later (possibly side-effecting,
  // unmocked) tools live. The mock-abort signal is combined with the outer signal.
  const mockAbort = matcher.hasMocks ? new AbortController() : undefined;
  const mockHooks = matcher.hasMocks ? buildToolMockHooks(agent, matcher, mockAbort!) : undefined;
  const generateSignal =
    mockAbort && signal ? AbortSignal.any([signal, mockAbort.signal]) : (mockAbort?.signal ?? signal);

  // Force sequential tool execution when mocks exist so the provider's tool-call
  // order equals the execution (and consumption) order — deterministic ordered
  // consumption of repeated (toolName, args) mocks. No cost for mock-free runs.
  const mockConcurrency = matcher.hasMocks ? { toolCallConcurrency: 1 } : undefined;

  let rawResult: unknown;
  try {
    rawResult = isSupportedLanguageModel(model)
      ? await agent.generate(input, {
          scorers: {},
          returnScorerData: true,
          abortSignal: generateSignal,
          ...(reqCtx ? { requestContext: reqCtx } : {}),
          ...(tracingOptions ? { tracingOptions } : {}),
          ...(versions ? { versions } : {}),
          ...(mockHooks ? { hooks: mockHooks } : {}),
          ...(mockConcurrency ?? {}),
        })
      : await agent.generateLegacy(input, {
          scorers: {},
          returnScorerData: true,
          abortSignal: generateSignal,
          ...(reqCtx ? { requestContext: reqCtx } : {}),
          ...(tracingOptions ? { tracingOptions } : {}),
          ...(mockHooks ? { hooks: mockHooks } : {}),
          ...(mockConcurrency ?? {}),
        });
  } catch (error) {
    // A mock failure aborts the run mid-flight: surface the deterministic coded
    // error instead of the raw abort. Any other error rethrows unchanged.
    const mockReport = matcher.hasMocks ? matcher.report() : undefined;
    if (mockReport?.failure) {
      return toolMockFailureResult(mockReport, null);
    }
    throw error;
  }

  // Narrow to the common fields we need — both v1 and v2 results share these
  const result = rawResult as AgentGenerateResult;

  const traceId = result.traceId ?? null;
  const scoringData = result.scoringData;

  const toolMockReport = matcher.hasMocks ? matcher.report() : undefined;

  // Fallback for the race where the model finishes a step before the abort
  // propagates: the matcher still recorded the first failure, so fail the item
  // deterministically with the coded error. The mis-called tool never ran live.
  if (toolMockReport?.failure) {
    return toolMockFailureResult(toolMockReport, traceId);
  }

  // Only persist fields relevant to experiment evaluation — drop provider metadata,
  // duplicate messages, steps trace, and other debugging internals
  const trimmedOutput = {
    text: result.text,
    object: result.object,
    toolCalls: result.toolCalls,
    toolResults: result.toolResults,
    sources: result.sources,
    files: result.files,
    usage: result.usage,
    reasoningText: result.reasoningText,
    traceId,
    error: result.error ?? null,
  };

  return {
    output: trimmedOutput,
    error: null,
    traceId,
    scorerInput: scoringData?.input,
    scorerOutput: scoringData?.output,
    ...(toolMockReport ? { toolMockReport } : {}),
  };
}

/** Build the deterministic, non-retryable failure result for a mis-called mock. */
function toolMockFailureResult(report: ToolMockReport, traceId: string | null): ExecutionResult {
  const failure = report.failure!;
  return {
    output: null,
    error: {
      message: `Mocked tool "${failure.toolName}" was called with arguments that did not match an available mock (${failure.code}).`,
      code: failure.code,
    },
    traceId,
    toolMockReport: report,
  };
}

/**
 * Compose item-level tool mocks with the agent's configured tool hooks into a
 * single set of run-level hooks.
 *
 * Composition order (per spec):
 *  1. User `beforeToolCall` (if `{ proceed: false }`, short-circuit — the mock is
 *     left unconsumed and reported as such; user `afterToolCall` is NOT called,
 *     matching the agent's own short-circuit behavior).
 *  2. Mock matcher — `serve` returns the mocked output; `fail` aborts the run so
 *     the model cannot call any further (possibly unmocked, side-effecting) tools
 *     live; `live` falls through to the real tool.
 *  3. User `afterToolCall` runs for served mocks (the agent skips its own on
 *     short-circuit, so it is invoked here to honor the documented composition).
 *
 * Ordered consumption of repeated `(toolName, args)` mocks is deterministic because
 * the caller forces `toolCallConcurrency: 1` when mocks exist, so tool calls arrive
 * (and consume) in the provider's call order — no mutex needed.
 */
function buildToolMockHooks(agent: Agent, matcher: ToolMockMatcher, mockAbort: AbortController): ToolHooks {
  const userHooks = agent.getConfiguredToolHooks();

  return {
    beforeToolCall: async context => {
      // 1. User hook first — a short-circuit leaves the mock unconsumed.
      const userResult = await userHooks?.beforeToolCall?.(context);
      if (userResult?.proceed === false) {
        return userResult;
      }

      // 2. Mock matcher.
      const resolution = matcher.resolve(context.toolName, context.input);
      if (resolution.kind === 'serve') {
        await userHooks?.afterToolCall?.({ ...context, output: resolution.output });
        return { proceed: false, output: resolution.output };
      }
      if (resolution.kind === 'fail') {
        // Abort the whole run immediately. The matcher recorded the first failure;
        // the item fails deterministically via the catch path. Short-circuit the
        // tool here too so the mis-called tool never runs live even before the
        // abort propagates.
        mockAbort.abort(new Error(`Tool mock failure for "${context.toolName}" (${resolution.code})`));
        return { proceed: false, output: { error: resolution.code } };
      }

      // 3. `live` — fall through to the real tool.
      return undefined;
    },
    // Pass the user's afterToolCall through as-is (preserving undefined) so the
    // agent skips a no-op call when the user configured no afterToolCall. Served
    // mocks invoke it manually above, since they short-circuit the real tool.
    afterToolCall: userHooks?.afterToolCall,
  };
}

/**
 * Extract resume data from item fields and metadata.
 *
 * Checks top-level `resumeSteps`/`resumeData` first (inline data path),
 * then falls back to `metadata.resumeSteps`/`metadata.resumeData` (storage-backed path).
 *
 * Supports two shapes:
 * 1. Keyed by step ID: `resumeSteps: { "step-id": <payload> }`
 *    Used when the workflow may suspend on multiple steps and each needs distinct data.
 * 2. Flat payload: `resumeData: <payload>`
 *    Used when the workflow has a single suspended step (auto-detected).
 */
function extractResumeData(item: {
  metadata?: Record<string, unknown>;
  resumeSteps?: Record<string, unknown>;
  resumeData?: unknown;
}): {
  perStep?: Record<string, unknown>;
  flat?: unknown;
} {
  // Top-level fields (from inline DataItem) take precedence.
  // Use explicit `undefined` checks rather than `??` so that falsy values
  // like `null`, `false`, `0`, `""` are treated as valid resume payloads.
  const perStep =
    item.resumeSteps !== undefined
      ? item.resumeSteps
      : (item.metadata?.resumeSteps as Record<string, unknown> | undefined);
  const flat = item.resumeData !== undefined ? item.resumeData : item.metadata?.resumeData;
  return { perStep, flat };
}

/**
 * Execute a dataset item against a workflow.
 * Creates a run with scorers disabled to avoid double-scoring.
 *
 * When the workflow suspends, checks for resume data in `item.metadata`
 * (via `resumeSteps` keyed by step ID or `resumeData` for single-step workflows)
 * and automatically resumes. Loops through multiple suspend/resume cycles up to
 * MAX_RESUME_CYCLES to support multi-step suspend workflows.
 *
 * Mirrors `executeWorkflow` in evals/run so dataset experiments and runEvals
 * produce the same observability spans and scoring data for workflow targets.
 */
async function executeWorkflow(
  workflow: Workflow,
  item: {
    input: unknown;
    groundTruth?: unknown;
    metadata?: Record<string, unknown>;
    resumeSteps?: Record<string, unknown>;
    resumeData?: unknown;
  },
  requestContext?: Record<string, unknown>,
): Promise<ExecutionResult> {
  const reqCtx: RequestContext | undefined = requestContext
    ? new RequestContext(Object.entries(requestContext))
    : undefined;
  const observabilityContext = resolveObservabilityContext({});

  const run = await workflow.createRun({ disableScorers: true });
  let result = await run.start({
    inputData: item.input,
    ...(reqCtx ? { requestContext: reqCtx } : {}),
    ...observabilityContext,
  });

  // Auto-resume loop: if the workflow suspends and resume data is provided,
  // resume the workflow automatically. Cap iterations to prevent infinite loops.
  const { perStep, flat } = extractResumeData(item);
  const hasResumeData = perStep !== undefined || flat !== undefined;

  if (hasResumeData) {
    let cycle = 0;
    while (result.status === 'suspended' && cycle < MAX_RESUME_CYCLES) {
      cycle++;

      // Determine which steps are suspended
      const suspendedPaths: string[][] = result.suspended ?? [];
      if (suspendedPaths.length === 0) break;

      // For each suspended step, look up resume data
      const firstSuspendedStep = suspendedPaths[0]?.[0];
      if (!firstSuspendedStep) break;

      // Resolve resume data: per-step map takes precedence, then flat fallback.
      // Use explicit undefined check so falsy values (null, false, 0) are forwarded.
      const perStepValue = perStep?.[firstSuspendedStep];
      const stepResumeData = perStepValue !== undefined ? perStepValue : flat;
      if (stepResumeData === undefined) break; // No data for this step, stop resuming

      result = await run.resume({
        resumeData: stepResumeData,
        step: firstSuspendedStep,
        ...(reqCtx ? { requestContext: reqCtx } : {}),
        ...observabilityContext,
      });
    }
  }

  return handleWorkflowResult(result);
}

/**
 * Map a terminal WorkflowResult to an ExecutionResult.
 * Uses a loose `result: any` parameter because WorkflowResult is heavily generic;
 * status-narrowing guards below keep accesses safe.
 */

function handleWorkflowResult(result: any): ExecutionResult {
  // TracingProperties is intersected on every WorkflowResult variant
  const traceId = result.traceId ?? null;
  const spanId = result.spanId ?? null;

  if (result.status === 'success') {
    return {
      output: result.result,
      error: null,
      traceId,
      spanId,
      stepResults: result.steps as Record<string, StepResult<any, any, any, any>>,
      stepExecutionPath: result.stepExecutionPath,
    };
  }

  if (result.status === 'failed') {
    return {
      output: null,
      error: { message: result.error?.message ?? 'Workflow failed', stack: result.error?.stack },
      traceId,
      spanId,
      stepResults: result.steps as Record<string, StepResult<any, any, any, any>>,
      stepExecutionPath: result.stepExecutionPath,
    };
  }

  if (result.status === 'tripwire') {
    return {
      output: null,
      error: { message: `Workflow tripwire: ${result.tripwire?.reason ?? 'Unknown reason'}` },
      traceId,
      spanId,
      stepResults: result.steps as Record<string, StepResult<any, any, any, any>>,
      stepExecutionPath: result.stepExecutionPath,
    };
  }

  if (result.status === 'suspended') {
    // Workflow suspended but no resume data was provided (or exhausted).
    // Return partial results with suspend payload for debugging.
    return {
      output: result.suspendPayload ?? null,
      error: {
        message:
          'Workflow suspended — provide resume data via item.resumeSteps/item.resumeData (or metadata.resumeSteps/metadata.resumeData) to auto-resume',
      },
      traceId,
      spanId,
      stepResults: result.steps as Record<string, StepResult<any, any, any, any>>,
      stepExecutionPath: result.stepExecutionPath,
    };
  }

  if (result.status === 'paused') {
    return {
      output: null,
      error: { message: 'Workflow paused - not yet supported in dataset experiments' },
      traceId,
      spanId,
      stepResults: result.steps as Record<string, StepResult<any, any, any, any>>,
      stepExecutionPath: result.stepExecutionPath,
    };
  }

  // Catch-all for any other status
  return {
    output: null,
    error: { message: `Workflow ended with unexpected status: ${result.status}` },
    traceId,
    spanId,
  };
}
