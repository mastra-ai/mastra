/**
 * MastraCode Outcome Scorer (Code-based, Agent type, always-on)
 *
 * Grades the objective outcome of a coding session by checking hard facts:
 * - Did the build/typecheck pass?
 * - Did tests pass?
 * - What was the tool error rate?
 * - Did the agent get stuck in a loop?
 * - Was there a regression (build passed earlier, failed later)?
 * - Did the agent use ask_user unnecessarily? (autonomy)
 *
 * This scorer is always-on (no sampling) because it's cheap — it only
 * reads exit codes and error states from tool results already in the messages.
 *
 * Scoring philosophy (from Anthropic's eval guidance):
 * "Grade outcomes, not paths" — we check what happened, not how.
 * Partial credit: a session that passes build but fails tests scores
 * higher than one that fails build entirely.
 *
 * Dimensions that don't apply to a session (e.g. build for a docs-only task)
 * are excluded from the weighted average, so sessions aren't penalized for
 * irrelevant criteria.
 */

import type { MastraDBMessage } from '@mastra/core/agent';
import { createScorer, filterRun } from '@mastra/core/evals';

import { isBuildCommand, isTestCommand, getExitCode } from './classify-command';
import type { ExtractedToolCall } from './extract-tools';
import { extractToolCalls } from './extract-tools';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION — Adjust weights and thresholds here
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Dimension weights. Used to compute the weighted average of applicable dimensions.
 * Dimensions that don't apply (e.g. no build ran) are excluded from the average.
 */
const WEIGHTS = {
  build: 0.3,
  tests: 0.25,
  toolErrors: 0.2,
  loops: 0.1,
  regression: 0.1,
  autonomy: 0.05,
} as const;

/**
 * Scoring thresholds and multipliers.
 */
const THRESHOLDS = {
  /** Multiplier for tool error rate penalty. Score = max(0, 1 - rate × this). */
  toolErrorPenaltyMultiplier: 1.0,

  /** How many consecutive identical calls (or same-error repeats) before it's a "loop". */
  loopMinRepetitions: 3,

  /** Score penalty per detected loop. */
  loopPenaltyPerOccurrence: 0.3,

  /** Score deducted per ask_user call. */
  autonomyPenaltyPerAsk: 0.25,

  /** Score when a command ran but exit code is ambiguous. */
  ambiguousExitScore: 0.75,

  /** Minimum tool calls required to produce a meaningful score. */
  minToolCalls: 1,

  /** Tool names whose errors are expected/benign (not penalized). */
  benignErrorTools: ['search_content', 'find_files', 'lsp_inspect'] as string[],
} as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type DimensionResult = { score: number; detail: string; applicable: boolean };

/**
 * Check if the primary verb of an execute_command is a build/typecheck command.
 * Splits compound commands (&&, ;) and checks the first segment.
 */
/** Extract command string from tool call args, then delegate to shared classifier. */
function isBuildArgs(args: Record<string, unknown>): boolean {
  return isBuildCommand(String(args.command ?? ''));
}

function isTestArgs(args: Record<string, unknown>): boolean {
  return isTestCommand(String(args.command ?? ''));
}

/**
 * Score build/typecheck outcome (final state).
 */
function scoreBuild(execResults: ExtractedToolCall[]): DimensionResult {
  const builds = execResults.filter(r => r.toolName === 'execute_command' && isBuildArgs(r.args));
  if (builds.length === 0) return { score: 0, detail: 'No build/typecheck ran', applicable: false };

  const last = builds[builds.length - 1]!;
  if (last.isError) return { score: 0, detail: 'Build/typecheck tool errored', applicable: true };

  const exitCode = getExitCode(last.result);
  if (exitCode === 0) return { score: 1, detail: 'Build/typecheck passed', applicable: true };
  if (exitCode !== null && exitCode !== 0)
    return { score: 0, detail: `Build failed (exit ${exitCode})`, applicable: true };

  // Fallback: check result text for TS errors
  const text = typeof last.result === 'string' ? last.result : JSON.stringify(last.result ?? '');
  if (/error TS\d+|Cannot find module|is not assignable/i.test(text)) {
    return { score: 0, detail: 'Build failed (TypeScript errors in output)', applicable: true };
  }

  return { score: THRESHOLDS.ambiguousExitScore, detail: 'Build ran, outcome unclear', applicable: true };
}

/**
 * Score test outcome (final state).
 */
