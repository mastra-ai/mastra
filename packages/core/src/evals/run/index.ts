import { randomUUID } from 'node:crypto';
import type { CoreMessage } from '@internal/ai-sdk-v4';
import type {
  Agent,
  AgentExecutionOptions,
  AgentMemoryOption,
  AiMessageType,
  UIMessageWithMetadata,
} from '../../agent';
import { isSupportedLanguageModel } from '../../agent';
import { MastraError } from '../../error';
import { validateAndSaveScore } from '../../mastra/hooks';
import type { ObservabilityContext } from '../../observability';
import { EntityType, resolveObservabilityContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import type { MastraCompositeStore } from '../../storage';
import type { WorkflowResult, WorkflowRunStartOptions, StepResult } from '../../workflows/types';
import type { AnyWorkflow } from '../../workflows/workflow';
import { Workflow } from '../../workflows/workflow';
import type { MastraScorer } from '../base';
import { extractTrajectory, extractTrajectoryFromTrace, extractWorkflowTrajectory } from '../types';
import { ScoreAccumulator } from './scorerAccumulator';

type WorkflowRunOptions = WorkflowRunStartOptions & {
  initialState?: any;
};

type AgentInputType = string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];

type RunEvalsDataItemBase = {
  groundTruth?: any;
  expectedTrajectory?: any;
  requestContext?: RequestContext;
  startOptions?: WorkflowRunOptions;
} & Partial<ObservabilityContext>;

/**
 * A single turn in a multi-turn conversation with optional per-turn assertions.
 * Per-turn gates/scorers evaluate ONLY that turn's input and output, so a broken
 * turn fails that turn instead of being averaged into a holistic score.
 */
export type EvalTurn = {
  /** The input sent to the agent for this turn. */
  input: AgentInputType;
  /** Gates that must score 1.0 for this turn. A failing turn gate fails the run. */
  gates?: MastraScorer<any, any, any, any>[];
  /** Scorers (optionally with thresholds) evaluated against this turn only. */
  scorers?: ScorerEntry[];
};

type RunEvalsDataItem<TTarget = unknown> = TTarget extends Agent
  ? | (RunEvalsDataItemBase & { input: AgentInputType; inputs?: never; turns?: never })
    | (RunEvalsDataItemBase & {
        input?: AgentInputType;
        /**
         * Multi-turn inputs. When provided, each entry is sent sequentially to the agent
         * on the same thread. Scorers see the accumulated output from all turns.
         * Only supported for Agent targets (not Workflows).
         */
        inputs: AgentInputType[];
        turns?: never;
      })
    | (RunEvalsDataItemBase & {
        input?: never;
        inputs?: never;
        /**
         * Multi-turn conversation with per-turn assertions. Each turn is sent sequentially
         * on the same thread; its `gates`/`scorers` evaluate only that turn's output.
         * Only supported for Agent targets (not Workflows).
         */
        turns: EvalTurn[];
      })
  : TTarget extends Workflow<any, any>
    ? RunEvalsDataItemBase & { input: any; inputs?: never; turns?: never }
    : RunEvalsDataItemBase & { input: unknown; inputs?: never; turns?: never };

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

/** Threshold configuration: a number implies minimum, or an object with min/max bounds. */
export type ThresholdConfig = number | { min?: number; max?: number };

/** A scorer with an associated pass/fail threshold. */
export type ScorerWithThreshold = {
  scorer: MastraScorer<any, any, any, any>;
  /** A number implies minimum threshold. Use { min, max } for range-based checks. */
  threshold: ThresholdConfig;
};

/** A scorer entry: either a bare scorer or one with a threshold. */
export type ScorerEntry = MastraScorer<any, any, any, any> | ScorerWithThreshold;

/** Result of a gate evaluation for a single data item. */
export type GateResult = {
  id: string;
  passed: boolean;
  score: number;
};

/** Verdict of an eval run. */
export type EvalVerdict = 'passed' | 'scored' | 'failed';

