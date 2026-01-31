import type { Agent } from '../../agent';
import { isSupportedLanguageModel } from '../../agent';
import type { MastraScorer } from '../../evals/base';
import type { DatasetItem, TargetType } from '../../storage/types';
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
  /** Error message if execution failed */
  error: string | null;
  /** Trace ID from agent/workflow execution (null for scorers or errors) */
  traceId: string | null;
}

/**
 * Execute a dataset item against a scorer (LLM-as-judge calibration).
 * item.input should contain exactly what the scorer expects - direct passthrough.
 * For calibration: item.input = { input, output, groundTruth } (user structures it)
 */
async function executeScorer(scorer: MastraScorer<any, any, any, any>, item: DatasetItem): Promise<ExecutionResult> {
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
      error: error instanceof Error ? error.message : String(error),
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
  item: DatasetItem,
): Promise<ExecutionResult> {
  try {
    switch (targetType) {
      case 'agent':
        return await executeAgent(target as Agent, item);
      case 'workflow':
        return await executeWorkflow(target as Workflow, item);
      case 'scorer':
        return await executeScorer(target as MastraScorer<any, any, any, any>, item);
      case 'processor':
        // Processor targets dropped from roadmap - not a core use case
        throw new Error(`Target type '${targetType}' not yet supported.`);
      default:
        throw new Error(`Unknown target type: ${targetType}`);
    }
  } catch (error) {
    return {
      output: null,
      error: error instanceof Error ? error.message : String(error),
      traceId: null,
    };
  }
}

/**
 * Execute a dataset item against an agent.
 * Uses generate() for both v1 and v2 models.
 */
async function executeAgent(agent: Agent, item: DatasetItem): Promise<ExecutionResult> {
  const model = await agent.getModel();

  // Use generate() - works for both v1 and v2 models
  // Pass input as-is - let agent handle normalization
  const result = isSupportedLanguageModel(model)
    ? await agent.generate(item.input as any, {
        scorers: {},
        returnScorerData: true,
      })
    : await (agent as any).generateLegacy?.(item.input as any, {
        scorers: {},
        returnScorerData: true,
      });

  // Capture traceId from agent result
  const traceId = (result as any)?.traceId ?? null;

  return {
    output: result,
    error: null,
    traceId,
  };
}

/**
 * Execute a dataset item against a workflow.
 * Creates a run with scorers disabled to avoid double-scoring.
 */
async function executeWorkflow(workflow: Workflow, item: DatasetItem): Promise<ExecutionResult> {
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
    return { output: null, error: result.error?.message ?? 'Workflow failed', traceId };
  }

  if (result.status === 'tripwire') {
    return { output: null, error: `Workflow tripwire: ${result.tripwire?.reason ?? 'Unknown reason'}`, traceId };
  }

  if (result.status === 'suspended') {
    return { output: null, error: 'Workflow suspended - not yet supported in dataset runs', traceId };
  }

  if (result.status === 'paused') {
    return { output: null, error: 'Workflow paused - not yet supported in dataset runs', traceId };
  }

  // Exhaustive check - should never reach here
  const _exhaustiveCheck: never = result;
  return { output: null, error: `Workflow ended with unexpected status: ${(_exhaustiveCheck as any).status}`, traceId };
}
