import type { AgentMessage, Scorecard } from '../types';
import { toJsonlBuffer } from './jsonl';

/**
 * DPO preference pair format.
 */
interface DPOExample {
  prompt: string;
  chosen: string;
  rejected: string;
  chosen_score?: number;
  rejected_score?: number;
}

/**
 * OpenAI DPO format (chat format with preference).
 */
interface OpenAIDPOExample {
  input: Array<{ role: string; content: string }>;
  preferred_output: Array<{ role: string; content: string }>;
  non_preferred_output: Array<{ role: string; content: string }>;
}

/**
 * Group scorecards by case ID for DPO pair generation.
 */
function groupByCase(scorecards: Scorecard[]): Map<string, Scorecard[]> {
  const groups = new Map<string, Scorecard[]>();

  for (const scorecard of scorecards) {
    const caseId = scorecard.run.caseId;
    if (!groups.has(caseId)) {
      groups.set(caseId, []);
    }
    groups.get(caseId)!.push(scorecard);
  }

  return groups;
}

/**
 * Render scorecards to DPO (Direct Preference Optimization) JSONL format.
 *
 * Requires multiple responses per case to create preference pairs.
 * The highest-scoring response becomes "chosen", lowest becomes "rejected".
 */
export function renderDpoJsonl(scorecards: Scorecard[]): Uint8Array {
  const groups = groupByCase(scorecards);
  const examples: OpenAIDPOExample[] = [];

  let skippedSingleCandidate = 0;
  let skippedSimilarScores = 0;
  let skippedEmptyMessages = 0;

  for (const [caseId, group] of groups) {
    // Need at least 2 candidates to form a preference pair
    if (group.length < 2) {
      skippedSingleCandidate++;
      continue;
    }

    // Sort by composite score descending
    const sorted = [...group].sort((a, b) => b.compositeScore - a.compositeScore);

    // Take the best as chosen, worst as rejected
    const chosen = sorted[0]!;
    const rejected = sorted[sorted.length - 1]!;

    // Skip if scores are too similar (no clear preference)
    if (Math.abs(chosen.compositeScore - rejected.compositeScore) < 0.05) {
      skippedSimilarScores++;
      continue;
    }

    // Extract input messages (everything except the last assistant response)
    // Use outputMessages which contains the full conversation with generated response
    const chosenMessages = chosen.run.outputMessages;
    const rejectedMessages = rejected.run.outputMessages;

    const inputMessages = extractInputMessages(chosenMessages);
    const chosenOutput = extractAssistantOutput(chosenMessages);
    const rejectedOutput = extractAssistantOutput(rejectedMessages);

    if (inputMessages.length > 0 && chosenOutput.length > 0 && rejectedOutput.length > 0) {
      examples.push({
        input: inputMessages.map(m => ({ role: m.role, content: m.content })),
        preferred_output: chosenOutput.map(m => ({ role: m.role, content: m.content })),
        non_preferred_output: rejectedOutput.map(m => ({ role: m.role, content: m.content })),
      });
    } else {
      skippedEmptyMessages++;
    }
  }

  // Log statistics for debugging
  if (skippedSingleCandidate > 0 || skippedSimilarScores > 0 || skippedEmptyMessages > 0) {
    console.log(`[DPO] Rendered ${examples.length} examples from ${groups.size} cases`);
    console.log(
      `[DPO] Skipped: ${skippedSingleCandidate} single-candidate, ${skippedSimilarScores} similar-scores, ${skippedEmptyMessages} empty-messages`,
    );
  }

  return toJsonlBuffer(examples);
}

/**
 * Render to simple DPO format (prompt/chosen/rejected strings).
 */
export function renderSimpleDpoJsonl(scorecards: Scorecard[]): Uint8Array {
  const groups = groupByCase(scorecards);
  const examples: DPOExample[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) {
      continue;
    }

    const sorted = [...group].sort((a, b) => b.compositeScore - a.compositeScore);
    const chosen = sorted[0]!;
    const rejected = sorted[sorted.length - 1]!;

    if (Math.abs(chosen.compositeScore - rejected.compositeScore) < 0.05) {
      continue;
    }

    const prompt = extractPromptText(chosen.run.input.messages);
    const chosenText = extractAssistantText(chosen.run.input.messages);
    const rejectedText = extractAssistantText(rejected.run.input.messages);

    if (prompt && chosenText && rejectedText) {
      examples.push({
        prompt,
        chosen: chosenText,
        rejected: rejectedText,
        chosen_score: chosen.compositeScore,
        rejected_score: rejected.compositeScore,
      });
    }
  }

  return toJsonlBuffer(examples);
}

