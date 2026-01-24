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
}

/**
 * Execute a dataset item against a target (agent, workflow, scorer, processor).
 * Phase 2 focuses on agent and workflow; scorer/processor deferred to Phase 4.
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
      case 'processor':
        // Deferred to Phase 4 - for now throw clear error
        throw new Error(`Target type '${targetType}' not yet supported. Coming in Phase 4.`);
      default:
        throw new Error(`Unknown target type: ${targetType}`);
    }
  } catch (error) {
    return {
      output: null,
      error: error instanceof Error ? error.message : String(error),
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

  return {
    output: result,
    error: null,
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

  if (result.status === 'success') {
    return { output: result.result, error: null };
  }

  // Handle all non-success statuses
  if (result.status === 'failed') {
    return { output: null, error: result.error?.message ?? 'Workflow failed' };
  }

  if (result.status === 'tripwire') {
    return { output: null, error: `Workflow tripwire: ${result.tripwire?.reason ?? 'Unknown reason'}` };
  }

  if (result.status === 'suspended') {
    return { output: null, error: 'Workflow suspended - not yet supported in dataset runs' };
  }

  if (result.status === 'paused') {
    return { output: null, error: 'Workflow paused - not yet supported in dataset runs' };
  }

  // Exhaustive check - should never reach here
  const _exhaustiveCheck: never = result;
  return { output: null, error: `Workflow ended with unexpected status: ${(_exhaustiveCheck as any).status}` };
}