function scoreTests(execResults: ExtractedToolCall[]): DimensionResult {
  const tests = execResults.filter(r => r.toolName === 'execute_command' && isTestArgs(r.args));
  if (tests.length === 0) return { score: 0, detail: 'No tests ran', applicable: false };

  const last = tests[tests.length - 1]!;
  if (last.isError) return { score: 0, detail: 'Test command errored', applicable: true };

  const exitCode = getExitCode(last.result);
  if (exitCode === 0) return { score: 1, detail: 'Tests passed', applicable: true };
  if (exitCode !== null && exitCode !== 0)
    return { score: 0, detail: `Tests failed (exit ${exitCode})`, applicable: true };

  const text = typeof last.result === 'string' ? last.result : JSON.stringify(last.result ?? '');
  if (/\d+ (?:tests? )?passed|✓|PASS/i.test(text) && !/\bfail(?:ed|ure)?\b|\berror\b/i.test(text)) {
    return { score: 1, detail: 'Tests passed (inferred)', applicable: true };
  }
  if (/\bFAIL\b|failed|✗|✘/i.test(text)) {
    return { score: 0, detail: 'Tests failed (inferred)', applicable: true };
  }

  return { score: THRESHOLDS.ambiguousExitScore, detail: 'Tests ran, outcome unclear', applicable: true };
}

/**
 * Score tool error rate, excluding benign errors from expected-to-fail tools.
 */
function scoreToolErrors(results: ExtractedToolCall[]): DimensionResult {
  if (results.length === 0) return { score: 1, detail: 'No tool calls', applicable: false };

  // Only count errors from non-benign tools
  const nonBenign = results.filter(r => !THRESHOLDS.benignErrorTools.includes(r.toolName));
  if (nonBenign.length === 0) return { score: 1, detail: 'All tool calls are benign-error tools', applicable: true };

  const errors = nonBenign.filter(r => r.isError);
  const rate = errors.length / nonBenign.length;

  if (rate === 0) return { score: 1, detail: 'No tool errors', applicable: true };

  const score = Math.max(0, 1 - rate * THRESHOLDS.toolErrorPenaltyMultiplier);
  return {
    score,
    detail: `${errors.length}/${nonBenign.length} tools errored (${(rate * 100).toFixed(0)}%)`,
    applicable: true,
  };
}

/**
 * Detect stuck loops: same tool + same args appearing 3+ times consecutively,
 * or same tool + same args erroring 3+ times total.
 */
function scoreStuckLoops(results: ExtractedToolCall[]): DimensionResult {
  if (results.length < 3) return { score: 1, detail: 'Too few calls for loop detection', applicable: true };

  const fingerprint = (r: ExtractedToolCall) => `${r.toolName}:${JSON.stringify(r.args)}`;

  // Check consecutive identical calls
  let maxConsecutive = 1;
  let currentRun = 1;
  for (let i = 1; i < results.length; i++) {
    if (fingerprint(results[i]!) === fingerprint(results[i - 1]!)) {
      currentRun++;
      maxConsecutive = Math.max(maxConsecutive, currentRun);
    } else {
      currentRun = 1;
    }
  }

  // Check repeated error fingerprints
  const errorCounts = new Map<string, number>();
  for (const r of results) {
    if (!r.isError) continue;
    const fp = fingerprint(r);
    errorCounts.set(fp, (errorCounts.get(fp) ?? 0) + 1);
  }
  const maxErrorRepeat = Math.max(0, ...[...errorCounts.values()]);

  const minReps = THRESHOLDS.loopMinRepetitions;
  const loopSeverity = Math.max(
    maxConsecutive >= minReps ? maxConsecutive - (minReps - 1) : 0,
    maxErrorRepeat >= minReps ? maxErrorRepeat - (minReps - 1) : 0,
  );

  if (loopSeverity === 0) return { score: 1, detail: 'No stuck loops', applicable: true };

  const score = Math.max(0, 1 - loopSeverity * THRESHOLDS.loopPenaltyPerOccurrence);
  const details: string[] = [];
  if (maxConsecutive >= minReps) details.push(`${maxConsecutive} consecutive identical calls`);
  if (maxErrorRepeat >= minReps) details.push(`same error repeated ${maxErrorRepeat}x`);
  return { score, detail: details.join('; '), applicable: true };
}

/**
 * Detect regressions: build/test passed at some point, then failed later.
 * Gives partial credit if the agent recovered (final state passes).
 */
function scoreRegression(execResults: ExtractedToolCall[]): DimensionResult {
  const regressions: { label: string; recovered: boolean }[] = [];

  for (const [label, filter] of [
    ['Build', isBuildArgs],
    ['Tests', isTestArgs],
  ] as const) {
    const cmds = execResults.filter(r => r.toolName === 'execute_command' && filter(r.args));
    if (cmds.length < 2) continue;

    let sawPass = false;
    let sawRegression = false;
    for (const cmd of cmds) {
      const exit = getExitCode(cmd.result);
      if (exit === 0) {
        if (sawRegression) {
          // Recovered from regression
          regressions.push({ label, recovered: true });
          sawRegression = false;
        }
        sawPass = true;
      }
      if (sawPass && exit !== null && exit !== 0) {
        sawRegression = true;
      }
    }

    if (sawRegression) {
      // Regression persisted at end of session
      regressions.push({ label, recovered: false });
    }
  }

  if (regressions.length === 0) return { score: 1, detail: 'No regressions', applicable: true };

  // Persistent regressions are severe (0), recovered regressions get partial credit (0.5)
  const persistentCount = regressions.filter(r => !r.recovered).length;
  const recoveredCount = regressions.filter(r => r.recovered).length;
  const score = Math.max(0, 1 - persistentCount * 0.5 - recoveredCount * 0.1);
  const details = regressions.map(
    r => `${r.label} ${r.recovered ? 'regressed then recovered' : 'regressed (persisted)'}`,
  );
  return { score, detail: details.join('; '), applicable: true };
}