/**
 * Extract input messages (system + user messages before assistant).
 */
function extractInputMessages(messages: AgentMessage[]): AgentMessage[] {
  const result: AgentMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      break;
    }
    result.push(msg);
  }

  return result;
}

/**
 * Extract assistant output messages.
 */
function extractAssistantOutput(messages: AgentMessage[]): AgentMessage[] {
  const result: AgentMessage[] = [];
  let foundAssistant = false;

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      foundAssistant = true;
    }
    if (foundAssistant) {
      result.push(msg);
    }
  }

  return result;
}

/**
 * Extract prompt text from messages.
 */
function extractPromptText(messages: AgentMessage[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      break;
    }
    if (msg.role === 'user') {
      parts.push(msg.content);
    }
  }

  return parts.join('\n');
}

/**
 * Extract final assistant response text.
 */
function extractAssistantText(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'assistant') {
      return messages[i]!.content;
    }
  }
  return '';
}

/**
 * DPO rendering options.
 */
export interface DpoRenderOptions {
  /** Minimum score difference for a valid pair */
  minScoreDiff?: number;
  /** Use median as rejected instead of worst */
  useMedianAsRejected?: boolean;
  /** Maximum pairs per case */
  maxPairsPerCase?: number;
}

/**
 * Render DPO with options.
 */
export function renderDpoJsonlWithOptions(scorecards: Scorecard[], options: DpoRenderOptions = {}): Uint8Array {
  const groups = groupByCase(scorecards);
  const examples: OpenAIDPOExample[] = [];
  const minDiff = options.minScoreDiff ?? 0.05;

  for (const [, group] of groups) {
    if (group.length < 2) {
      continue;
    }

    const sorted = [...group].sort((a, b) => b.compositeScore - a.compositeScore);
    const chosen = sorted[0]!;

    // Select rejected based on options
    let rejected: Scorecard;
    if (options.useMedianAsRejected && sorted.length >= 3) {
      rejected = sorted[Math.floor(sorted.length / 2)]!;
    } else {
      rejected = sorted[sorted.length - 1]!;
    }

    if (Math.abs(chosen.compositeScore - rejected.compositeScore) < minDiff) {
      continue;
    }

    const inputMessages = extractInputMessages(chosen.run.input.messages);
    const chosenOutput = extractAssistantOutput(chosen.run.input.messages);
    const rejectedOutput = extractAssistantOutput(rejected.run.input.messages);

    if (inputMessages.length > 0 && chosenOutput.length > 0 && rejectedOutput.length > 0) {
      examples.push({
        input: inputMessages.map(m => ({ role: m.role, content: m.content })),
        preferred_output: chosenOutput.map(m => ({ role: m.role, content: m.content })),
        non_preferred_output: rejectedOutput.map(m => ({ role: m.role, content: m.content })),
      });
    }
  }

  return toJsonlBuffer(examples);
}

/**
 * Get DPO statistics.
 */
export function getDpoStats(scorecards: Scorecard[]): {
  totalCases: number;
  validPairs: number;
  avgChosenScore: number;
  avgRejectedScore: number;
  avgScoreDiff: number;
} {
  const groups = groupByCase(scorecards);
  let validPairs = 0;
  let totalChosenScore = 0;
  let totalRejectedScore = 0;

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((a, b) => b.compositeScore - a.compositeScore);
    const chosen = sorted[0]!;
    const rejected = sorted[sorted.length - 1]!;

    if (Math.abs(chosen.compositeScore - rejected.compositeScore) >= 0.05) {
      validPairs++;
      totalChosenScore += chosen.compositeScore;
      totalRejectedScore += rejected.compositeScore;
    }
  }

  return {
    totalCases: groups.size,
    validPairs,
    avgChosenScore: validPairs > 0 ? totalChosenScore / validPairs : 0,
    avgRejectedScore: validPairs > 0 ? totalRejectedScore / validPairs : 0,
    avgScoreDiff: validPairs > 0 ? (totalChosenScore - totalRejectedScore) / validPairs : 0,
  };
}
