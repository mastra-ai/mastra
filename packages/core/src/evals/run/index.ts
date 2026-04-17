import type { CoreMessage } from '@internal/ai-sdk-v4';
import type { Agent, AgentExecutionOptions, AiMessageType, UIMessageWithMetadata } from '../../agent';
import { isSupportedLanguageModel } from '../../agent';
import { MastraError } from '../../error';
import { validateAndSaveScore } from '../../mastra/hooks';
import type { ObservabilityContext } from '../../observability';
import { EntityType, resolveObservabilityContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import type { MastraCompositeStore } from '../../storage';
import { Workflow } from '../../workflows';
import type { AnyWorkflow, WorkflowResult, WorkflowRunStartOptions, StepResult } from '../../workflows';
import type { MastraScorer } from '../base';
import { extractTrajectory, extractTrajectoryFromTrace, extractWorkflowTrajectory } from '../types';
import { ScoreAccumulator } from './scorerAccumulator';

type WorkflowRunOptions = WorkflowRunStartOptions & {
  initialState?: any;
};

type RunEvalsDataItem<TTarget = unknown> = {
  input: TTarget extends Workflow<any, any>
    ? any
    : TTarget extends Agent
      ? string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[]
      : unknown;
  groundTruth?: any;
  expectedTrajectory?: any;
  requestContext?: RequestContext;
  startOptions?: WorkflowRunOptions;
} & Partial<ObservabilityContext>;

export type WorkflowScorerConfig = {
  /** Scorers that evaluate the overall workflow input/output */
  workflow?: MastraScorer<any, any, any, any>[];
  /** Scorers that evaluate individual workflow steps by step ID */
  steps?: Record<string, MastraScorer<any, any, any, any>[]>;
  /** Scorers that evaluate the workflow's step execution trajectory */
  trajectory?: MastraScorer<any, any, any, any>[];
};

export type AgentScorerConfig = {
  /** Scorers that evaluate the full agent input/output */
  agent?: MastraScorer<any, any, any, any>[];
  /** Scorers that evaluate the agent's tool call trajectory */
  trajectory?: MastraScorer<any, any, any, any>[];
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
  targetOptions?: Omit<AgentExecutionOptions<any>, 'scorers' | 'returnScorerData' | 'requestContext'>;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<TAgent>;
    targetResult: Awaited<ReturnType<Agent['generate']>>;
    scorerResults: Record<string, any>; // Flat structure: { scorerName: result }
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult>;

// Workflow with scorers array
export function runEvals<TWorkflow extends AnyWorkflow>(config: {
  data: RunEvalsDataItem<TWorkflow>[];
  scorers: MastraScorer<any, any, any, any>[];
  target: TWorkflow;
  targetOptions?: WorkflowRunOptions;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<TWorkflow>;
    targetResult: WorkflowResult<any, any, any, any>;
    scorerResults: Record<string, any>; // Flat structure: { scorerName: result }
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult>;

// Workflow with workflow configuration
export function runEvals<TWorkflow extends AnyWorkflow>(config: {
  data: RunEvalsDataItem<TWorkflow>[];
  scorers: WorkflowScorerConfig;
  target: TWorkflow;
  targetOptions?: WorkflowRunOptions;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<TWorkflow>;
    targetResult: WorkflowResult<any, any, any, any>;
    scorerResults: {
      workflow?: Record<string, any>;
      steps?: Record<string, Record<string, any>>;
      trajectory?: Record<string, any>;
    };
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult>;

// Agent with agent scorer configuration (agent-level + trajectory scorers)
export function runEvals<TAgent extends Agent>(config: {
  data: RunEvalsDataItem<TAgent>[];
  scorers: AgentScorerConfig;
  target: TAgent;
  targetOptions?: Omit<AgentExecutionOptions<any>, 'scorers' | 'returnScorerData' | 'requestContext'>;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<TAgent>;
    targetResult: Awaited<ReturnType<Agent['generate']>>;
    scorerResults: {
      agent?: Record<string, any>;
      trajectory?: Record<string, any>;
    };
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult>;

export async function runEvals(config: {
  data: RunEvalsDataItem<any>[];
  scorers: MastraScorer<any, any, any, any>[] | WorkflowScorerConfig | AgentScorerConfig;
  target: Agent | Workflow;
  targetOptions?:
    | Omit<AgentExecutionOptions<any>, 'scorers' | 'returnScorerData' | 'requestContext'>
    | WorkflowRunOptions;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<any>;
    targetResult: any;
    scorerResults: any;
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult> {
  const { data, scorers, target, targetOptions, onItemComplete, concurrency = 1 } = config;

  validateEvalsInputs(data, scorers, target);

  let totalItems = 0;
  const scoreAccumulator = new ScoreAccumulator();

  // Get storage from target's Mastra instance if available
  // Agent uses getMastraInstance(), Workflow uses .mastra getter
  const mastra = (target as any).getMastraInstance?.() || (target as any).mastra;
  const storage = mastra?.getStorage();

  const pMap = (await import('p-map')).default;
  await pMap(
    data,
    async (item: RunEvalsDataItem<any>) => {
      const targetResult = await executeTarget(target, item, targetOptions);
      const scorerResults = await runScorers(scorers, targetResult, item, storage);
      scoreAccumulator.addScores(scorerResults);

      // Save scores to storage if available
      if (storage) {
        await saveScoresToStorage({
          storage,
          scorerResults,
          target,
          item,
          mastra,
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
  return (
    typeof scorers === 'object' &&
    !Array.isArray(scorers) &&
    ('workflow' in scorers || 'steps' in scorers || ('trajectory' in scorers && !('agent' in scorers)))
  );
}

function isAgentScorerConfig(scorers: any): scorers is AgentScorerConfig {
  return (
    typeof scorers === 'object' &&
    !Array.isArray(scorers) &&
    ('agent' in scorers || ('trajectory' in scorers && !('workflow' in scorers) && !('steps' in scorers)))
  );
}

function validateEvalsInputs(
  data: RunEvalsDataItem<any>[],
  scorers: MastraScorer<any, any, any, any>[] | WorkflowScorerConfig | AgentScorerConfig,
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
      (scorers.workflow && scorers.workflow.length > 0) ||
      (scorers.steps && Object.keys(scorers.steps).length > 0) ||
      (scorers.trajectory && scorers.trajectory.length > 0);

    if (!hasScorers) {
      throw new MastraError({
        domain: 'SCORER',
        id: 'NO_SCORERS_PROVIDED',
        category: 'USER',
        text: 'At least one workflow, step, or trajectory scorer must be provided',
      });
    }
  } else if (!isWorkflow(target) && isAgentScorerConfig(scorers)) {
    const hasScorers =
      (scorers.agent && scorers.agent.length > 0) || (scorers.trajectory && scorers.trajectory.length > 0);

    if (!hasScorers) {
      throw new MastraError({
        domain: 'SCORER',
        id: 'NO_SCORERS_PROVIDED',
        category: 'USER',
        text: 'At least one agent or trajectory scorer must be provided',
      });
    }
  } else if (!isWorkflow(target) && !Array.isArray(scorers) && !isAgentScorerConfig(scorers)) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'INVALID_AGENT_SCORERS',
      category: 'USER',
      text: 'Agent scorers must be an array of scorers or an AgentScorerConfig',
    });
  }
}

async function executeTarget(
  target: Agent | Workflow,
  item: RunEvalsDataItem<any>,
  targetOptions?:
    | Omit<AgentExecutionOptions<any>, 'scorers' | 'returnScorerData' | 'requestContext'>
    | WorkflowRunOptions,
) {
  try {
    if (isWorkflow(target)) {
      return await executeWorkflow(target, item, targetOptions as WorkflowRunOptions);
    } else {
      return await executeAgent(
        target,
        item,
        targetOptions as Omit<AgentExecutionOptions<any>, 'scorers' | 'returnScorerData' | 'requestContext'>,
      );
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

async function executeWorkflow(target: Workflow, item: RunEvalsDataItem<any>, targetOptions?: WorkflowRunOptions) {
  const observabilityContext = resolveObservabilityContext(item);
  const run = await target.createRun({ disableScorers: true });
  const workflowResult = await run.start({
    ...targetOptions,
    ...item.startOptions,
    inputData: item.input,
    requestContext: item.requestContext,
    ...observabilityContext,
  });

  return {
    traceId: workflowResult.traceId,
    spanId: workflowResult.spanId,
    entityType: EntityType.WORKFLOW_RUN,
    scoringData: {
      input: item.input,
      output: workflowResult.status === 'success' ? workflowResult.result : undefined,
      stepResults: workflowResult.steps as Record<string, StepResult<any, any, any, any>>,
      stepExecutionPath: workflowResult.stepExecutionPath,
    },
  };
}

async function executeAgent(
  agent: Agent,
  item: RunEvalsDataItem<any>,
  targetOptions?: Omit<AgentExecutionOptions<any>, 'scorers' | 'returnScorerData' | 'requestContext'>,
) {
  const observabilityContext = resolveObservabilityContext(item);
  const model = await agent.getModel();
  if (isSupportedLanguageModel(model)) {
    const { structuredOutput, ...restOptions } = targetOptions ?? {};
    const baseOptions = {
      ...restOptions,
      ...observabilityContext,
      scorers: {},
      returnScorerData: true,
      requestContext: item.requestContext,
    };
    const result = structuredOutput
      ? await agent.generate(item.input, { ...baseOptions, structuredOutput })
      : await agent.generate(item.input, baseOptions);

    return {
      ...result,
      entityType: EntityType.AGENT,
    };
  } else {
    const result = await agent.generateLegacy(item.input, {
      scorers: {},
      returnScorerData: true,
      requestContext: item.requestContext,
      ...observabilityContext,
    });
    return {
      ...result,
      entityType: EntityType.AGENT,
    };
  }
}

/**
 * Attempts to extract a hierarchical trajectory from observability traces.
 * Falls back to undefined if storage is not available or trace cannot be fetched.
 */
async function extractTrajectoryFromTraceStore(
  storage: MastraCompositeStore | undefined,
  traceId: string | undefined,
  spanId: string | undefined,
): Promise<ReturnType<typeof extractTrajectoryFromTrace> | undefined> {
  if (!storage || !traceId) return undefined;

  try {
    const observabilityStore = await storage.getStore('observability');
    if (!observabilityStore) return undefined;

    const trace = await observabilityStore.getTrace({ traceId });
    if (!trace?.spans?.length) return undefined;

    return extractTrajectoryFromTrace(trace.spans, spanId);
  } catch {
    // Trace-based extraction is best-effort; fall back to existing extraction
    return undefined;
  }
}

//TODO: Ideally this would run on trace data instead of targetResult data
async function runScorers(
  scorers: MastraScorer<any, any, any, any>[] | WorkflowScorerConfig | AgentScorerConfig,
  targetResult: any,
  item: RunEvalsDataItem<any>,
  storage?: MastraCompositeStore,
): Promise<Record<string, any>> {
  const scorerResults: Record<string, any> = {};
  const targetTraceId = targetResult.traceId;
  const targetEntityType: EntityType = targetResult.entityType;

  if (Array.isArray(scorers)) {
    for (const scorer of scorers) {
      try {
        const score = await scorer.run({
          input: targetResult.scoringData?.input,
          output: targetResult.scoringData?.output,
          groundTruth: item.groundTruth,
          requestContext: item.requestContext,
          scoreSource: 'experiment',
          targetScope: 'span',
          targetEntityType,
          targetTraceId,
          targetSpanId: targetResult.spanId,
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
  } else if (isAgentScorerConfig(scorers)) {
    // Handle agent scorer config (agent-level + trajectory scorers)
    if (scorers.agent) {
      const agentScorerResults: Record<string, any> = {};
      for (const scorer of scorers.agent) {
        try {
          const score = await scorer.run({
            input: targetResult.scoringData?.input,
            output: targetResult.scoringData?.output,
            groundTruth: item.groundTruth,
            requestContext: item.requestContext,
            scoreSource: 'experiment',
            targetScope: 'span',
            targetEntityType,
            targetTraceId,
            targetSpanId: targetResult.spanId,
          });
          agentScorerResults[scorer.id] = score;
        } catch (error) {
          throw new MastraError(
            {
              domain: 'SCORER',
              id: 'RUN_EXPERIMENT_SCORER_FAILED_TO_SCORE_RESULT',
              category: 'USER',
              text: `Failed to run experiment: Error running agent scorer ${scorer.id}`,
              details: {
                scorerId: scorer.id,
                item: JSON.stringify(item),
              },
            },
            error,
          );
        }
      }
      if (Object.keys(agentScorerResults).length > 0) {
        scorerResults.agent = agentScorerResults;
      }
    }

    if (scorers.trajectory) {
      const trajectoryScorerResults: Record<string, any> = {};

      // Prefer hierarchical trace-based extraction when storage + traceId are available
      const traceTrajectory = await extractTrajectoryFromTraceStore(storage, targetResult.traceId, targetResult.spanId);

      // Fall back to flat extraction from MastraDBMessage[] tool invocations
      const rawOutput = targetResult.scoringData?.output;
      const trajectory = traceTrajectory ?? (rawOutput ? extractTrajectory(rawOutput) : { steps: [] });

      for (const scorer of scorers.trajectory) {
        try {
          const score = await scorer.run({
            input: targetResult.scoringData?.input,
            output: trajectory,
            groundTruth: item.groundTruth,
            expectedTrajectory: item.expectedTrajectory,
            requestContext: item.requestContext,
            scoreSource: 'experiment',
            targetScope: 'trajectory',
            targetEntityType,
            targetTraceId,
            targetSpanId: targetResult.spanId,
          });
          trajectoryScorerResults[scorer.id] = score;
        } catch (error) {
          throw new MastraError(
            {
              domain: 'SCORER',
              id: 'RUN_EXPERIMENT_SCORER_FAILED_TO_SCORE_TRAJECTORY',
              category: 'USER',
              text: `Failed to run experiment: Error running trajectory scorer ${scorer.id}`,
              details: {
                scorerId: scorer.id,
                item: JSON.stringify(item),
              },
            },
            error,
          );
        }
      }
      if (Object.keys(trajectoryScorerResults).length > 0) {
        scorerResults.trajectory = trajectoryScorerResults;
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
          scoreSource: 'experiment',
          targetScope: 'span',
          targetEntityType,
          targetTraceId,
          targetSpanId: targetResult.spanId,
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
        // TODO : Ideally this would run on the trace.WORKFLOW_STEP span...
        // then we could directly add the score to that span
        if (stepResult?.status === 'success' && stepResult.output !== undefined) {
          const stepResults: Record<string, any> = {};
          for (const scorer of stepScorers) {
            try {
              const score = await scorer.run({
                input: stepResult.payload !== undefined ? stepResult.payload : targetResult.scoringData.input,
                output: stepResult.output,
                groundTruth: item.groundTruth,
                requestContext: item.requestContext,
                scoreSource: 'experiment',
                targetScope: 'span',
                targetEntityType: EntityType.WORKFLOW_STEP,
                targetTraceId,
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

    if (scorers.trajectory) {
      const trajectoryScorerResults: Record<string, any> = {};

      // Prefer hierarchical trace-based extraction when storage + traceId are available
      const traceTrajectory = await extractTrajectoryFromTraceStore(storage, targetResult.traceId, targetResult.spanId);

      // Fall back to flat extraction from step results
      let trajectory = traceTrajectory;
      if (!trajectory) {
        const stepResults = targetResult.scoringData?.stepResults;
        const stepExecutionPath = targetResult.scoringData?.stepExecutionPath;
        trajectory = stepResults ? extractWorkflowTrajectory(stepResults, stepExecutionPath) : { steps: [] };
      }

      for (const scorer of scorers.trajectory) {
        try {
          const score = await scorer.run({
            input: targetResult.scoringData?.input,
            output: trajectory,
            groundTruth: item.groundTruth,
            expectedTrajectory: item.expectedTrajectory,
            requestContext: item.requestContext,
            scoreSource: 'experiment',
            targetScope: 'trajectory',
            targetEntityType: EntityType.TRAJECTORY,
            targetTraceId,
            targetSpanId: targetResult.spanId,
          });
          trajectoryScorerResults[scorer.id] = score;
        } catch (error) {
          throw new MastraError(
            {
              domain: 'SCORER',
              id: 'RUN_EXPERIMENT_SCORER_FAILED_TO_SCORE_WORKFLOW_TRAJECTORY',
              category: 'USER',
              text: `Failed to run experiment: Error running workflow trajectory scorer ${scorer.id}`,
              details: {
                scorerId: scorer.id,
                item: JSON.stringify(item),
              },
            },
            error,
          );
        }
      }
      if (Object.keys(trajectoryScorerResults).length > 0) {
        scorerResults.trajectory = trajectoryScorerResults;
      }
    }
  }

  return scorerResults;
}

/**
 * Saves scorer results to storage when running evaluations.
 * This makes scores visible in Studio's observability section.
 *
 * @deprecated Legacy scores-store path. New score emission should use `mastra.observability.addScore().
 */
async function saveScoresToStorage({
  storage,
  scorerResults,
  target,
  item,
  mastra,
}: {
  storage: any;
  scorerResults: Record<string, any>;
  target: Agent | Workflow;
  item: RunEvalsDataItem<any>;
  mastra: any;
}): Promise<void> {
  const entityId = target.id;
  const entityType = isWorkflow(target) ? 'WORKFLOW' : 'AGENT';

  const isStructuredWorkflowResult = 'workflow' in scorerResults || 'steps' in scorerResults;
  const isStructuredAgentResult = 'agent' in scorerResults || 'trajectory' in scorerResults;

  if (!isStructuredWorkflowResult && !isStructuredAgentResult) {
    // Handle flat scorer results (simple array of scorers for agents or workflows)
    for (const [scorerId, scoreResult] of Object.entries(scorerResults)) {
      if (scoreResult && typeof scoreResult === 'object' && 'score' in scoreResult) {
        await saveSingleScore({
          storage,
          scoreResult,
          scorerId,
          entityId,
          entityType,
          mastra,
          target,
          item,
        });
      }
    }
  } else if (isStructuredAgentResult) {
    // Handle agent scorer config with agent-level and trajectory scorers
    if (scorerResults.agent) {
      for (const [scorerId, scoreResult] of Object.entries(scorerResults.agent)) {
        if (scoreResult && typeof scoreResult === 'object' && 'score' in scoreResult) {
          await saveSingleScore({
            storage,
            scoreResult,
            scorerId,
            entityId,
            entityType: 'AGENT',
            mastra,
            target,
            item,
          });
        }
      }
    }

    if (scorerResults.trajectory) {
      for (const [scorerId, scoreResult] of Object.entries(scorerResults.trajectory)) {
        if (scoreResult && typeof scoreResult === 'object' && 'score' in scoreResult) {
          await saveSingleScore({
            storage,
            scoreResult,
            scorerId,
            entityId,
            entityType: 'TRAJECTORY',
            mastra,
            target,
            item,
          });
        }
      }
    }
  } else {
    // Handle workflow scorer config with workflow and step scorers
    if (scorerResults.workflow) {
      for (const [scorerId, scoreResult] of Object.entries(scorerResults.workflow)) {
        if (scoreResult && typeof scoreResult === 'object' && 'score' in scoreResult) {
          await saveSingleScore({
            storage,
            scoreResult,
            scorerId,
            entityId,
            entityType: 'WORKFLOW',
            mastra,
            target,
            item,
          });
        }
      }
    }

    if (scorerResults.steps) {
      for (const [stepId, stepScorers] of Object.entries(scorerResults.steps)) {
        for (const [scorerId, scoreResult] of Object.entries(stepScorers as Record<string, any>)) {
          if (scoreResult && typeof scoreResult === 'object' && 'score' in scoreResult) {
            await saveSingleScore({
              storage,
              scoreResult,
              scorerId,
              entityId: stepId,
              entityType: 'STEP',
              mastra,
              target,
              item,
            });
          }
        }
      }
    }
  }
}

/**
 * Saves a single scorer result to storage
 */
async function saveSingleScore({
  storage,
  scoreResult,
  scorerId,
  entityId,
  entityType,
  mastra,
  target,
  item,
}: {
  storage: any;
  scoreResult: any;
  scorerId: string;
  entityId: string;
  entityType: string;
  mastra: any;
  target: Agent | Workflow;
  item: RunEvalsDataItem<any>;
}): Promise<void> {
  try {
    // Get scorer information
    let scorer = mastra?.getScorerById?.(scorerId);

    if (!scorer) {
      // Try to get from target's scorers
      const targetScorers = await (target as any).listScorers?.();
      if (targetScorers) {
        for (const [_, scorerEntry] of Object.entries(targetScorers)) {
          if ((scorerEntry as any).scorer?.id === scorerId) {
            scorer = (scorerEntry as any).scorer;
            break;
          }
        }
      }
    }

    // Extract tracing context if available
    let traceId: string | undefined;
    let spanId: string | undefined;
    if (item.tracingContext?.currentSpan && item.tracingContext.currentSpan.isValid) {
      spanId = item.tracingContext.currentSpan.id;
      traceId = item.tracingContext.currentSpan.traceId;
    }

    // Build additional context with groundTruth if available
    const additionalContext: Record<string, any> = {};
    if (item.groundTruth !== undefined) {
      additionalContext.groundTruth = item.groundTruth;
    }

    const payload = {
      ...scoreResult,
      scorerId,
      entityId,
      entityType,
      source: 'TEST' as const,
      scorer: {
        id: scorer?.id || scorerId,
        name: scorer?.name || scorerId,
        description: scorer?.description || '',
        type: scorer?.type || 'unknown',
        ...(scorer ? { hasJudge: !!scorer.judge } : {}),
      },
      entity: {
        id: target.id,
        name: (target as any).name || target.id,
      },
      // Include requestContext from item
      requestContext: item.requestContext ? Object.fromEntries(item.requestContext.entries()) : undefined,
      // Include additionalContext with groundTruth
      additionalContext: Object.keys(additionalContext).length > 0 ? additionalContext : undefined,
      // Include tracing information
      traceId,
      spanId,
    };

    // Legacy score-store emission. This path is being deprecated.
    await validateAndSaveScore(storage, payload);
  } catch (error) {
    // Log error but don't fail the evaluation
    mastra?.getLogger?.()?.warn?.(`Failed to save score for scorer ${scorerId}:`, error);
  }
}
