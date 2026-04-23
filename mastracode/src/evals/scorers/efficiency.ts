/**
 * MastraCode Efficiency Scorer (Code-based, Agent type, 30% sampling)
 *
 * Measures how efficiently the agent completes work through quantitative ratios.
 * Unlike the Outcome Scorer (which checks *what* happened), this checks
 * *how much work* it took.
 *
 * This scorer produces a score from 0-1 but also exposes raw metrics in the
 * reason text for trend analysis. The score represents "how cleanly did the
 * agent work?" — not whether it got the right answer.
 *
 * Sampled at 30% because it's slightly more expensive (analyzes message sequences).
 */

import type { MastraDBMessage } from '@mastra/core/agent';
import { createScorer, filterRun } from '@mastra/core/evals';

import type { ExtractedToolCall } from './extract-tools';
import { extractToolCalls } from './extract-tools';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION — Adjust weights and thresholds here
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Dimension weights (must sum to 1.0).
 *
 * - redundancy:     Duplicate mutation tool calls with identical args.
 * - turnCount:      Total assistant turns to complete the task.
 * - retryEfficiency: How quickly the agent recovers from tool failures.
 * - readBeforeEdit: Whether files are read before being edited.
 */
const WEIGHTS = {
  redundancy: 0.35,
  turnCount: 0.3,
  retryEfficiency: 0.2,
  readBeforeEdit: 0.15,
} as const;

/**
 * Scoring thresholds and multipliers.
 */
const THRESHOLDS = {
  /** Redundancy ratio below this is considered acceptable (no penalty). */
  redundancyAcceptableRate: 0.05,

  /** Penalty multiplier applied to redundancy ratio above the acceptable rate. */
  redundancyPenaltyMultiplier: 3,

  /** Turns at or below this is considered normal (score 1.0). */
  turnCountNormalMax: 8,

  /** Penalty per turn beyond the normal maximum (for turns 9–15). */
  turnCountPenaltyPerTurn: 0.04,

  /** Penalty per turn beyond 15. */
  turnCountExtendedPenaltyPerTurn: 0.03,

  /** Number of consecutive failures before a retry chain is "excessive". */
  retryExcessiveThreshold: 3,

  /** Tools considered "edit" tools that should be preceded by a read. */
  editTools: ['string_replace_lsp', 'ast_smart_edit'] as string[],

  /** Tools that satisfy read-before-edit (only `view` truly reads a specific file). */
  readTools: ['view'] as string[],

  /** Tools whose repeated identical calls are intentional (idempotent reads). */
  redundancyWhitelist: ['view', 'search_content', 'find_files', 'lsp_inspect', 'web_search', 'web_extract'] as string[],

  /** Minimum tool calls required to produce a meaningful score. */
  minToolCalls: 2,
} as const;

/**
 * Count assistant turns (messages with role === 'assistant').
 */
function countAssistantTurns(messages: MastraDBMessage[]): number {
  return messages.filter(m => m.role === 'assistant').length;
}

/**
 * Calculate redundant call ratio.
 * Only counts mutation/action tools as redundant — reads are whitelisted.
 */
function scoreRedundancy(calls: ExtractedToolCall[]): { score: number; ratio: number; detail: string } {
  if (calls.length < 2) return { score: 1, ratio: 0, detail: 'Too few calls' };

  // Only consider non-whitelisted (mutation) tools for redundancy
  const mutationCalls = calls.filter(c => !THRESHOLDS.redundancyWhitelist.includes(c.toolName));
  if (mutationCalls.length < 2) return { score: 1, ratio: 0, detail: 'No mutation tools to check' };

  const fingerprints = new Map<string, { count: number; successCount: number }>();
  for (const call of mutationCalls) {
    const fp = `${call.toolName}:${JSON.stringify(call.args)}`;
    const existing = fingerprints.get(fp) ?? { count: 0, successCount: 0 };
    existing.count++;
    if (!call.isError) existing.successCount++;
    fingerprints.set(fp, existing);
  }

  // Only count as redundant if the same successful call happened multiple times
  let redundantCount = 0;
  for (const { successCount } of fingerprints.values()) {
    if (successCount > 1) redundantCount += successCount - 1;
  }

  const ratio = redundantCount / mutationCalls.length;
  const acceptable = THRESHOLDS.redundancyAcceptableRate;
  const score =
    ratio <= acceptable ? 1 : Math.max(0, 1 - (ratio - acceptable) * THRESHOLDS.redundancyPenaltyMultiplier);
  return {
    score,
    ratio,
    detail: `${redundantCount}/${mutationCalls.length} redundant mutations (${(ratio * 100).toFixed(0)}%)`,
  };
}

