import type { CoreMessage } from '@internal/ai-sdk-v4';
import type { Agent, AiMessageType, UIMessageWithMetadata } from '../../agent';
import { MastraError } from '../../error';
import type { TracingContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import { Workflow } from '../../workflows';
import type { WorkflowResult, StepResult } from '../../workflows';
import type { MastraScorer } from '../base';
import { ScoreAccumulator } from './scorerAccumulator';

type RunEvalsDataItem<TTarget = unknown> = {
  input: TTarget extends Workflow<any, any>
    ? any
    : TTarget extends Agent
      ? string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[]
      : unknown;
  groundTruth?: any;
  requestContext?: RequestContext;
  tracingContext?: TracingContext;
};

type WorkflowScorerConfig = {
  workflow?: MastraScorer<any, any, any, any>[];
  steps?: Record<string, MastraScorer<any, any, any, any>[]>;
};

type RunEvalsResult = {
  scores: Record<string, any>;
  summary: {
    totalItems: number;
  };
};

// Agent with scorers array
export function runEvals<TAgent extends Agent>(config: {
  data: RunEvalsDataItem<TAgent>[];
  scorers: MastraScorer<any, any, any, any>[];
  target: TAgent;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<TAgent>;
    targetResult: ReturnType<Agent['generate']>;
    scorerResults: Record<string, any>; // Flat structure: { scorerName: result }
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult>;

// Workflow with scorers array
export function runEvals<TWorkflow extends Workflow<any, any, any, any, any, any, any>>(config: {
  data: RunEvalsDataItem<TWorkflow>[];
  scorers: MastraScorer<any, any, any, any>[];
  target: TWorkflow;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<TWorkflow>;
    targetResult: WorkflowResult<any, any, any, any>;
    scorerResults: Record<string, any>; // Flat structure: { scorerName: result }
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult>;

// Workflow with workflow configuration
export function runEvals<TWorkflow extends Workflow<any, any, any, any, any, any, any>>(config: {
  data: RunEvalsDataItem<TWorkflow>[];
  scorers: WorkflowScorerConfig;
  target: TWorkflow;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<TWorkflow>;
    targetResult: WorkflowResult<any, any, any, any>;
    scorerResults: {
      workflow?: Record<string, any>;
      steps?: Record<string, Record<string, any>>;
    };
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult>;
export async function runEvals(config: {
  data: RunEvalsDataItem<any>[];
  scorers: MastraScorer<any, any, any, any>[] | WorkflowScorerConfig;
  target: Agent | Workflow;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<any>;
    targetResult: any;
    scorerResults: any;
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult> {
  const { data, scorers, target, onItemComplete, concurrency = 1 } = config;

  validateEvalsInputs(data, scorers, target);

  let totalItems = 0;
  const scoreAccumulator = new ScoreAccumulator();

  const pMap = (await import('p-map')).default;
  await pMap(
    data,
    async (item: RunEvalsDataItem<any>) => {
      const targetResult = await executeTarget(target, item);
      const scorerResults = await runScorers(scorers, targetResult, item);
      scoreAccumulator.addScores(scorerResults);

      if (onItemComplete) {
        await onItemComplete({
          item,
          targetResult: targetResult as any,
          scorerResults: scorerResults as any,
        });
      }

      totalItems++;
    },
    { concurrency },
  );

  return {
    scores: scoreAccumulator.getAverageScores(),
    summary: {
      totalItems,
    },
  };
}

function isWorkflow(target: Agent | Workflow): target is Workflow {
  return target instanceof Workflow;
}

function isWorkflowScorerConfig(scorers: any): scorers is WorkflowScorerConfig {
  return typeof scorers === 'object' && !Array.isArray(scorers) && ('workflow' in scorers || 'steps' in scorers);
}

function validateEvalsInputs(
  data: RunEvalsDataItem<any>[],
  scorers: MastraScorer<any, any, any, any>[] | WorkflowScorerConfig,
  target: Agent | Workflow,
): void {
  if (data.length === 0) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'RUN_EXPERIMENT_FAILED_NO_DATA_PROVIDED',
      category: 'USER',
      text: 'Failed to run experiment: Data array is empty',
    });
  }

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== 'object' || !('input' in item)) {
      throw new MastraError({
        domain: 'SCORER',
        id: 'INVALID_DATA_ITEM',
        category: 'USER',
        text: `Invalid data item at index ${i}: must have 'input' properties`,
      });
    }
  }

  // Validate scorers
  if (Array.isArray(scorers)) {
    if (scorers.length === 0) {
      throw new MastraError({
        domain: 'SCORER',
        id: 'NO_SCORERS_PROVIDED',
        category: 'USER',
        text: 'At least one scorer must be provided',
      });
    }
  } else if (isWorkflow(target) && isWorkflowScorerConfig(scorers)) {
    const hasScorers =
      (scorers.workflow && scorers.workflow.length > 0) || (scorers.steps && Object.keys(scorers.steps).length > 0);

    if (!hasScorers) {
      throw new MastraError({
        domain: 'SCORER',
        id: 'NO_SCORERS_PROVIDED',
        category: 'USER',
        text: 'At least one workflow or step scorer must be provided',
      });
    }
  } else if (!isWorkflow(target) && !Array.isArray(scorers)) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'INVALID_AGENT_SCORERS',
      category: 'USER',
      text: 'Agent scorers must be an array of scorers',
    });
  }
}

async function executeTarget(target: Agent | Workflow, item: RunEvalsDataItem<any>) {
  try {
    if (isWorkflow(target)) {
      return await executeWorkflow(target, item);
    } else {
      return await executeAgent(target, item);
    }
  } catch (error) {
    throw new MastraError(
      {
        domain: 'SCORER',
        id: 'RUN_EXPERIMENT_TARGET_FAILED_TO_GENERATE_RESULT',
        category: 'USER',
        text: 'Failed to run experiment: Error generating result from target',
        details: {
          item: JSON.stringify(item),
        },
      },
      error,
    );
  }
}

async function executeWorkflow(target: Workflow, item: RunEvalsDataItem<any>) {
  const run = await target.createRun({ disableScorers: true });
  const workflowResult = await run.start({
    inputData: item.input,
    requestContext: item.requestContext,
  });

  return {
    scoringData: {
      input: item.input,
      output: workflowResult.status === 'success' ? workflowResult.result : undefined,
      stepResults: workflowResult.steps as Record<string, StepResult<any, any, any, any>>,
    },
  };
}

async function executeAgent(agent: Agent, item: RunEvalsDataItem<any>) {
  const model = await agent.getModel();
  if (model.specificationVersion === 'v2') {
    return await agent.generate(item.input as any, {
      scorers: {},
      returnScorerData: true,
      requestContext: item.requestContext,
    });
  } else {
    return await agent.generateLegacy(item.input as any, {
      scorers: {},
      returnScorerData: true,
      requestContext: item.requestContext,
    });
  }
}

async function runScorers(
  scorers: MastraScorer<any, any, any, any>[] | WorkflowScorerConfig,
  targetResult: any,
  item: RunEvalsDataItem<any>,
): Promise<Record<string, any>> {
  const scorerResults: Record<string, any> = {};

  if (Array.isArray(scorers)) {
    for (const scorer of scorers) {
      try {
        const score = await scorer.run({
          input: targetResult.scoringData?.input,
          output: targetResult.scoringData?.output,
          groundTruth: item.groundTruth,
          requestContext: item.requestContext,
          tracingContext: item.tracingContext,
        });

        scorerResults[scorer.id] = score;
      } catch (error) {
        throw new MastraError(
          {
            domain: 'SCORER',
            id: 'RUN_EXPERIMENT_SCORER_FAILED_TO_SCORE_RESULT',
            category: 'USER',
            text: `Failed to run experiment: Error running scorer ${scorer.id}`,
            details: {
              scorerId: scorer.id,
              item: JSON.stringify(item),
            },
          },
          error,
        );
      }
    }
  } else {
    // Handle workflow scorer config
    if (scorers.workflow) {
      const workflowScorerResults: Record<string, any> = {};
      for (const scorer of scorers.workflow) {
        const score = await scorer.run({
          input: targetResult.scoringData.input,
          output: targetResult.scoringData.output,
          groundTruth: item.groundTruth,
          requestContext: item.requestContext,
          tracingContext: item.tracingContext,
        });
        workflowScorerResults[scorer.id] = score;
      }
      if (Object.keys(workflowScorerResults).length > 0) {
        scorerResults.workflow = workflowScorerResults;
      }
    }

    if (scorers.steps) {
      const stepScorerResults: Record<string, any> = {};
      for (const [stepId, stepScorers] of Object.entries(scorers.steps)) {
        const stepResult = targetResult.scoringData.stepResults?.[stepId];
        if (stepResult?.status === 'success' && stepResult.payload && stepResult.output) {
          const stepResults: Record<string, any> = {};
          for (const scorer of stepScorers) {
            try {
              const score = await scorer.run({
                input: stepResult.payload,
                output: stepResult.output,
                groundTruth: item.groundTruth,
                requestContext: item.requestContext,
                tracingContext: item.tracingContext,
              });
              stepResults[scorer.id] = score;
            } catch (error) {
              throw new MastraError(
                {
                  domain: 'SCORER',
                  id: 'RUN_EXPERIMENT_SCORER_FAILED_TO_SCORE_STEP_RESULT',
                  category: 'USER',
                  text: `Failed to run experiment: Error running scorer ${scorer.id} on step ${stepId}`,
                  details: {
                    scorerId: scorer.id,
                    stepId,
                  },
                },
                error,
              );
            }
          }
          if (Object.keys(stepResults).length > 0) {
            stepScorerResults[stepId] = stepResults;
          }
        }
      }
      if (Object.keys(stepScorerResults).length > 0) {
        scorerResults.steps = stepScorerResults;
      }
    }
  }

  return scorerResults;
}