/** Per-turn assertion results, aggregated by turn index across data items. */
export type TurnResult = {
  /** Zero-based turn index within the conversation. */
  index: number;
  /** Per-gate results for this turn (averaged across data items). */
  gateResults?: GateResult[];
  /** Per-threshold-scorer results for this turn (averaged across data items). */
  thresholdResults?: Array<{ id: string; passed: boolean; averageScore: number; threshold: ThresholdConfig }>;
  /** Average bare-scorer scores for this turn, keyed by scorer id. */
  scores?: Record<string, number>;
};

/** Raw per-turn scoring for one data item, before cross-item aggregation. */
type ScoredTurn = {
  index: number;
  gates: Array<{ id: string; score: number }>;
  thresholds: Array<{ id: string; score: number; threshold: ThresholdConfig }>;
  scores: Array<{ id: string; score: number }>;
};
type ItemTurnResults = ScoredTurn[];

type RunEvalsResult = {
  scores: Record<string, any>;
  summary: {
    totalItems: number;
  };
  /** Present when `gates` or threshold-bearing scorers (top-level or per-turn) are provided. */
  verdict?: EvalVerdict;
  /** Per-gate results (averaged across all data items). */
  gateResults?: GateResult[];
  /** Per-threshold-scorer results (averaged across all data items). */
  thresholdResults?: Array<{ id: string; passed: boolean; averageScore: number; threshold: ThresholdConfig }>;
  /** Per-turn assertion results, present when any data item uses `turns` with gates/scorers. */
  turnResults?: TurnResult[];
};

/**
 * Agent execution options accepted by runEvals. Identical to the agent's own options
 * except `thread` is optional on `memory`: runEvals generates and injects a thread per
 * data item (multi-turn shares one thread across its turns), so callers only need to
 * supply a `resource` when they want a specific one — they don't have to pass a
 * placeholder thread that runEvals would immediately replace.
 */
type RunEvalsAgentOptions = Omit<
  AgentExecutionOptions<any>,
  'scorers' | 'returnScorerData' | 'requestContext' | 'memory'
> & {
  memory?: Omit<AgentMemoryOption, 'thread'> & { thread?: AgentMemoryOption['thread'] };
};

