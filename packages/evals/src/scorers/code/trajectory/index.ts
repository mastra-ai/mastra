import type {
  Trajectory,
  TrajectoryComparisonOptions,
  TrajectoryExpectation,
  TrajectoryStep,
} from '@mastra/core/evals';
import { createScorer } from '@mastra/core/evals';
import {
  compareTrajectories,
  checkTrajectoryEfficiency,
  checkTrajectoryBlacklist,
  analyzeToolFailures,
} from '../../utils';
import type {
  TrajectoryComparisonResult,
  TrajectoryEfficiencyResult,
  TrajectoryBlacklistResult,
  ToolFailureAnalysisResult,
} from '../../utils';

interface TrajectoryAccuracyScorerCodeOptions {
  /**
   * The expected trajectory to compare against.
   * If not provided, the scorer will use `run.expectedTrajectory` from the dataset item.
   */
  expectedTrajectory?: Trajectory;
  /** Comparison behavior options */
  comparisonOptions?: TrajectoryComparisonOptions;
}

/**
 * Resolve a TrajectoryExpectation (from dataset item) into a Trajectory object
 * suitable for comparison.
 */
function expectationToTrajectory(expectation: TrajectoryExpectation): Trajectory | undefined {
  if (!expectation.steps || expectation.steps.length === 0) return undefined;
  return { steps: expectation.steps };
}

/**
 * Creates a code-based trajectory accuracy scorer that compares the actual sequence
 * of tool calls an agent made against an expected trajectory.
 *
 * This scorer extracts the agent's tool call trajectory from its output messages
 * and compares it against a predefined expected trajectory. It supports strict,
 * relaxed, and unordered comparison modes.
 *
 * @param options - Configuration for the trajectory scorer
 * @returns A scorer that evaluates trajectory accuracy
 *
 * @example
 * ```ts
 * import { createTrajectoryAccuracyScorerCode } from '@mastra/evals/scorers';
 *
 * const scorer = createTrajectoryAccuracyScorerCode({
 *   expectedTrajectory: {
 *     steps: [
 *       { stepType: 'tool_call', name: 'search' },
 *       { stepType: 'tool_call', name: 'summarize' },
 *     ],
 *   },
 *   comparisonOptions: {
 *     ordering: 'relaxed',
 *     allowRepeatedSteps: true,
 *   },
 * });
 *
 * const result = await scorer.run(agentRun);
 * // result.score: 0.0 - 1.0
 * // result.preprocessStepResult.comparison: detailed comparison results
 * ```
 */
