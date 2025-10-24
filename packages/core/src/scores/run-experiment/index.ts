import type { CoreMessage } from 'ai';
import type { Agent, AiMessageType, UIMessageWithMetadata } from '../../agent';
import type { TracingContext } from '../../ai-tracing';
import { MastraError } from '../../error';
import type { RuntimeContext } from '../../runtime-context';
import { Workflow } from '../../workflows';
import type { WorkflowResult, StepResult } from '../../workflows';
import type { MastraScorer } from '../base';
import { ScoreAccumulator } from './scorerAccumulator';
import type { Dataset } from '../../datasets/dataset';
import type { DatasetRow, MastraStorage } from '../../storage';
import crypto from 'crypto';

export { Dataset } from '../../datasets/dataset';

export type ExperimentTrackingConfig = {
  experimentId: string;
  storage: MastraStorage;
};

export type RunExperimentDataItem<TTarget = unknown> = {
  input: TTarget extends Workflow<any, any>
    ? any
    : TTarget extends Agent
      ? string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[]
      : unknown;
  groundTruth?: any;
  runtimeContext?: RuntimeContext;
  tracingContext?: TracingContext;
  datasetRowId?: string; // ID of the dataset row (if from Dataset)
};

type WorkflowScorerConfig = {
  workflow?: MastraScorer<any, any, any, any>[];
  steps?: Record<string, MastraScorer<any, any, any, any>[]>;
};

type RunExperimentResult = {
  scores: Record<string, any>;
  summary: {
    totalItems: number;
  };
};

type RunExperimentDataSource<TTarget = unknown> = RunExperimentDataItem<TTarget>[] | Dataset;

// Agent with scorers array
export function runExperiment<TAgent extends Agent>(config: {
  data: RunExperimentDataSource<TAgent>;
  scorers?: MastraScorer<any, any, any, any>[];
  target: TAgent;
  onItemComplete?: (params: {
    item: RunExperimentDataItem<TAgent>;
    targetResult: ReturnType<Agent['generate']>;
    scorerResults: Record<string, any>; // Flat structure: { scorerName: result }
  }) => void | Promise<void>;
  concurrency?: number;
  experimentTracking?: ExperimentTrackingConfig;
}): Promise<RunExperimentResult>;

// Workflow with scorers array
export function runExperiment<TWorkflow extends Workflow>(config: {
  data: RunExperimentDataSource<TWorkflow>;
  scorers?: MastraScorer<any, any, any, any>[];
  target: TWorkflow;
  onItemComplete?: (params: {
    item: RunExperimentDataItem<TWorkflow>;
    targetResult: WorkflowResult<any, any, any, any>;
    scorerResults: Record<string, any>; // Flat structure: { scorerName: result }
  }) => void | Promise<void>;
  concurrency?: number;
  experimentTracking?: ExperimentTrackingConfig;
}): Promise<RunExperimentResult>;