// Agent with gates (scorers optional) — gate-only runs are allowed
export function runEvals<TAgent extends Agent>(config: {
  data: RunEvalsDataItem<TAgent>[];
  /** Gates: scorers that must score 1.0 for the run to pass. */
  gates: MastraScorer<any, any, any, any>[];
  scorers?: ScorerEntry[];
  target: TAgent;
  targetOptions?: RunEvalsAgentOptions;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<TAgent>;
    targetResult: Awaited<ReturnType<Agent['generate']>>;
    scorerResults: Record<string, any>; // Flat structure: { scorerName: result }
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult>;

// Agent with scorers array (gates optional)
export function runEvals<TAgent extends Agent>(config: {
  data: RunEvalsDataItem<TAgent>[];
  scorers: ScorerEntry[];
  target: TAgent;
  /** Gates: scorers that must score 1.0 for the run to pass. */
  gates?: MastraScorer<any, any, any, any>[];
  targetOptions?: RunEvalsAgentOptions;
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
  targetOptions?: RunEvalsAgentOptions;
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
  scorers?: ScorerEntry[] | MastraScorer<any, any, any, any>[] | WorkflowScorerConfig | AgentScorerConfig;
  target: Agent | Workflow;
  gates?: MastraScorer<any, any, any, any>[];
  targetOptions?: RunEvalsAgentOptions | WorkflowRunOptions;
  onItemComplete?: (params: {
    item: RunEvalsDataItem<any>;
    targetResult: any;
    scorerResults: any;
  }) => void | Promise<void>;
  concurrency?: number;
}): Promise<RunEvalsResult> {
  const { data, scorers = [], gates, target, targetOptions, onItemComplete, concurrency = 1 } = config;

  // Normalize ScorerEntry[] into bare scorers + threshold metadata
  const { bareScorers, thresholdMap } = normalizeScorerEntries(scorers);

  validateEvalsInputs(data, bareScorers, target, gates);

  let totalItems = 0;
  const scoreAccumulator = new ScoreAccumulator();

  // Track gate scores per gate across all items
  const gateScoresByGateId: Record<string, number[]> = {};
  if (gates) {
    for (const gate of gates) {
      gateScoresByGateId[gate.id] = [];
    }
  }

  // Track threshold scorer scores across items
  const thresholdScoresByScorerID: Record<string, number[]> = {};
  for (const scorerId of thresholdMap.keys()) {
    thresholdScoresByScorerID[scorerId] = [];
  }

  // Per-turn assertion results, collected per data item then aggregated by turn index.
  const perItemTurnResults: ItemTurnResults[] = [];

  // Get storage from target's Mastra instance if available
  // Agent uses getMastraInstance(), Workflow uses .mastra getter
  const mastra = (target as any).getMastraInstance?.() || (target as any).mastra;
  const storage = mastra?.getStorage();

  const pMap = (await import('p-map')).default;
  await pMap(
    data,
    async (item: RunEvalsDataItem<any>) => {
      const targetResult = await executeTarget(target, item, targetOptions);

      // Run gates first
      if (gates) {
        for (const gate of gates) {
          try {
            const gateScore = await gate.run({
              input: targetResult.scoringData?.input,
              output: targetResult.scoringData?.output,
              groundTruth: item.groundTruth,
              requestContext: item.requestContext,
              scoreSource: 'experiment',
              targetScope: 'span',
              targetEntityType: targetResult.entityType,
              targetTraceId: targetResult.traceId,
              targetSpanId: targetResult.spanId,
            });
            gateScoresByGateId[gate.id]!.push(gateScore.score as number);
          } catch {
            // Gate failure = score 0
            gateScoresByGateId[gate.id]!.push(0);
          }
        }
      }

      const scorerResults = await runScorers(bareScorers, targetResult, item, storage);
      scoreAccumulator.addScores(scorerResults);

      // Track threshold scores
      for (const [scorerId] of thresholdMap) {
        const result = scorerResults[scorerId];
        if (result && typeof result === 'object' && 'score' in result) {
          thresholdScoresByScorerID[scorerId]!.push(result.score);
        }
      }

      // Run per-turn gates/scorers against each turn's own input/output.
      const perTurn = (targetResult as { perTurn?: PerTurnRecord[] }).perTurn;
      const turns = (item as { turns?: EvalTurn[] }).turns;
      if (Array.isArray(perTurn) && Array.isArray(turns)) {
        const itemTurnResults: ItemTurnResults = [];
        for (let ti = 0; ti < turns.length; ti++) {
          const record = perTurn[ti];
          if (!record) continue;
          const { rawResults, ...scored } = await scoreTurn(turns[ti]!, record, item);
          itemTurnResults.push({ index: ti, ...scored });

          if (storage) {
            for (const [scorerId, scoreResult] of Object.entries(rawResults)) {
              await saveSingleScore({
                storage,
                scoreResult,
                scorerId,
                entityId: target.id,
                entityType: 'AGENT',
                mastra,
                target,
                item,
                turn: {
                  index: ti,
                  traceId: record.traceId,
                  spanId: record.spanId,
                  threadId: record.threadId,
                },
              });
            }
          }
        }
        perItemTurnResults.push(itemTurnResults);
      }

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

  const result: RunEvalsResult = {
    scores: scoreAccumulator.getAverageScores(),
    summary: {
      totalItems,
    },
  };

  // Aggregate per-turn assertions (by turn index across data items).
  const turnAggregate = perItemTurnResults.length > 0 ? aggregateTurnResults(perItemTurnResults) : undefined;
  if (turnAggregate && turnAggregate.turnResults.length > 0) {
    result.turnResults = turnAggregate.turnResults;
  }

  // Compute verdict if gates or thresholds are present (top-level or per-turn)
  const hasGates = !!gates && gates.length > 0;
  const hasThresholds = thresholdMap.size > 0;
  const hasTurnGates = turnAggregate?.hasTurnGates ?? false;
  const hasTurnThresholds = turnAggregate?.hasTurnThresholds ?? false;

  if (hasGates || hasThresholds || hasTurnGates || hasTurnThresholds) {
    // Compute gate results
    let allGatesPassed = true;
    if (hasGates) {
      result.gateResults = [];
      for (const gate of gates) {
        const scores = gateScoresByGateId[gate.id]!;
        const avgScore = average(scores);
        const passed = avgScore >= 1.0;
        if (!passed) allGatesPassed = false;
        result.gateResults.push({ id: gate.id, passed, score: avgScore });
      }
    }

    // Compute threshold results
    let allThresholdsPassed = true;
    if (hasThresholds) {
      result.thresholdResults = [];
      for (const [scorerId, threshold] of thresholdMap) {
        const scores = thresholdScoresByScorerID[scorerId]!;
        const averageScore = average(scores);
        const passed = checkThresholdPassed(averageScore, threshold);
        if (!passed) allThresholdsPassed = false;
        result.thresholdResults.push({ id: scorerId, passed, averageScore, threshold });
      }
    }

    // Fold per-turn gate/threshold outcomes into the overall verdict.
    if (turnAggregate) {
      if (!turnAggregate.turnGatesPassed) allGatesPassed = false;
      if (!turnAggregate.turnThresholdsPassed) allThresholdsPassed = false;
    }

    // Determine verdict
    if (!allGatesPassed) {
      result.verdict = 'failed';
    } else if (!allThresholdsPassed) {
      result.verdict = 'scored';
    } else {
      result.verdict = 'passed';
    }
  }

  return result;
}

function average(scores: number[]): number {
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

/**
 * Scores a single turn against only its own input/output. Gates that throw score 0
 * (consistent with top-level gate handling); per-turn scorer errors propagate.
 */
async function scoreTurn(
  turn: EvalTurn,
  record: PerTurnRecord,
  item: RunEvalsDataItem<any>,
): Promise<Omit<ScoredTurn, 'index'> & { rawResults: Record<string, any> }> {
  const gates: Array<{ id: string; score: number }> = [];
  const thresholds: Array<{ id: string; score: number; threshold: ThresholdConfig }> = [];
  const scores: Array<{ id: string; score: number }> = [];
  const rawResults: Record<string, any> = {};

  if (turn.gates) {
    for (const gate of turn.gates) {
      let score = 0;
      try {
        const gateScore = await gate.run({
          input: record.input,
          output: record.output,
          groundTruth: item.groundTruth,
          requestContext: item.requestContext,
          scoreSource: 'experiment',
          targetScope: 'span',
          targetEntityType: record.entityType,
          targetTraceId: record.traceId,
          targetSpanId: record.spanId,
        });
        score = gateScore.score as number;
        rawResults[gate.id] = gateScore;
      } catch {
        score = 0;
      }
      gates.push({ id: gate.id, score });
    }
  }

  if (turn.scorers && turn.scorers.length > 0) {
    const { bareScorers, thresholdMap } = normalizeScorerEntries(turn.scorers);
    for (const scorer of bareScorers as MastraScorer<any, any, any, any>[]) {
      const scoreResult = await scorer.run({
        input: record.input,
        output: record.output,
        groundTruth: item.groundTruth,
        requestContext: item.requestContext,
        scoreSource: 'experiment',
        targetScope: 'span',
        targetEntityType: record.entityType,
        targetTraceId: record.traceId,
        targetSpanId: record.spanId,
      });
      const score = scoreResult.score as number;
      scores.push({ id: scorer.id, score });
      rawResults[scorer.id] = scoreResult;
      const threshold = thresholdMap.get(scorer.id);
      if (threshold !== undefined) {
        thresholds.push({ id: scorer.id, score, threshold });
      }
    }
  }

  return { gates, thresholds, scores, rawResults };
}

/** Aggregates per-item turn results by turn index, averaging scores across items. */
function aggregateTurnResults(perItemTurnResults: ItemTurnResults[]): {
  turnResults: TurnResult[];
  turnGatesPassed: boolean;
  turnThresholdsPassed: boolean;
  hasTurnGates: boolean;
  hasTurnThresholds: boolean;
} {
  type Bucket = {
    gates: Map<string, number[]>;
    thresholds: Map<string, { scores: number[]; threshold: ThresholdConfig }>;
    scores: Map<string, number[]>;
  };
  const byIndex = new Map<number, Bucket>();

  for (const itemTurns of perItemTurnResults) {
    for (const turn of itemTurns) {
      let bucket = byIndex.get(turn.index);
      if (!bucket) {
        bucket = { gates: new Map(), thresholds: new Map(), scores: new Map() };
        byIndex.set(turn.index, bucket);
      }
      for (const g of turn.gates) {
        const arr = bucket.gates.get(g.id) ?? [];
        arr.push(g.score);
        bucket.gates.set(g.id, arr);
      }
      for (const th of turn.thresholds) {
        const existing = bucket.thresholds.get(th.id);
        if (existing) existing.scores.push(th.score);
        else bucket.thresholds.set(th.id, { scores: [th.score], threshold: th.threshold });
      }
      for (const s of turn.scores) {
        const arr = bucket.scores.get(s.id) ?? [];
        arr.push(s.score);
        bucket.scores.set(s.id, arr);
      }
    }
  }

  let turnGatesPassed = true;
  let turnThresholdsPassed = true;
  let hasTurnGates = false;
  let hasTurnThresholds = false;
  const turnResults: TurnResult[] = [];

  for (const index of [...byIndex.keys()].sort((a, b) => a - b)) {
    const bucket = byIndex.get(index)!;
    const turnResult: TurnResult = { index };

    if (bucket.gates.size > 0) {
      hasTurnGates = true;
      turnResult.gateResults = [];
      for (const [id, gateScores] of bucket.gates) {
        const score = average(gateScores);
        const passed = score >= 1.0;
        if (!passed) turnGatesPassed = false;
        turnResult.gateResults.push({ id, passed, score });
      }
    }

    if (bucket.thresholds.size > 0) {
      hasTurnThresholds = true;
      turnResult.thresholdResults = [];
      for (const [id, { scores: thresholdScores, threshold }] of bucket.thresholds) {
        const averageScore = average(thresholdScores);
        const passed = checkThresholdPassed(averageScore, threshold);
        if (!passed) turnThresholdsPassed = false;
        turnResult.thresholdResults.push({ id, passed, averageScore, threshold });
      }
    }

    if (bucket.scores.size > 0) {
      turnResult.scores = {};
      for (const [id, scorerScores] of bucket.scores) {
        turnResult.scores[id] = average(scorerScores);
      }
    }

    turnResults.push(turnResult);
  }

  return { turnResults, turnGatesPassed, turnThresholdsPassed, hasTurnGates, hasTurnThresholds };
}

function checkThresholdPassed(score: number, threshold: ThresholdConfig): boolean {
  if (typeof threshold === 'number') {
    return score >= threshold;
  }
  if (threshold.min !== undefined && score < threshold.min) return false;
  if (threshold.max !== undefined && score > threshold.max) return false;
  return true;
}

function isScorerWithThreshold(entry: ScorerEntry): entry is ScorerWithThreshold {
  return typeof entry === 'object' && 'scorer' in entry && 'threshold' in entry;
}

function validateThresholdBound(value: number, label: string, scorerId: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'INVALID_SCORER_THRESHOLD',
      category: 'USER',
      text: `${label} threshold for scorer "${scorerId}" must be a finite number between 0 and 1, got ${value}`,
    });
  }
}

function validateThresholdConfig(threshold: ThresholdConfig, scorerId: string): void {
  if (typeof threshold === 'number') {
    validateThresholdBound(threshold, 'Minimum', scorerId);
    return;
  }
  if (threshold.min !== undefined) {
    validateThresholdBound(threshold.min, 'Minimum', scorerId);
  }
  if (threshold.max !== undefined) {
    validateThresholdBound(threshold.max, 'Maximum', scorerId);
  }
  if (threshold.min !== undefined && threshold.max !== undefined && threshold.min > threshold.max) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'INVALID_SCORER_THRESHOLD',
      category: 'USER',
      text: `Threshold for scorer "${scorerId}" has min (${threshold.min}) greater than max (${threshold.max})`,
    });
  }
}