export function createTrajectoryAccuracyScorerCode(options: TrajectoryAccuracyScorerCodeOptions = {}) {
  const { expectedTrajectory: staticExpectedTrajectory, comparisonOptions = {} } = options;

  const { ordering, strictOrder, compareStepData = false, allowRepeatedSteps = true } = comparisonOptions;

  // Resolve ordering for display
  const resolvedOrdering = ordering ?? (strictOrder ? 'strict' : 'relaxed');

  const getDescription = () => {
    if (staticExpectedTrajectory) {
      const expectedStepNames = staticExpectedTrajectory.steps.map((s: TrajectoryStep) => s.name).join(' → ');
      return `Evaluates whether the trajectory matches the expected path: [${expectedStepNames}] (${resolvedOrdering} ordering)`;
    }
    return `Evaluates trajectory accuracy against expected trajectory from dataset items (${resolvedOrdering} ordering)`;
  };

  return createScorer({
    id: 'code-trajectory-accuracy-scorer',
    name: 'Trajectory Accuracy Scorer',
    description: getDescription(),
    type: 'trajectory',
  })
    .preprocess(async ({ run }) => {
      // run.output is a Trajectory (pre-extracted by runEvals pipeline)
      const actualTrajectory: Trajectory = run.output;

      // Resolve expectedTrajectory: prefer constructor option, fallback to dataset item
      let resolvedExpectedTrajectory: Trajectory | undefined = staticExpectedTrajectory;
      if (!resolvedExpectedTrajectory && run.expectedTrajectory) {
        // run.expectedTrajectory is a TrajectoryExpectation — extract the Trajectory from it
        const expectation = run.expectedTrajectory as TrajectoryExpectation;
        resolvedExpectedTrajectory = expectationToTrajectory(expectation);
      }

      if (!resolvedExpectedTrajectory) {
        return {
          actualTrajectory,
          expectedTrajectory: undefined,
          comparison: undefined,
          actualStepNames: actualTrajectory.steps.map((s: TrajectoryStep) => s.name),
          expectedStepNames: [],
          error: 'No expected trajectory provided (pass via options or dataset item expectedTrajectory)',
        };
      }

      // Merge comparison options: dataset item ordering overrides constructor if present
      const itemExpectation = run.expectedTrajectory as TrajectoryExpectation | undefined;
      const effectiveOrdering = itemExpectation?.ordering ?? resolvedOrdering;
      const effectiveCompareData = itemExpectation?.compareStepData ?? compareStepData;
      const effectiveAllowRepeated = itemExpectation?.allowRepeatedSteps ?? allowRepeatedSteps;

      const comparison = compareTrajectories(actualTrajectory, resolvedExpectedTrajectory, {
        ordering: effectiveOrdering,
        compareStepData: effectiveCompareData,
        allowRepeatedSteps: effectiveAllowRepeated,
      });

      return {
        actualTrajectory,
        expectedTrajectory: resolvedExpectedTrajectory,
        comparison,
        actualStepNames: actualTrajectory.steps.map((s: TrajectoryStep) => s.name),
        expectedStepNames: resolvedExpectedTrajectory.steps.map((s: TrajectoryStep) => s.name),
      };
    })
    .generateScore(({ results }) => {
      const preprocessResult = results.preprocessStepResult;
      if (!preprocessResult || !preprocessResult.comparison) {
        return 0;
      }

      return preprocessResult.comparison.score;
    });
}

// ─── Unified Trajectory Scorer ───

/**
 * Multi-dimensional result from the unified trajectory scorer.
 */
export type TrajectoryScoreResult = {
  /** Overall score (0.0 - 1.0). Weighted combination of dimensions (0.0 if blacklist violation). */
  score: number;
  /** Accuracy sub-score (step matching). Only present if expected steps were provided. */
  accuracy?: TrajectoryComparisonResult;
  /** Efficiency sub-score (budgets + redundancy). */
  efficiency?: TrajectoryEfficiencyResult;
  /** Blacklist sub-score (forbidden tools/sequences). */
  blacklist?: TrajectoryBlacklistResult;
  /** Tool failure analysis. */
  toolFailures?: ToolFailureAnalysisResult;
};

interface TrajectoryScorerCodeOptions {
  /**
   * Default expectation config for all runs.
   * Per-item `run.expectedTrajectory` values override these defaults.
   */
  defaults?: TrajectoryExpectation;
}

/**
 * Creates a unified trajectory scorer that evaluates multiple dimensions:
 * accuracy (step matching), efficiency (budgets, redundancy), blacklist (forbidden tools/sequences),
 * and tool failure patterns.
 *
 * Configuration can be set at two levels:
 * - **Constructor defaults** (`defaults`) — agent-level defaults for all dataset items
 * - **Per-item overrides** (`run.expectedTrajectory`) — prompt-specific overrides from dataset items
 *
 * Per-item values override constructor defaults for all fields.
 *
 * @param options - Default trajectory expectations
 * @returns A scorer with multi-dimensional trajectory evaluation
 *
 * @example
 * ```ts
 * import { createTrajectoryScorerCode } from '@mastra/evals/scorers';
 *
 * const scorer = createTrajectoryScorerCode({
 *   defaults: {
 *     steps: [
 *       { stepType: 'tool_call', name: 'search' },
 *       { stepType: 'tool_call', name: 'summarize' },
 *     ],
 *     ordering: 'relaxed',
 *     maxSteps: 5,
 *     noRedundantCalls: true,
 *     blacklistedTools: ['deleteAll'],
 *   },
 * });
 * ```
 */