/**
 * Score autonomy: penalize ask_user calls.
 * 0 calls = 1.0, each call reduces by 0.25 (up to a floor of 0).
 */
function scoreAutonomy(results: ExtractedToolCall[]): DimensionResult {
  const askUserCalls = results.filter(r => r.toolName === 'ask_user');
  const count = askUserCalls.length;

  if (count === 0) return { score: 1, detail: 'No ask_user calls (fully autonomous)', applicable: true };

  const score = Math.max(0, 1 - count * THRESHOLDS.autonomyPenaltyPerAsk);
  return { score, detail: `${count} ask_user call${count > 1 ? 's' : ''}`, applicable: true };
}

/**
 * Compute weighted average of only applicable dimensions.
 * Returns null if no dimensions are applicable.
 */
function weightedAverage(dimensions: Record<string, DimensionResult>, weights: Record<string, number>): number | null {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, result] of Object.entries(dimensions)) {
    if (!result.applicable) continue;
    const weight = weights[key] ?? 0;
    totalWeight += weight;
    weightedSum += result.score * weight;
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

export function createOutcomeScorer() {
  return createScorer({
    id: 'mastracode-outcome',
    name: 'MastraCode Outcome',
    description:
      'Grades coding session outcomes: build/test pass, tool errors, stuck loops, regressions, autonomy. Always-on.',
    type: 'agent',
    prepareRun: filterRun({ partTypes: ['tool-invocation', 'text'] }),
  })
    .preprocess(async ({ run }) => {
      const messages = (run.output ?? []) as MastraDBMessage[];
      const allResults = extractToolCalls(messages);
      const totalCalls = allResults.length;

      // H1: Empty sessions or sessions with no tool calls → score 0
      if (totalCalls < THRESHOLDS.minToolCalls) {
        const empty: DimensionResult = { score: 0, detail: 'No tool calls', applicable: false };
        return {
          empty: true as const,
          build: empty,
          tests: empty,
          toolErrors: empty,
          loops: empty,
          regression: empty,
          autonomy: empty,
          totalCalls,
        };
      }

      const execResults = allResults.filter(r => r.toolName === 'execute_command');

      return {
        empty: false as const,
        build: scoreBuild(execResults),
        tests: scoreTests(execResults),
        toolErrors: scoreToolErrors(allResults),
        loops: scoreStuckLoops(allResults),
        regression: scoreRegression(execResults),
        autonomy: scoreAutonomy(allResults),
        totalCalls,
      };
    })
    .generateScore(({ results }) => {
      const p = results.preprocessStepResult;
      if (p.empty) return 0;

      const score = weightedAverage(
        {
          build: p.build,
          tests: p.tests,
          toolErrors: p.toolErrors,
          loops: p.loops,
          regression: p.regression,
          autonomy: p.autonomy,
        },
        WEIGHTS,
      );

      return score === null ? 0 : Math.round(score * 100) / 100;
    })
    .generateReason(({ results, score }) => {
      const p = results.preprocessStepResult;
      if (p.empty) {
        return `Score: 0 (${p.totalCalls} tool calls — below minimum threshold for scoring)`;
      }

      const pct = (w: number) => `${(w * 100).toFixed(0)}%`;
      const dimLine = (name: string, weight: number, r: DimensionResult) =>
        r.applicable
          ? `${name} (${pct(weight)}): ${r.detail} [${r.score}]`
          : `${name}: ${r.detail} [N/A — excluded from average]`;

      const parts: string[] = [`Score: ${score} (${p.totalCalls} tool calls total)`];
      parts.push(dimLine('Build', WEIGHTS.build, p.build));
      parts.push(dimLine('Tests', WEIGHTS.tests, p.tests));
      parts.push(dimLine('Tool errors', WEIGHTS.toolErrors, p.toolErrors));
      parts.push(dimLine('Loops', WEIGHTS.loops, p.loops));
      parts.push(dimLine('Regression', WEIGHTS.regression, p.regression));
      parts.push(dimLine('Autonomy', WEIGHTS.autonomy, p.autonomy));

      return parts.join('\n');
    });
}