function normalizeScorerEntries(
  scorers: ScorerEntry[] | MastraScorer<any, any, any, any>[] | WorkflowScorerConfig | AgentScorerConfig,
): {
  bareScorers: MastraScorer<any, any, any, any>[] | WorkflowScorerConfig | AgentScorerConfig;
  thresholdMap: Map<string, ThresholdConfig>;
} {
  const thresholdMap = new Map<string, ThresholdConfig>();

  // Non-array configs (WorkflowScorerConfig / AgentScorerConfig) pass through unchanged
  if (!Array.isArray(scorers)) {
    return { bareScorers: scorers, thresholdMap };
  }

  const bareScorers: MastraScorer<any, any, any, any>[] = [];
  for (const entry of scorers) {
    if (isScorerWithThreshold(entry)) {
      validateThresholdConfig(entry.threshold, entry.scorer.id);
      bareScorers.push(entry.scorer);
      thresholdMap.set(entry.scorer.id, entry.threshold);
    } else {
      bareScorers.push(entry);
    }
  }

  return { bareScorers, thresholdMap };
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
  gates?: MastraScorer<any, any, any, any>[],
): void {
  const hasGates = !!gates && gates.length > 0;
  if (data.length === 0) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'RUN_EXPERIMENT_FAILED_NO_DATA_PROVIDED',
      category: 'USER',
      text: 'Failed to run experiment: Data array is empty',
    });
  }

  // Tracks whether any data item carries per-turn gates/scorers, which (like
  // top-level scorers/gates) satisfies the "at least one scorer or gate" rule.
  let hasAnyTurnAssertions = false;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== 'object' || (!('input' in item) && !('inputs' in item) && !('turns' in item))) {
      throw new MastraError({
        domain: 'SCORER',
        id: 'INVALID_DATA_ITEM',
        category: 'USER',
        text: `Invalid data item at index ${i}: must have 'input', 'inputs', or 'turns' property`,
      });
    }
    if ('inputs' in item) {
      if (!Array.isArray(item.inputs) || item.inputs.length === 0) {
        throw new MastraError({
          domain: 'SCORER',
          id: 'INVALID_DATA_ITEM',
          category: 'USER',
          text: `Invalid data item at index ${i}: 'inputs' must be a non-empty array`,
        });
      }
      if (isWorkflow(target)) {
        throw new MastraError({
          domain: 'SCORER',
          id: 'INVALID_DATA_ITEM',
          category: 'USER',
          text: `Invalid data item at index ${i}: 'inputs' is not supported for Workflow targets`,
        });
      }
    }
    if ('turns' in item) {
      if (isWorkflow(target)) {
        throw new MastraError({
          domain: 'SCORER',
          id: 'INVALID_DATA_ITEM',
          category: 'USER',
          text: `Invalid data item at index ${i}: 'turns' is not supported for Workflow targets`,
        });
      }
      if ('input' in item || 'inputs' in item) {
        throw new MastraError({
          domain: 'SCORER',
          id: 'INVALID_DATA_ITEM',
          category: 'USER',
          text: `Invalid data item at index ${i}: 'turns' cannot be combined with 'input' or 'inputs'`,
        });
      }
      const turns = (item as { turns?: unknown }).turns;
      if (!Array.isArray(turns) || turns.length === 0) {
        throw new MastraError({
          domain: 'SCORER',
          id: 'INVALID_DATA_ITEM',
          category: 'USER',
          text: `Invalid data item at index ${i}: 'turns' must be a non-empty array`,
        });
      }
      for (let t = 0; t < turns.length; t++) {
        const turn = turns[t];
        if (!turn || typeof turn !== 'object' || !('input' in turn)) {
          throw new MastraError({
            domain: 'SCORER',
            id: 'INVALID_DATA_ITEM',
            category: 'USER',
            text: `Invalid data item at index ${i}: turn ${t} must be an object with an 'input' property`,
          });
        }
        if (Array.isArray(turn.gates) && turn.gates.length > 0) {
          hasAnyTurnAssertions = true;
        }
        if (Array.isArray(turn.scorers) && turn.scorers.length > 0) {
          hasAnyTurnAssertions = true;
          // Validate per-turn threshold bounds upfront so errors surface before execution.
          for (const entry of turn.scorers) {
            if (isScorerWithThreshold(entry)) {
              validateThresholdConfig(entry.threshold, entry.scorer.id);
            }
          }
        }
      }
    }
  }

  // Validate scorers
  if (Array.isArray(scorers)) {
    // Gate-only runs are valid: a non-empty gates array satisfies the
    // "at least one scorer" requirement even when scorers is empty.
    // Per-turn gates/scorers also satisfy it.
    if (scorers.length === 0 && !hasGates && !hasAnyTurnAssertions) {
      throw new MastraError({
        domain: 'SCORER',
        id: 'NO_SCORERS_PROVIDED',
        category: 'USER',
        text: 'At least one scorer or gate must be provided',
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
  targetOptions?: RunEvalsAgentOptions | WorkflowRunOptions,
) {
  try {
    if (isWorkflow(target)) {
      return await executeWorkflow(target, item, targetOptions as WorkflowRunOptions);
    } else if (item.turns && Array.isArray(item.turns) && item.turns.length > 0) {
      return await executeAgentTurns(target, item, targetOptions as RunEvalsAgentOptions);
    } else if (item.inputs && Array.isArray(item.inputs) && item.inputs.length > 0) {
      return await executeAgentMultiTurn(target, item, targetOptions as RunEvalsAgentOptions);
    } else {
      return await executeAgent(target, item, targetOptions as RunEvalsAgentOptions);
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

async function executeAgent(agent: Agent, item: RunEvalsDataItem<any>, targetOptions?: RunEvalsAgentOptions) {
  const observabilityContext = resolveObservabilityContext(item);
  const model = await agent.getModel();
  if (isSupportedLanguageModel(model)) {
    const { structuredOutput, memory, ...restOptions } = targetOptions ?? {};
    const baseOptions = {
      ...restOptions,
      ...observabilityContext,
      scorers: {},
      returnScorerData: true,
      requestContext: item.requestContext,
      // Single-turn does not own a thread, so a caller-supplied memory must carry
      // its own thread (the runEvals-level thread relaxation only applies to the
      // multi-turn `inputs`/`turns` paths, which inject a shared thread per item).
      ...(memory ? { memory: memory as AgentMemoryOption } : {}),
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

/** Per-turn execution record: the turn's input, its own output, and trace metadata. */
type PerTurnRecord = {
  input: AgentInputType;
  output: any;
  traceId?: string;
  spanId?: string;
  threadId?: string;
  entityType: EntityType;
};

/**
 * Runs a sequence of inputs against an agent on a single shared thread, returning
 * both the accumulated output (for holistic scoring) and each turn's individual
 * output (for per-turn assertions). Warns when the agent has no memory configured,
 * since the shared thread only recalls history when memory is present.
 */
async function runAgentTurns(
  agent: Agent,
  inputs: AgentInputType[],
  item: RunEvalsDataItem<any>,
  targetOptions?: RunEvalsAgentOptions,
): Promise<{ allOutputMessages: any[]; perTurn: PerTurnRecord[]; lastResult: any }> {
  const observabilityContext = resolveObservabilityContext(item);
  const model = await agent.getModel();
  const threadId = randomUUID();
  const supported = isSupportedLanguageModel(model);

  // Multi-turn recall requires a configured memory store: the shared threadId is
  // what lets turn N see turns 1..N-1. Without memory each turn runs in isolation.
  const memory = await agent.getMemory({ requestContext: item.requestContext });
  if (!memory) {
    agent
      .getMastraInstance()
      ?.getLogger()
      ?.warn?.(
        `runEvals multi-turn: agent "${agent.id}" has no memory configured, so turns will not share conversation history. ` +
          `Each input runs in isolation. Configure a memory store on the agent for the agent to recall earlier turns.`,
      );
  }

  const { structuredOutput, memory: callerMemory, ...restOptions } = targetOptions ?? ({} as any);

  // Mastra memory persists and recalls messages per (resource, thread). runEvals
  // owns the thread (one per data item), so callers only supply a resource when
  // they want a specific one; otherwise we default the resource to the thread id
  // so each conversation is isolated and cross-turn recall works out of the box.
  const resourceId = callerMemory?.resource ?? threadId;
  const turnMemory = { ...callerMemory, thread: threadId, resource: resourceId };

  const allOutputMessages: any[] = [];
  const perTurn: PerTurnRecord[] = [];
  let lastResult: any = undefined;

  for (const turnInput of inputs) {
    let result: any;
    if (supported) {
      const baseOptions = {
        ...restOptions,
        ...observabilityContext,
        scorers: {},
        returnScorerData: true,
        requestContext: item.requestContext,
        memory: turnMemory,
      };
      result = structuredOutput
        ? await agent.generate(turnInput, { ...baseOptions, structuredOutput })
        : await agent.generate(turnInput, baseOptions);
    } else {
      result = await agent.generateLegacy(turnInput, {
        ...restOptions,
        scorers: {},
        returnScorerData: true,
        requestContext: item.requestContext,
        memory: turnMemory,
        ...observabilityContext,
      });
    }

    lastResult = result;

    const turnOutput = result.scoringData?.output;
    if (turnOutput) {
      allOutputMessages.push(...(Array.isArray(turnOutput) ? turnOutput : [turnOutput]));
    }
    perTurn.push({
      input: turnInput,
      output: turnOutput,
      traceId: result.traceId,
      spanId: result.spanId,
      threadId,
      entityType: EntityType.AGENT,
    });
  }

  return { allOutputMessages, perTurn, lastResult };
}

/**
 * Executes multiple turns against an agent on the same thread, accumulating
 * all output messages for scoring. Each entry in `item.inputs` is sent
 * sequentially via agent.generate() with the same threadId.
 */
async function executeAgentMultiTurn(agent: Agent, item: RunEvalsDataItem<any>, targetOptions?: RunEvalsAgentOptions) {
  const inputs: AgentInputType[] = item.inputs!;
  const { allOutputMessages, lastResult } = await runAgentTurns(agent, inputs, item, targetOptions);

  return {
    ...lastResult,
    entityType: EntityType.AGENT,
    scoringData: {
      ...lastResult?.scoringData,
      input: inputs[0], // First input as the "input" for scoring context
      output: allOutputMessages,
    },
  };
}

/**
 * Executes a conversation with per-turn assertions. Each turn is sent sequentially
 * on the same thread; the returned `perTurn` records let the caller score each turn
 * against only its own input/output.
 */
async function executeAgentTurns(agent: Agent, item: RunEvalsDataItem<any>, targetOptions?: RunEvalsAgentOptions) {
  const turns: EvalTurn[] = item.turns!;
  const inputs = turns.map(t => t.input);
  const { allOutputMessages, perTurn, lastResult } = await runAgentTurns(agent, inputs, item, targetOptions);

  return {
    ...lastResult,
    entityType: EntityType.AGENT,
    scoringData: {
      ...lastResult?.scoringData,
      input: inputs[0],
      output: allOutputMessages,
    },
    perTurn,
  };
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
  turn,
}: {
  storage: any;
  scoreResult: any;
  scorerId: string;
  entityId: string;
  entityType: string;
  mastra: any;
  target: Agent | Workflow;
  item: RunEvalsDataItem<any>;
  /** Per-turn provenance: labels the stored score with its turn index and links it to that turn's span/thread. */
  turn?: { index: number; traceId?: string; spanId?: string; threadId?: string };
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

    // Extract tracing context if available. A per-turn score links to that turn's
    // own span/thread; otherwise fall back to the item-level tracing context.
    let traceId: string | undefined;
    let spanId: string | undefined;
    if (turn?.traceId || turn?.spanId) {
      traceId = turn.traceId;
      spanId = turn.spanId;
    } else if (item.tracingContext?.currentSpan && item.tracingContext.currentSpan.isValid) {
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
      // Per-turn scores carry their turn index in metadata for UI grouping/labeling.
      // Merge onto any existing score metadata; the system-owned turnIndex is applied
      // last so it always wins over a caller-supplied `turnIndex`.
      ...(turn ? { metadata: { ...(scoreResult?.metadata ?? {}), turnIndex: turn.index } } : {}),
      ...(turn?.threadId ? { threadId: turn.threadId } : {}),
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
