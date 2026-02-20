import type { Agent } from '../../agent';
import { isSupportedLanguageModel } from '../../agent';
import type { MessageListInput } from '../../agent/message-list';
import type { MastraScorer } from '../../evals/base';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../../evals/types';
import type { ScoringData } from '../../llm/model/base.types';
import type { TargetType } from '../../storage/types';
import type { Workflow } from '../../workflows';

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
  /** Trace ID from agent/workflow execution (null for scorers or errors) */
  traceId: string | null;
  /** Structured input for scorers (extracted from agent scoring data) */
  scorerInput?: ScorerRunInputForAgent;
  /** Structured output for scorers (extracted from agent scoring data) */
  scorerOutput?: ScorerRunOutputForAgent;
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
      traceId: null,
    };
  }
}

/**
 * Execute a dataset item against a target (agent, workflow, scorer, processor).
 * Phase 2: agent/workflow. Phase 4: scorer. Processor deferred.
 */
export async function executeTarget(
  target: Target,
  targetType: TargetType,
  item: { input: unknown; groundTruth?: unknown },
  options?: { signal?: AbortSignal },
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
        executionPromise = executeAgent(target as Agent, item, signal);
        break;
      case 'workflow':
        executionPromise = executeWorkflow(target as Workflow, item);
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
      traceId: null,
    };
  }
}

/**
 * Race a promise against an AbortSignal. Rejects with the signal's reason when aborted.
 */
function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
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
): Promise<ExecutionResult> {
  const model = await agent.getModel();

  // Both generate() and generateLegacy() return different types (FullOutput vs GenerateTextResult)
  // but share the fields we extract. Cast input to MessageListInput at the boundary.
  const input = item.input as MessageListInput;

  const rawResult = isSupportedLanguageModel(model)
    ? await agent.generate(input, {
        scorers: {},
        returnScorerData: true,
        abortSignal: signal,
      })
    : await agent.generateLegacy(input, {
        scorers: {},
        returnScorerData: true,
      });

  // Narrow to the common fields we need — both v1 and v2 results share these
  const result = rawResult as AgentGenerateResult;

  const traceId = result.traceId ?? null;
  const scoringData = result.scoringData;

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
  };
}

/**
 * Execute a dataset item against a workflow.
 * Creates a run with scorers disabled to avoid double-scoring.
 */
async function executeWorkflow(
  workflow: Workflow,
  item: { input: unknown; groundTruth?: unknown },
): Promise<ExecutionResult> {
  const run = await workflow.createRun({ disableScorers: true });
  const result = await run.start({
    inputData: item.input,
  });

  // TracingProperties is intersected on every WorkflowResult variant
  const traceId = result.traceId ?? null;

  if (result.status === 'success') {
    return { output: result.result, error: null, traceId };
  }

  // Handle all non-success statuses (still include traceId for debugging)
  if (result.status === 'failed') {
    return {
      output: null,
      error: { message: result.error?.message ?? 'Workflow failed', stack: result.error?.stack },
      traceId,
    };
  }

  if (result.status === 'tripwire') {
    return {
      output: null,
      error: { message: `Workflow tripwire: ${result.tripwire?.reason ?? 'Unknown reason'}` },
      traceId,
    };
  }

  if (result.status === 'suspended') {
    return {
      output: null,
      error: { message: 'Workflow suspended - not yet supported in dataset experiments' },
      traceId,
    };
  }

  if (result.status === 'paused') {
    return { output: null, error: { message: 'Workflow paused - not yet supported in dataset experiments' }, traceId };
  }

  // Exhaustive check - should never reach here
  const _exhaustiveCheck: never = result;
  return {
    output: null,
    error: { message: `Workflow ended with unexpected status: ${(_exhaustiveCheck as any).status}` },
    traceId,
  };
}
