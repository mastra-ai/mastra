import type {
  ExpectedStep,
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
   * Accepts a Trajectory (full trajectory steps) or ExpectedStep[] (lightweight matchers).
   * If not provided, the scorer will use `run.expectedTrajectory` from the dataset item.
   */
  expectedTrajectory?: Trajectory | ExpectedStep[];
  /** Comparison behavior options */
  comparisonOptions?: TrajectoryComparisonOptions;
}

/**
 * Convert a TrajectoryStep to an ExpectedStep, preserving step-specific data.
 */
function trajectoryStepToExpectedStep(step: TrajectoryStep): ExpectedStep {
  const result: ExpectedStep = { name: step.name, stepType: step.stepType };
  const data: Record<string, unknown> = {};
  if (step.stepType === 'tool_call' || step.stepType === 'mcp_tool_call') {
    if (step.toolArgs !== undefined) data.input = step.toolArgs;
    if (step.toolResult !== undefined) data.output = step.toolResult;
  } else if (step.stepType === 'workflow_step') {
    if (step.output !== undefined) data.output = step.output;
  }
  if (Object.keys(data).length > 0) result.data = data;
  // Recursively convert children so nested hierarchies are preserved
  if (step.children && step.children.length > 0) {
    result.children = {
      steps: step.children.map(trajectoryStepToExpectedStep),
    };
  }
  return result;
}

/**
 * Resolve a TrajectoryExpectation (from dataset item) into expected steps
 * suitable for comparison.
 */