export function createTrajectoryScorerCode(options: TrajectoryScorerCodeOptions = {}) {
  const { defaults = {} } = options;

  return createScorer({
    id: 'code-trajectory-scorer',
    name: 'Trajectory Scorer',
    description: 'Multi-dimensional trajectory evaluation: accuracy, efficiency, blacklist, and tool failures',
    type: 'trajectory',
  })
    .preprocess(async ({ run }) => {
      const actualTrajectory: Trajectory = run.output;

      // Merge defaults with per-item overrides (per-item wins)
      const itemExpectation = (run.expectedTrajectory ?? {}) as TrajectoryExpectation;
      const config: TrajectoryExpectation = { ...defaults, ...itemExpectation };
      // Merge steps: per-item steps override defaults entirely (not merged)
      if (itemExpectation.steps !== undefined) {
        config.steps = itemExpectation.steps;
      }

      // --- Accuracy ---
      let accuracy: TrajectoryComparisonResult | undefined;
      if (config.steps && config.steps.length > 0) {
        const expectedTrajectory: Trajectory = { steps: config.steps };
        accuracy = compareTrajectories(actualTrajectory, expectedTrajectory, {
          ordering: config.ordering ?? 'relaxed',
          compareStepData: config.compareStepData ?? false,
          allowRepeatedSteps: config.allowRepeatedSteps ?? true,
        });
      }

      // --- Efficiency ---
      const hasEfficiencyConfig =
        config.maxSteps !== undefined ||
        config.maxTotalTokens !== undefined ||
        config.maxTotalDurationMs !== undefined ||
        config.noRedundantCalls !== undefined;
      const efficiency = hasEfficiencyConfig
        ? checkTrajectoryEfficiency(actualTrajectory, {
            maxSteps: config.maxSteps,
            maxTotalTokens: config.maxTotalTokens,
            maxTotalDurationMs: config.maxTotalDurationMs,
            noRedundantCalls: config.noRedundantCalls ?? true,
          })
        : undefined;

      // --- Blacklist ---
      const hasBlacklistConfig =
        (config.blacklistedTools && config.blacklistedTools.length > 0) ||
        (config.blacklistedSequences && config.blacklistedSequences.length > 0);
      const blacklist = hasBlacklistConfig
        ? checkTrajectoryBlacklist(actualTrajectory, {
            blacklistedTools: config.blacklistedTools,
            blacklistedSequences: config.blacklistedSequences,
          })
        : undefined;

      // --- Tool failures ---
      const toolFailures = analyzeToolFailures(actualTrajectory, {
        maxRetriesPerTool: config.maxRetriesPerTool ?? 2,
      });

      return {
        accuracy,
        efficiency,
        blacklist,
        toolFailures,
        config,
      };
    })
    .generateScore(({ results }) => {
      const { accuracy, efficiency, blacklist, toolFailures } = results.preprocessStepResult ?? {};

      // Hard fail: blacklist violation → 0.0
      if (blacklist && blacklist.score === 0) {
        return 0;
      }

      // Weighted combination of active dimensions
      const scores: Array<{ weight: number; value: number }> = [];

      if (accuracy) {
        scores.push({ weight: 0.4, value: accuracy.score });
      }
      if (efficiency) {
        scores.push({ weight: 0.3, value: efficiency.score });
      }
      if (toolFailures && toolFailures.patterns.length > 0) {
        scores.push({ weight: 0.2, value: toolFailures.score });
      }
      if (blacklist) {
        scores.push({ weight: 0.1, value: blacklist.score });
      }

      if (scores.length === 0) {
        // No dimensions active — just tool failures with no patterns means clean pass
        return 1;
      }

      // Normalize weights
      const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
      const weightedScore = scores.reduce((sum, s) => sum + (s.weight / totalWeight) * s.value, 0);

      return Math.round(weightedScore * 100) / 100;
    });
}
