/**
 * Trajectory Efficiency Scorer (Offline, Experiment-only)
 *
 * Measures how efficiently the agent accomplished the task:
 * - Step ratio: actual steps / ideal steps
 * - Tool call ratio: actual calls / minimum needed
 * - Latency ratio: actual time / expected time
 * - Redundancy: repeated identical operations
 * - Solve rate: binary — did it complete the task?
 *
 * Inspired by LangChain's eval metrics for coding agents.
 * Requires ground truth with maxTurns/maxToolCalls/maxDurationMs set.
 */

import { createScorer } from '@mastra/core/evals';
import type { MastraCodeExperimentOutput, ToolCallRecord } from '../../experiments/lifecycle';
import type { MastraCodeGroundTruth } from '../../experiments/types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━��━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WEIGHTS = {
  /** Did the task complete at all? (binary) */
  solveRate: 0.3,
  /** Actual tool calls vs expected minimum. */
  toolCallRatio: 0.25,
  /** Actual turns vs expected maximum. */
  stepRatio: 0.2,
  /** Repeated identical tool calls. */
  redundancy: 0.15,
  /** Actual time vs expected maximum. */
  latencyRatio: 0.1,
} as const;

const THRESHOLDS = {
  /** How many consecutive identical tool calls count as redundant. */
  redundancyMinRepeat: 2,
  /** Ratio beyond which we penalize (e.g., 2x expected = 0.5 score on that dim). */
  maxRatio: 3.0,
} as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scorer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function createTrajectoryEfficiencyScorer() {
  return createScorer({
    id: 'mastracode-trajectory-efficiency',
    name: 'Trajectory Efficiency',
    description: 'Measures how efficiently the agent completed the task vs expected bounds.',
  })
    .preprocess(async ({ run }) => {
      const output = run.output as MastraCodeExperimentOutput | null;
      const groundTruth = run.groundTruth as MastraCodeGroundTruth | undefined;

      if (!output || !groundTruth) {
        return { skipped: true, reason: 'No output or ground truth' };
      }

      // === Solve rate (binary) ===
      const solved = output.errors.length === 0;
      const solveRate = solved ? 1.0 : 0.0;

      // === Tool call ratio ===
      let toolCallRatio = 1.0;
      if (groundTruth.maxToolCalls && groundTruth.maxToolCalls > 0) {
        const actual = output.toolCalls.length;
        const expected = groundTruth.maxToolCalls;
        toolCallRatio = ratioScore(actual, expected);
      }

      // === Step ratio ===
      let stepRatio = 1.0;
      if (groundTruth.maxTurns && groundTruth.maxTurns > 0) {
        const actual = countAssistantTurns(output);
        const expected = groundTruth.maxTurns;
        stepRatio = ratioScore(actual, expected);
      }

      // === Redundancy ===
      const redundancy = scoreRedundancy(output.toolCalls);

      // === Latency ratio ===
      let latencyRatio = 1.0;
      if (groundTruth.maxDurationMs && groundTruth.maxDurationMs > 0) {
        const actual = output.completedAt - output.startedAt;
        const expected = groundTruth.maxDurationMs;
        latencyRatio = ratioScore(actual, expected);
      }

      // Track which dimensions have ground truth bounds
      const hasToolCallBound = !!(groundTruth.maxToolCalls && groundTruth.maxToolCalls > 0);
      const hasStepBound = !!(groundTruth.maxTurns && groundTruth.maxTurns > 0);
      const hasLatencyBound = !!(groundTruth.maxDurationMs && groundTruth.maxDurationMs > 0);

      return {
        skipped: false,
        solveRate,
        toolCallRatio: hasToolCallBound ? toolCallRatio : null,
        stepRatio: hasStepBound ? stepRatio : null,
        redundancy,
        latencyRatio: hasLatencyBound ? latencyRatio : null,
        // Metadata for reason
        actualToolCalls: output.toolCalls.length,
        actualTurns: countAssistantTurns(output),
        actualDurationMs: output.completedAt - output.startedAt,
        expectedToolCalls: groundTruth.maxToolCalls,
        expectedTurns: groundTruth.maxTurns,
        expectedDurationMs: groundTruth.maxDurationMs,
      };
    })
    .generateScore(({ results }) => {
      const p = results.preprocessStepResult;
      if (p.skipped) return 0.5; // Neutral if we can't score

      // Weighted average over applicable dimensions only
      let totalWeight = 0;
      let totalScore = 0;

      const dims: Array<{ score: number | null; weight: number }> = [
        { score: p.solveRate ?? 0, weight: WEIGHTS.solveRate },
        { score: p.toolCallRatio ?? null, weight: WEIGHTS.toolCallRatio },
        { score: p.stepRatio ?? null, weight: WEIGHTS.stepRatio },
        { score: p.redundancy ?? 1, weight: WEIGHTS.redundancy },
        { score: p.latencyRatio ?? null, weight: WEIGHTS.latencyRatio },
      ];

      for (const dim of dims) {
        if (dim.score !== null) {
          totalWeight += dim.weight;
          totalScore += dim.score * dim.weight;
        }
      }

      if (totalWeight === 0) return 0.5; // No dimensions applicable
      return Math.round((totalScore / totalWeight) * 100) / 100;
    })
    .generateReason(({ results, score }) => {
      const p = results.preprocessStepResult;
      if (p.skipped) return `Skipped: ${p.reason}`;

      const lines: string[] = [`Efficiency score: ${score}`];

      lines.push(`  Solved: ${p.solveRate === 1 ? 'yes' : 'no'} (weight ${WEIGHTS.solveRate})`);

      if (p.expectedToolCalls) {
        lines.push(`  Tool calls: ${p.actualToolCalls}/${p.expectedToolCalls} expected → ${(p.toolCallRatio ?? 1).toFixed(2)} (weight ${WEIGHTS.toolCallRatio})`);
      }
      if (p.expectedTurns) {
        lines.push(`  Turns: ${p.actualTurns}/${p.expectedTurns} expected → ${(p.stepRatio ?? 1).toFixed(2)} (weight ${WEIGHTS.stepRatio})`);
      }
      lines.push(`  Redundancy: ${(p.redundancy ?? 1).toFixed(2)} (weight ${WEIGHTS.redundancy})`);
      if (p.expectedDurationMs) {
        lines.push(`  Duration: ${p.actualDurationMs}ms/${p.expectedDurationMs}ms expected → ${(p.latencyRatio ?? 1).toFixed(2)} (weight ${WEIGHTS.latencyRatio})`);
      }

      return lines.join('\n');
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Score a ratio (actual/expected). Perfect = 1.0, degrades linearly to 0.
 * Under-budget is also 1.0 (we only penalize over-budget).
 */
function ratioScore(actual: number, expected: number): number {
  if (actual <= expected) return 1.0;
  const ratio = actual / expected;
  // Linear decay from 1.0 to 0.0 as ratio goes from 1.0 to maxRatio
  return Math.max(0, 1 - (ratio - 1) / (THRESHOLDS.maxRatio - 1));
}

function scoreRedundancy(toolCalls: ToolCallRecord[]): number {
  if (toolCalls.length < 2) return 1.0;

  let redundantCount = 0;
  let streak = 1;

  for (let i = 1; i < toolCalls.length; i++) {
    const prev = toolCalls[i - 1]!;
    const curr = toolCalls[i]!;

    if (curr.toolName === prev.toolName && JSON.stringify(curr.args) === JSON.stringify(prev.args)) {
      streak++;
    } else {
      if (streak >= THRESHOLDS.redundancyMinRepeat) {
        redundantCount += streak - 1;
      }
      streak = 1;
    }
  }
  // Handle final streak
  if (streak >= THRESHOLDS.redundancyMinRepeat) {
    redundantCount += streak - 1;
  }

  // Score: 1.0 = no redundancy, 0.0 = all calls are redundant
  const redundancyRate = redundantCount / toolCalls.length;
  return Math.max(0, 1 - redundancyRate);
}

function countAssistantTurns(output: MastraCodeExperimentOutput): number {
  return output.messages.filter(
    (m: unknown) => typeof m === 'object' && m !== null && (m as { role?: string }).role === 'assistant',
  ).length;
}