/**
 * Score turn count efficiency.
 * Fewer turns to accomplish the task = more efficient.
 */
function scoreTurnCount(turns: number): { score: number; detail: string } {
  const normalMax = THRESHOLDS.turnCountNormalMax;
  const penaltyPerTurn = THRESHOLDS.turnCountPenaltyPerTurn;
  const extendedPenalty = THRESHOLDS.turnCountExtendedPenaltyPerTurn;

  if (turns <= 1) return { score: 1, detail: `${turns} turn` };
  if (turns <= normalMax) return { score: 1, detail: `${turns} turns (within normal range)` };
  if (turns <= 15) {
    const score = 1 - (turns - normalMax) * penaltyPerTurn;
    return { score, detail: `${turns} turns (slightly extended)` };
  }

  const midPenalty = (15 - normalMax) * penaltyPerTurn;
  const score = Math.max(0, 1 - midPenalty - (turns - 15) * extendedPenalty);
  return { score, detail: `${turns} turns (extended session)` };
}

/**
 * Score failed-then-succeeded ratio.
 * Groups retry chains by tool name + target file path for more accurate detection.
 */
function scoreRetryEfficiency(calls: ExtractedToolCall[]): { score: number; detail: string } {
  if (calls.length < 2) return { score: 1, detail: 'Too few calls' };

  // Group calls by tool name + target file path (if available)
  const groupKey = (call: ExtractedToolCall): string => {
    const path = String(call.args.path ?? call.args.command ?? '');
    return `${call.toolName}:${path}`;
  };

  const byGroup = new Map<string, ExtractedToolCall[]>();
  for (const call of calls) {
    const key = groupKey(call);
    const arr = byGroup.get(key) ?? [];
    arr.push(call);
    byGroup.set(key, arr);
  }

  let totalRetryChains = 0;
  let excessiveRetries = 0;
  const threshold = THRESHOLDS.retryExcessiveThreshold;

  for (const [, toolCalls] of byGroup) {
    let consecutiveFailures = 0;
    for (const call of toolCalls) {
      if (call.isError) {
        consecutiveFailures++;
      } else {
        if (consecutiveFailures > 0) {
          totalRetryChains++;
          if (consecutiveFailures >= threshold) excessiveRetries++;
        }
        consecutiveFailures = 0;
      }
    }
    // Count unrecovered retry chains (failures at end of group with no success)
    if (consecutiveFailures > 0) {
      totalRetryChains++;
      if (consecutiveFailures >= threshold) excessiveRetries++;
    }
  }

  if (totalRetryChains === 0) return { score: 1, detail: 'No retry chains' };
  if (excessiveRetries === 0) return { score: 0.9, detail: `${totalRetryChains} retry chain(s), all resolved quickly` };

  const score = Math.max(0, 0.8 - excessiveRetries * 0.2);
  return {
    score,
    detail: `${excessiveRetries} excessive retry chain(s) (${threshold}+ failures before success)`,
  };
}

/**
 * Score read-before-edit compliance.
 * Only `view` satisfies a read — search/find don't provide specific file content.
 */
