import type { Agent } from '../../agent';
import { isSupportedLanguageModel } from '../../agent';
import type { MastraScorer } from '../../evals/base';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../../evals/types';
import type { TargetType } from '../../storage/types';
import type { Workflow } from '../../workflows';

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

  // Use generate() - works for both v1 and v2 models
  // Pass input as-is - let agent handle normalization
  const result = isSupportedLanguageModel(model)
    ? await agent.generate(item.input as any, {
        scorers: {},
        returnScorerData: true,
        abortSignal: signal,
      })
    : await (agent as any).generateLegacy?.(item.input as any, {
        scorers: {},
        returnScorerData: true,
      });

  if (result == null) {
    throw new Error(`Agent "${agent.name}" does not support generateLegacy for this model type`);
  }

  // Capture traceId and scoring data from agent result
  const traceId = (result as any)?.traceId ?? null;
  const scoringData = (result as any)?.scoringData as
    | { input: ScorerRunInputForAgent; output: ScorerRunOutputForAgent }
    | undefined;

  return {
    output: result,
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

  // Capture traceId from workflow result
  const traceId = (result as any)?.traceId ?? null;

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