function expectationToExpectedSteps(expectation: TrajectoryExpectation): ExpectedStep[] | undefined {
  if (!expectation.steps || expectation.steps.length === 0) return undefined;
  return expectation.steps;
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

  // Normalize the static expected trajectory into ExpectedStep[]
  const staticExpectedSteps: ExpectedStep[] | undefined = staticExpectedTrajectory
    ? Array.isArray(staticExpectedTrajectory) &&
      staticExpectedTrajectory.length > 0 &&
      !('steps' in staticExpectedTrajectory[0]! || false)
      ? (staticExpectedTrajectory as ExpectedStep[])
      : 'steps' in staticExpectedTrajectory
        ? (staticExpectedTrajectory as Trajectory).steps.map(trajectoryStepToExpectedStep)
        : undefined
    : undefined;

  const getDescription = () => {
    if (staticExpectedSteps) {
      const expectedStepNames = staticExpectedSteps.map((s: ExpectedStep) => s.name).join(' → ');
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

      // Resolve expected steps: prefer constructor option, fallback to dataset item
      let resolvedExpectedSteps: ExpectedStep[] | undefined = staticExpectedSteps;
      if (!resolvedExpectedSteps && run.expectedTrajectory) {
        const expectation = run.expectedTrajectory as TrajectoryExpectation;
        resolvedExpectedSteps = expectationToExpectedSteps(expectation);
      }

      if (!resolvedExpectedSteps || resolvedExpectedSteps.length === 0) {
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

      const comparison = compareTrajectories(
        actualTrajectory,
        { steps: resolvedExpectedSteps },
        {
          ordering: effectiveOrdering,
          compareStepData: effectiveCompareData,
          allowRepeatedSteps: effectiveAllowRepeated,
        },
      );

      return {
        actualTrajectory,
        expectedTrajectory: { steps: resolvedExpectedSteps },
        comparison,
        actualStepNames: actualTrajectory.steps.map((s: TrajectoryStep) => s.name),
        expectedStepNames: resolvedExpectedSteps.map((s: ExpectedStep) => s.name),
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
 * Result from evaluating a nested step's children against its TrajectoryExpectation.
 */
export type NestedEvaluationResult = {
  /** Name of the expected step that contained the nested config */
  stepName: string;
  /** Score for this nested evaluation (0.0 - 1.0) */
  score: number;
  /** Accuracy result for the children */
  accuracy?: TrajectoryComparisonResult;
  /** Efficiency result for the children */
  efficiency?: TrajectoryEfficiencyResult;
  /** Blacklist result for the children */
  blacklist?: TrajectoryBlacklistResult;
  /** Tool failure result for the children */
  toolFailures?: ToolFailureAnalysisResult;
  /** Further nested results from deeper levels */
  nested?: NestedEvaluationResult[];
};

/**
 * Evaluates nested expectations: for each expected step with a `children` config,
 * finds the matching actual step and recursively evaluates its children.
 */
function evaluateNestedExpectations(
  expectedSteps: ExpectedStep[],
  actualSteps: TrajectoryStep[],
): NestedEvaluationResult[] {
  const results: NestedEvaluationResult[] = [];
  const matchedIndices = new Set<number>();

  for (const expectedStep of expectedSteps) {
    if (!expectedStep.children) continue;

    // Find the first unmatched actual step that satisfies name/type
    const matchIndex = actualSteps.findIndex(
      (s, i) =>
        !matchedIndices.has(i) &&
        s.name === expectedStep.name &&
        (!expectedStep.stepType || s.stepType === expectedStep.stepType),
    );
    const actualStep = matchIndex >= 0 ? actualSteps[matchIndex] : undefined;
    if (matchIndex >= 0) matchedIndices.add(matchIndex);

    if (!actualStep?.children || actualStep.children.length === 0) {
      // Matched step has no children — nested evaluation fails
      const expectedStepCount = expectedStep.children.steps?.length ?? 0;
      results.push({
        stepName: expectedStep.name,
        score: 0,
        accuracy:
          expectedStepCount > 0
            ? {
                score: 0,
                matchedSteps: 0,
                totalExpectedSteps: expectedStepCount,
                totalActualSteps: 0,
                missingSteps: expectedStep.children.steps!.map(s => s.name),
                extraSteps: [],
                outOfOrderSteps: [],
                repeatedSteps: [],
              }
            : undefined,
      });
      continue;
    }

    const childTrajectory: Trajectory = {
      steps: actualStep.children,
      totalDurationMs: actualStep.durationMs,
    };
    const childConfig = expectedStep.children;

    // --- Accuracy ---
    let accuracy: TrajectoryComparisonResult | undefined;
    if (childConfig.steps && childConfig.steps.length > 0) {
      accuracy = compareTrajectories(
        childTrajectory,
        { steps: childConfig.steps },
        {
          ordering: childConfig.ordering ?? 'relaxed',
          compareStepData: childConfig.compareStepData ?? false,
          allowRepeatedSteps: childConfig.allowRepeatedSteps ?? true,
        },
      );
    }

    // --- Efficiency ---
    const hasEfficiencyConfig =
      childConfig.maxSteps !== undefined ||
      childConfig.maxTotalTokens !== undefined ||
      childConfig.maxTotalDurationMs !== undefined ||
      childConfig.noRedundantCalls !== undefined;
    const efficiency = hasEfficiencyConfig
      ? checkTrajectoryEfficiency(childTrajectory, {
          maxSteps: childConfig.maxSteps,
          maxTotalTokens: childConfig.maxTotalTokens,
          maxTotalDurationMs: childConfig.maxTotalDurationMs,
          noRedundantCalls: childConfig.noRedundantCalls ?? true,
        })
      : undefined;

    // --- Blacklist ---
    const hasBlacklistConfig =
      (childConfig.blacklistedTools && childConfig.blacklistedTools.length > 0) ||
      (childConfig.blacklistedSequences && childConfig.blacklistedSequences.length > 0);
    const blacklist = hasBlacklistConfig
      ? checkTrajectoryBlacklist(childTrajectory, {
          blacklistedTools: childConfig.blacklistedTools,
          blacklistedSequences: childConfig.blacklistedSequences,
        })
      : undefined;

    // --- Tool failures ---
    const toolFailures = analyzeToolFailures(childTrajectory, {
      maxRetriesPerTool: childConfig.maxRetriesPerTool ?? 2,
    });

    // --- Recursive nested evaluation ---
    const nested = childConfig.steps ? evaluateNestedExpectations(childConfig.steps, actualStep.children) : [];

    // Compute weighted score for this level
    const scores: Array<{ weight: number; value: number }> = [];
    if (accuracy) scores.push({ weight: 0.4, value: accuracy.score });
    if (efficiency) scores.push({ weight: 0.3, value: efficiency.score });
    if (toolFailures && toolFailures.patterns.length > 0) scores.push({ weight: 0.2, value: toolFailures.score });
    if (blacklist) {
      if (blacklist.score === 0) {
        // Hard fail for blacklist violation at this level
        results.push({ stepName: expectedStep.name, score: 0, accuracy, efficiency, blacklist, toolFailures, nested });
        continue;
      }
      scores.push({ weight: 0.1, value: blacklist.score });
    }

    let levelScore = 1;
    if (scores.length > 0) {
      const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
      levelScore = scores.reduce((sum, s) => sum + (s.weight / totalWeight) * s.value, 0);
    }

    // Average with nested scores if any
    let finalScore = levelScore;
    if (nested.length > 0) {
      // Hard fail if any nested level has a blacklist violation
      const hasNestedBlacklistViolation = nested.some(r => r.blacklist && r.blacklist.score === 0);
      if (hasNestedBlacklistViolation) {
        results.push({ stepName: expectedStep.name, score: 0, accuracy, efficiency, blacklist, toolFailures, nested });
        continue;
      }

      const nestedAvg = nested.reduce((sum, r) => sum + r.score, 0) / nested.length;
      // 70% this level, 30% nested levels
      finalScore = 0.7 * levelScore + 0.3 * nestedAvg;
    }

    results.push({
      stepName: expectedStep.name,
      score: Math.round(finalScore * 100) / 100,
      accuracy,
      efficiency,
      blacklist,
      toolFailures,
      nested: nested.length > 0 ? nested : undefined,
    });
  }

  return results;
}

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
  /** Results from evaluating nested step expectations. */
  nested?: NestedEvaluationResult[];
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
        accuracy = compareTrajectories(
          actualTrajectory,
          { steps: config.steps },
          {
            ordering: config.ordering ?? 'relaxed',
            compareStepData: config.compareStepData ?? false,
            allowRepeatedSteps: config.allowRepeatedSteps ?? true,
          },
        );
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

      // --- Nested expectations ---
      const nested =
        config.steps && config.steps.length > 0
          ? evaluateNestedExpectations(config.steps, actualTrajectory.steps)
          : undefined;

      return {
        accuracy,
        efficiency,
        blacklist,
        toolFailures,
        nested: nested && nested.length > 0 ? nested : undefined,
        config,
      };
    })
    .generateScore(({ results }) => {
      const { accuracy, efficiency, blacklist, toolFailures, nested } = results.preprocessStepResult ?? {};

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

      if (scores.length === 0 && !nested) {
        // No dimensions active — just tool failures with no patterns means clean pass
        return 1;
      }

      let levelScore = 1;
      if (scores.length > 0) {
        const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
        levelScore = scores.reduce((sum, s) => sum + (s.weight / totalWeight) * s.value, 0);
      }

      // Factor in nested scores
      if (nested && nested.length > 0) {
        // Hard fail if any nested level has a blacklist violation
        const hasNestedBlacklistViolation = nested.some(r => r.blacklist && r.blacklist.score === 0);
        if (hasNestedBlacklistViolation) {
          return 0;
        }

        const nestedAvg = nested.reduce((sum, r) => sum + r.score, 0) / nested.length;
        // 70% top-level, 30% nested
        levelScore = 0.7 * levelScore + 0.3 * nestedAvg;
      }

      return Math.round(levelScore * 100) / 100;
    });
}