function scoreReadBeforeEdit(calls: ExtractedToolCall[]): { score: number; detail: string } {
  const editTools = THRESHOLDS.editTools;
  const readTools = THRESHOLDS.readTools;

  const edits = calls.filter(c => editTools.includes(c.toolName));
  if (edits.length === 0) return { score: 1, detail: 'No edits to check' };

  // Build set of files that were read before each edit.
  // Use suffix-normalized paths so that "/abs/path/src/foo.ts" and "src/foo.ts" match.
  const readPaths = new Set<string>();
  let compliant = 0;
  let total = 0;

  for (const call of calls) {
    const rawPath = String(call.args.path ?? '');
    if (!rawPath) continue;

    if (readTools.includes(call.toolName)) {
      readPaths.add(rawPath);
    } else if (editTools.includes(call.toolName)) {
      total++;
      if (hasReadPath(readPaths, rawPath)) {
        compliant++;
      }
    }
  }

  if (total === 0) return { score: 1, detail: 'No path-targeted edits' };

  const ratio = compliant / total;
  const violations = total - compliant;
  if (violations === 0) return { score: 1, detail: `All ${total} edits had prior reads` };
  return { score: ratio, detail: `${violations}/${total} edits without prior read` };
}

/** Check if any read path matches the edit path, using suffix matching for mixed abs/relative paths. */
function hasReadPath(readPaths: Set<string>, editPath: string): boolean {
  if (readPaths.has(editPath)) return true;
  for (const rp of readPaths) {
    if (rp.endsWith(`/${editPath}`) || editPath.endsWith(`/${rp}`)) return true;
  }
  return false;
}

export function createEfficiencyScorer() {
  return createScorer({
    id: 'mastracode-efficiency',
    name: 'MastraCode Efficiency',
    description:
      'Measures coding session efficiency: redundancy, turn count, retry patterns, read-before-edit. 30% sampled.',
    type: 'agent',
    prepareRun: filterRun({ partTypes: ['tool-invocation', 'text'] }),
  })
    .preprocess(async ({ run }) => {
      const messages = (run.output ?? []) as MastraDBMessage[];
      const calls = extractToolCalls(messages);
      const turns = countAssistantTurns(messages);

      // H1: Empty sessions → score 0
      if (calls.length < THRESHOLDS.minToolCalls) {
        return { empty: true as const, totalCalls: calls.length, totalTurns: turns };
      }

      const redundancy = scoreRedundancy(calls);
      const turnCount = scoreTurnCount(turns);
      const retryEfficiency = scoreRetryEfficiency(calls);
      const readBeforeEdit = scoreReadBeforeEdit(calls);

      return {
        empty: false as const,
        redundancy,
        turnCount,
        retryEfficiency,
        readBeforeEdit,
        totalCalls: calls.length,
        totalTurns: turns,
      };
    })
    .generateScore(({ results }) => {
      const p = results.preprocessStepResult;
      if (p.empty) return 0;

      const score =
        p.redundancy.score * WEIGHTS.redundancy +
        p.turnCount.score * WEIGHTS.turnCount +
        p.retryEfficiency.score * WEIGHTS.retryEfficiency +
        p.readBeforeEdit.score * WEIGHTS.readBeforeEdit;

      return Math.round(score * 100) / 100;
    })
    .generateReason(({ results, score }) => {
      const p = results.preprocessStepResult;
      if (p.empty) {
        return `Score: 0 (${p.totalCalls} tool calls — below minimum threshold for scoring)`;
      }

      const pct = (w: number) => `${(w * 100).toFixed(0)}%`;
      const parts: string[] = [`Score: ${score} (${p.totalCalls} calls, ${p.totalTurns} turns)`];

      parts.push(`Redundancy (${pct(WEIGHTS.redundancy)}): ${p.redundancy.detail} [${p.redundancy.score}]`);
      parts.push(`Turn count (${pct(WEIGHTS.turnCount)}): ${p.turnCount.detail} [${p.turnCount.score}]`);
      parts.push(
        `Retry efficiency (${pct(WEIGHTS.retryEfficiency)}): ${p.retryEfficiency.detail} [${p.retryEfficiency.score}]`,
      );
      parts.push(
        `Read-before-edit (${pct(WEIGHTS.readBeforeEdit)}): ${p.readBeforeEdit.detail} [${p.readBeforeEdit.score}]`,
      );

      return parts.join('\n');
    });
}
