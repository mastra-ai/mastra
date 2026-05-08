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
  // Spread all variant-specific fields directly — ExpectedStep mirrors TrajectoryStep
  // but with all fields optional. Drop runtime-only fields (durationMs, metadata).
  const { durationMs: _, metadata: _m, children, ...rest } = step;
  const result: ExpectedStep = rest as ExpectedStep;
  // Recursively convert children so nested hierarchies are preserved
  if (children && children.length > 0) {
    result.children = {
      steps: children.map(trajectoryStepToExpectedStep),
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

  const { ordering = 'relaxed', allowRepeatedSteps = true } = comparisonOptions;

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
      return `Evaluates whether the trajectory matches the expected path: [${expectedStepNames}] (${ordering} ordering)`;
    }
    return `Evaluates trajectory accuracy against expected trajectory from dataset items (${ordering} ordering)`;
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
      const effectiveOrdering = itemExpectation?.ordering ?? ordering;
      const effectiveAllowRepeated = itemExpectation?.allowRepeatedSteps ?? allowRepeatedSteps;

      const comparison = compareTrajectories(
        actualTrajectory,
        { steps: resolvedExpectedSteps },
        {
          ordering: effectiveOrdering,
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
  weights: Required<TrajectoryScoreWeights> = { accuracy: 0.4, efficiency: 0.3, toolFailures: 0.2, blacklist: 0.1 },
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
    const nested = childConfig.steps ? evaluateNestedExpectations(childConfig.steps, actualStep.children, weights) : [];

    // Compute weighted score for this level
    const scores: Array<{ weight: number; value: number }> = [];
    if (accuracy) scores.push({ weight: weights.accuracy, value: accuracy.score });
    if (efficiency) scores.push({ weight: weights.efficiency, value: efficiency.score });
    if (toolFailures && toolFailures.patterns.length > 0)
      scores.push({ weight: weights.toolFailures, value: toolFailures.score });
    if (blacklist) {
      if (blacklist.score === 0) {
        // Hard fail for blacklist violation at this level
        results.push({ stepName: expectedStep.name, score: 0, accuracy, efficiency, blacklist, toolFailures, nested });
        continue;
      }
      scores.push({ weight: weights.blacklist, value: blacklist.score });
    }

    let levelScore = 1;
    if (scores.length > 0) {
      const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
      levelScore = totalWeight > 0 ? scores.reduce((sum, s) => sum + (s.weight / totalWeight) * s.value, 0) : 1;
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

export interface TrajectoryScoreWeights {
  /** Weight for accuracy dimension (default: 0.4) */
  accuracy?: number;
  /** Weight for efficiency dimension (default: 0.3) */
  efficiency?: number;
  /** Weight for tool failures dimension (default: 0.2) */
  toolFailures?: number;
  /** Weight for blacklist dimension (default: 0.1) */
  blacklist?: number;
}

export interface TrajectoryScorerCodeOptions {
  /**
   * Default expectation config for all runs.
   * Per-item `run.expectedTrajectory` values override these defaults.
   */
  defaults?: TrajectoryExpectation;
  /**
   * Weights for combining dimension scores into the final score.
   * Only active dimensions are used — weights are normalized to sum to 1.0.
   * Blacklist violations always override to 0 regardless of weight.
   */
  weights?: TrajectoryScoreWeights;
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
 *   weights: { accuracy: 0.5, efficiency: 0.3, toolFailures: 0.1, blacklist: 0.1 },
 * });
 * ```
 */
export function createTrajectoryScorerCode(options: TrajectoryScorerCodeOptions = {}) {
  const { defaults = {}, weights: userWeights = {} } = options;
  const w = {
    accuracy: Math.max(0, userWeights.accuracy ?? 0.4),
    efficiency: Math.max(0, userWeights.efficiency ?? 0.3),
    toolFailures: Math.max(0, userWeights.toolFailures ?? 0.2),
    blacklist: Math.max(0, userWeights.blacklist ?? 0.1),
  };

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
          ? evaluateNestedExpectations(config.steps, actualTrajectory.steps, w)
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
        scores.push({ weight: w.accuracy, value: accuracy.score });
      }
      if (efficiency) {
        scores.push({ weight: w.efficiency, value: efficiency.score });
      }
      if (toolFailures && toolFailures.patterns.length > 0) {
        scores.push({ weight: w.toolFailures, value: toolFailures.score });
      }
      if (blacklist) {
        scores.push({ weight: w.blacklist, value: blacklist.score });
      }

      if (scores.length === 0 && !nested) {
        // No dimensions active — just tool failures with no patterns means clean pass
        return 1;
      }

      let levelScore = 1;
      if (scores.length > 0) {
        const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
        levelScore = totalWeight > 0 ? scores.reduce((sum, s) => sum + (s.weight / totalWeight) * s.value, 0) : 1;
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
    })
    .generateReason(({ results, score }) => {
      const { accuracy, efficiency, blacklist, toolFailures, nested } = results.preprocessStepResult ?? {};
      const parts: string[] = [];

      parts.push(`Score: ${score}`);

      // Blacklist hard fail
      if (blacklist && blacklist.score === 0) {
        const violations: string[] = [];
        if (blacklist.violatedTools.length > 0) {
          violations.push(`forbidden tools used: ${blacklist.violatedTools.join(', ')}`);
        }
        if (blacklist.violatedSequences.length > 0) {
          violations.push(`forbidden sequences: ${blacklist.violatedSequences.map(s => s.join(' → ')).join('; ')}`);
        }
        parts.push(`Blacklist violation: ${violations.join('. ')}.`);
        return parts.join('\n');
      }

      // Check nested blacklist hard fail
      if (nested && nested.some(r => r.blacklist && r.blacklist.score === 0)) {
        const violating = nested.filter(r => r.blacklist && r.blacklist.score === 0).map(r => r.stepName);
        parts.push(`Nested blacklist violation in: ${violating.join(', ')}.`);
        return parts.join('\n');
      }

      // Accuracy
      if (accuracy) {
        const details: string[] = [`${accuracy.matchedSteps}/${accuracy.totalExpectedSteps} expected steps matched`];
        if (accuracy.missingSteps.length > 0) {
          details.push(`missing: ${accuracy.missingSteps.join(', ')}`);
        }
        if (accuracy.extraSteps.length > 0) {
          details.push(`extra: ${accuracy.extraSteps.join(', ')}`);
        }
        if (accuracy.outOfOrderSteps.length > 0) {
          details.push(`out of order: ${accuracy.outOfOrderSteps.join(', ')}`);
        }
        parts.push(`Accuracy (${accuracy.score}): ${details.join('. ')}.`);
      }

      // Efficiency
      if (efficiency) {
        const details: string[] = [];
        if (efficiency.overStepBudget) {
          details.push(`over step budget (${efficiency.totalSteps} steps)`);
        }
        if (efficiency.overTokenBudget) {
          details.push(`over token budget (${efficiency.totalTokens} tokens)`);
        }
        if (efficiency.overDurationBudget) {
          details.push(`over duration budget (${efficiency.totalDurationMs}ms)`);
        }
        if (efficiency.redundantCalls.length > 0) {
          details.push(`redundant calls: ${efficiency.redundantCalls.map(c => c.name).join(', ')}`);
        }
        if (details.length > 0) {
          parts.push(`Efficiency (${efficiency.score}): ${details.join('. ')}.`);
        } else {
          parts.push(`Efficiency (${efficiency.score}): all budgets met, no redundant calls.`);
        }
      }

      // Tool failures
      if (toolFailures && toolFailures.patterns.length > 0) {
        const details: string[] = [];
        if (toolFailures.totalRetries > 0) {
          details.push(`${toolFailures.totalRetries} total retries`);
        }
        if (toolFailures.excessiveRetryTools.length > 0) {
          details.push(`excessive retries: ${toolFailures.excessiveRetryTools.join(', ')}`);
        }
        parts.push(`Tool failures (${toolFailures.score}): ${details.join('. ')}.`);
      }

      // Nested
      if (nested && nested.length > 0) {
        const nestedSummary = nested.map(r => `${r.stepName}: ${r.score}`).join(', ');
        parts.push(`Nested scores: ${nestedSummary}.`);
      }

      return parts.join('\n');
    });
}