// Workflow with workflow configuration
export function runExperiment<TWorkflow extends Workflow>(config: {
  data: RunExperimentDataSource<TWorkflow>;
  scorers?: WorkflowScorerConfig;
  target: TWorkflow;
  onItemComplete?: (params: {
    item: RunExperimentDataItem<TWorkflow>;
    targetResult: WorkflowResult<any, any, any, any>;
    scorerResults: {
      workflow?: Record<string, any>;
      steps?: Record<string, Record<string, any>>;
    };
  }) => void | Promise<void>;
  concurrency?: number;
  experimentTracking?: ExperimentTrackingConfig;
}): Promise<RunExperimentResult>;
export async function runExperiment(config: {
  data: RunExperimentDataSource<any>;
  scorers?: MastraScorer<any, any, any, any>[] | WorkflowScorerConfig;
  target: Agent | Workflow;
  onItemComplete?: (params: {
    item: RunExperimentDataItem<any>;
    targetResult: any;
    scorerResults: any;
  }) => void | Promise<void>;
  concurrency?: number;
  experimentTracking?: ExperimentTrackingConfig;
}): Promise<RunExperimentResult> {
  const { data: dataSource, scorers, target, onItemComplete, concurrency = 1, experimentTracking } = config;

  // Convert data source to async iterable (works for both arrays and Dataset)
  const dataIterable = createDataIterable(dataSource);

  // Validate scorers (if provided)
  if (scorers) {
    validateScorers(scorers, target);
  }

  let totalItems = 0;
  const scoreAccumulator = new ScoreAccumulator();

  const pMap = (await import('p-map')).default;

  const storage = experimentTracking?.storage;
  let datasetId: string | undefined;
  let datasetVersionId: string | undefined;
  let experimentId: string | undefined;
  if (storage && experimentTracking?.experimentId) {
    const experiment = await storage?.getExperiment({ id: experimentTracking?.experimentId });
    if (experiment) {
      datasetId = experiment.datasetId;
      datasetVersionId = experiment.datasetVersionId;
      experimentId = experiment.id;
    }
  }

  // Get entity info for saving scores
  const entityId = target.id;
  const entityType = isWorkflow(target) ? 'WORKFLOW' : 'AGENT';

  await pMap(
    dataIterable,
    async (item: RunExperimentDataItem<any>) => {
      let targetResult: any;
      let scorerResults: any = {};
      let error: any;
      let status: 'success' | 'error' = 'success';

      // Generate a consistent runId for this experiment item
      const runId = crypto.randomUUID();

      try {
        targetResult = await executeTarget(target, item, {
          datasetId,
          experimentId,
          datasetRowId: item.datasetRowId,
          datasetVersionId,
        });

        scorerResults = scorers
          ? await runScorers(scorers, targetResult, item, {
              runId,
              storage,
              experimentContext: {
                experimentId,
                entityId,
                entityType,
              },
            })
          : {};
        console.log(`scorerResults`, JSON.stringify(scorerResults, null, 2));
        scoreAccumulator.addScores(scorerResults);
      } catch (err) {
        error = err;
        status = 'error';
      }

      // Save experiment row result if tracking is enabled
      if (experimentTracking && item.datasetRowId) {
        await saveExperimentRowResult({
          experimentTracking,
          item,
          targetResult,
          status,
          error,
        });
      }

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

function isDataset(data: any): data is Dataset {
  return typeof data === 'object' && data !== null && 'rows' in data && typeof data.rows === 'function';
}

/**
 * Creates an async iterable from either an array or Dataset
 * This allows streaming processing without loading everything into memory
 */
async function* createDataIterable(
  dataSource: RunExperimentDataSource<any>,
): AsyncIterableIterator<RunExperimentDataItem<any>> {
  if (Array.isArray(dataSource)) {
    // For arrays, yield each item directly
    for (const item of dataSource) {
      yield item;
    }
  } else if (isDataset(dataSource)) {
    // For Dataset, stream rows and transform them
    for await (const row of dataSource.rows()) {
      console.log('Row', row);
      yield datasetRowToExperimentItem(row);
    }
  } else {
    throw new MastraError({
      domain: 'SCORER',
      id: 'INVALID_DATA_SOURCE',
      category: 'USER',
      text: 'Data source must be either an array of items or a Dataset instance',
    });
  }
}

function datasetRowToExperimentItem(row: DatasetRow): RunExperimentDataItem<any> {
  return {
    input: row.input,
    groundTruth: row.groundTruth,
    runtimeContext: row.runtimeContext,
    datasetRowId: row.rowId, // Map rowId to datasetRowId
    // Note: tracingContext is not stored in DatasetRow, so it will be undefined
  };
}

async function saveExperimentRowResult({
  experimentTracking,
  item,
  targetResult,
  status,
  error,
}: {
  experimentTracking: ExperimentTrackingConfig;
  item: RunExperimentDataItem<any>;
  targetResult: any;
  status: 'success' | 'error';
  error?: any;
}): Promise<void> {
  const { experimentId, storage } = experimentTracking;

  // Extract output from targetResult
  const output = targetResult?.scoringData?.output;

  // Prepare the experiment row result
  const rowResult = {
    experimentId,
    datasetRowId: item.datasetRowId!,
    input: item.input,
    output,
    groundTruth: item.groundTruth,
    runtimeContext: item.runtimeContext,
    status,
    error: error
      ? {
          message: error.message || String(error),
          stack: error.stack,
          name: error.name,
        }
      : undefined,
    // TODO: Add traceId and spanId when tracing is available
  };

  try {
    await storage.addExperimentRowResults([rowResult]);
  } catch (err) {
    // Log error but don't fail the experiment
    console.error('Failed to save experiment row result:', err);
  }
}

function validateScorers(
  scorers: MastraScorer<any, any, any, any>[] | WorkflowScorerConfig,
  target: Agent | Workflow,
): void {
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

async function executeTarget(
  target: Agent | Workflow,
  item: RunExperimentDataItem<any>,
  {
    datasetId,
    experimentId,
    datasetRowId,
    datasetVersionId,
  }: { datasetId?: string; experimentId?: string; datasetRowId?: string; datasetVersionId?: string },
) {
  try {
    if (isWorkflow(target)) {
      return await executeWorkflow(target, item, { datasetId, experimentId, datasetRowId, datasetVersionId });
    } else {
      return await executeAgent(target, item, { datasetId, experimentId, datasetRowId, datasetVersionId });
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

async function executeWorkflow(
  target: Workflow,
  item: RunExperimentDataItem<any>,
  {
    datasetId,
    experimentId,
    datasetRowId,
    datasetVersionId,
  }: { datasetId?: string; experimentId?: string; datasetRowId?: string; datasetVersionId?: string },
) {
  const run = await target.createRunAsync({ disableScorers: true });
  const workflowResult = await run.start({
    inputData: item.input,
    runtimeContext: item.runtimeContext,
    tracingOptions: {
      metadata: {
        datasetId,
        experimentId,
        datasetRowId,
        datasetVersionId: datasetVersionId,
      },
    },
  });

  return {
    scoringData: {
      input: item.input,
      output: workflowResult.status === 'success' ? workflowResult.result : undefined,
      stepResults: workflowResult.steps as Record<string, StepResult<any, any, any, any>>,
    },
  };
}

async function executeAgent(
  agent: Agent,
  item: RunExperimentDataItem<any>,
  {
    datasetId,
    experimentId,
    datasetRowId,
    datasetVersionId,
  }: { datasetId?: string; experimentId?: string; datasetRowId?: string; datasetVersionId?: string },
) {
  console.log('Execute agent', item);
  const model = await agent.getModel();
  console.log(`model specification version`, model.specificationVersion);
  if (model.specificationVersion === 'v2') {
    return await agent.generate(item.input as any, {
      scorers: {},
      returnScorerData: true,
      runtimeContext: item.runtimeContext,
      tracingOptions: {
        metadata: {
          datasetId,
          experimentId,
          datasetRowId,
          datasetVersionId,
        },
      },
    });
  } else {
    return await agent.generateLegacy(item.input as any, {
      scorers: {},
      returnScorerData: true,
      runtimeContext: item.runtimeContext,
      tracingOptions: {
        metadata: {
          datasetId,
          experimentId,
          datasetRowId,
          datasetVersionId,
        },
      },
    });
  }
}

async function saveScorerResult({
  runId,
  scorer,
  score,
  targetResult,
  item,
  storage,
  experimentContext,
  stepId,
}: {
  runId: string;
  scorer: MastraScorer<any, any, any, any>;
  score: any;
  targetResult: any;
  item: RunExperimentDataItem<any>;
  storage: MastraStorage;
  experimentContext: {
    experimentId?: string;
    entityId: string;
    entityType: 'AGENT' | 'WORKFLOW';
  };
  stepId?: string;
}): Promise<void> {
  try {
    const payload = {
      runId,
      scorerId: scorer.name,
      entityId: experimentContext.entityId,
      score: score.score,
      input: targetResult.scoringData?.input,
      output: targetResult.scoringData?.output,
      source: 'TEST' as const, // Experiments are TEST runs
      entityType: experimentContext.entityType,
      scorer: {
        name: scorer.name,
        description: scorer.description || '',
      },
      // Optional tracing fields
      traceId: item.tracingContext?.currentSpan?.traceId,
      spanId: item.tracingContext?.currentSpan?.id,
      // Scorer-specific results
      reason: score.reason,
      preprocessStepResult: score.preprocessStepResult,
      extractStepResult: score.extractStepResult,
      analyzeStepResult: score.analyzeStepResult,
      preprocessPrompt: score.preprocessPrompt,
      extractPrompt: score.extractPrompt,
      generateScorePrompt: score.generateScorePrompt,
      generateReasonPrompt: score.generateReasonPrompt,
      analyzePrompt: score.analyzePrompt,
      // Context
      runtimeContext: item.runtimeContext,
      additionalContext: {
        experimentId: experimentContext.experimentId,
        datasetRowId: item.datasetRowId,
        groundTruth: item.groundTruth,
        stepId, // For workflow step scorers
      },
      metadata: {
        isExperiment: true,
        experimentId: experimentContext.experimentId,
      },
    };

    await storage.saveScore(payload);
  } catch (error) {
    // Log error but don't fail the experiment
    console.error(`Failed to save score for scorer ${scorer.name}:`, error);
  }
}

async function runScorers(
  scorers: MastraScorer<any, any, any, any>[] | WorkflowScorerConfig,
  targetResult: any,
  item: RunExperimentDataItem<any>,
  options?: {
    runId?: string;
    storage?: MastraStorage;
    experimentContext?: {
      experimentId?: string;
      entityId: string;
      entityType: 'AGENT' | 'WORKFLOW';
    };
  },
): Promise<Record<string, any>> {
  const scorerResults: Record<string, any> = {};

  if (Array.isArray(scorers)) {
    for (const scorer of scorers) {
      try {
        console.log(`running scorer`, scorer.name);
        const score = await scorer.run({
          input: targetResult.scoringData?.input,
          output: targetResult.scoringData?.output,
          groundTruth: item.groundTruth,
          runtimeContext: item.runtimeContext,
          tracingContext: item.tracingContext,
        });

        scorerResults[scorer.name] = score;
        // Save score if storage is available
        if (options?.storage && options?.experimentContext && options?.runId) {
          await saveScorerResult({
            runId: options.runId,
            scorer,
            score,
            targetResult,
            item,
            storage: options.storage,
            experimentContext: options.experimentContext,
          });
        }
      } catch (error) {
        throw new MastraError(
          {
            domain: 'SCORER',
            id: 'RUN_EXPERIMENT_SCORER_FAILED_TO_SCORE_RESULT',
            category: 'USER',
            text: `Failed to run experiment: Error running scorer ${scorer.name}`,
            details: {
              scorerName: scorer.name,
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
          runtimeContext: item.runtimeContext,
          tracingContext: item.tracingContext,
        });
        workflowScorerResults[scorer.name] = score;

        // Save score if storage is available
        if (options?.storage && options?.experimentContext && options?.runId) {
          await saveScorerResult({
            runId: options.runId,
            scorer,
            score,
            targetResult,
            item,
            storage: options.storage,
            experimentContext: options.experimentContext,
          });
        }
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
                runtimeContext: item.runtimeContext,
                tracingContext: item.tracingContext,
              });
              stepResults[scorer.name] = score;

              // Save step score if storage is available
              if (options?.storage && options?.experimentContext && options?.runId) {
                await saveScorerResult({
                  runId: options.runId,
                  scorer,
                  score,
                  targetResult: {
                    scoringData: {
                      input: stepResult.payload,
                      output: stepResult.output,
                    },
                  },
                  item,
                  storage: options.storage,
                  experimentContext: options.experimentContext,
                  stepId,
                });
              }
            } catch (error) {
              throw new MastraError(
                {
                  domain: 'SCORER',
                  id: 'RUN_EXPERIMENT_SCORER_FAILED_TO_SCORE_STEP_RESULT',
                  category: 'USER',
                  text: `Failed to run experiment: Error running scorer ${scorer.name} on step ${stepId}`,
                  details: {
                    scorerName: scorer.name,
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
