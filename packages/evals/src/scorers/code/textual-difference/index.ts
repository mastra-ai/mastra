import { createScorer } from '@mastra/core/evals';
import { getTextContentFromMastraDBMessage } from '../../utils';

/**
 * Calculates similarity ratio similar to SequenceMatcher.ratio()
 * Uses longest common subsequence (LCS) approach
 * Ratio = 2.0 * matches / total
 */
function calculateRatio(input: string, output: string): number {
  if (input === output) {
    return 1.0;
  }
  if (input.length === 0 || output.length === 0) {
    return 0.0;
  }

  // Use character-level LCS for more accurate matching (similar to SequenceMatcher)
  const matches = longestCommonSubsequence(input, output);
  const total = input.length + output.length;

  return total > 0 ? (2.0 * matches) / total : 0.0;
}

/**
 * Finds the length of the longest common subsequence between two strings
 */
function longestCommonSubsequence(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = [];

  // Initialize DP table
  for (let i = 0; i <= m; i++) {
    dp[i] = [];
    for (let j = 0; j <= n; j++) {
      dp[i]![j] = 0;
    }
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i]![j]! = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j]! = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  return dp[m]![n]!;
}

/**
 * Counts the number of differences between two strings
 * Uses opcodes-like approach: counts insertions, deletions, and replacements
 * For whitespace differences, preserves the original strings before word splitting
 */
function countChanges(input: string, output: string): number {
  // Normalize whitespace for comparison but preserve original for change detection
  const inputNormalized = input.replace(/\s+/g, ' ').trim();
  const outputNormalized = output.replace(/\s+/g, ' ').trim();

  // If normalized strings are identical, check if there are whitespace differences
  if (inputNormalized === outputNormalized) {
    // If original strings differ only in whitespace, count that as a change
    if (input !== output) {
      // Count whitespace differences
      const inputWords = input.split(/\s+/).filter(w => w.length > 0);
      const outputWords = output.split(/\s+/).filter(w => w.length > 0);
      return Math.abs(inputWords.length - outputWords.length) || 1;
    }
    return 0;
  }

  const inputWords = inputNormalized.split(/\s+/).filter(w => w.length > 0);
  const outputWords = outputNormalized.split(/\s+/).filter(w => w.length > 0);

  if (inputWords.length === 0 && outputWords.length === 0) {
    return 0;
  }
  if (inputWords.length === 0) {
    return outputWords.length;
  }
  if (outputWords.length === 0) {
    return inputWords.length;
  }

  // Use LCS approach: changes = total - 2 * matches
  // But for word-level, we want to count replacements as single changes
  const matchingWords = findCommonWords(inputWords, outputWords);
  const maxLength = Math.max(inputWords.length, outputWords.length);
  const changes = maxLength - matchingWords;

  return changes;
}

/**
 * Finds the number of common words between two arrays using a greedy matching approach
 */
function findCommonWords(arr1: string[], arr2: string[]): number {
  let matches = 0;
  const used = new Set<number>();

  for (let i = 0; i < arr1.length; i++) {
    for (let j = 0; j < arr2.length; j++) {
      if (!used.has(j) && arr1[i] === arr2[j]) {
        matches++;
        used.add(j);
        break;
      }
    }
  }

  return matches;
}

export function createTextualDifferenceScorer() {
  return createScorer({
    id: 'textual-difference-scorer',
    name: 'Textual Difference Scorer',
    description: 'Calculate textual difference between input and output using sequence matching algorithms.',
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const input = run.input?.inputMessages?.map(i => getTextContentFromMastraDBMessage(i)).join(', ') || '';
      const output = run.output?.map(i => getTextContentFromMastraDBMessage(i)).join(', ') || '';

      // Calculate similarity ratio using LCS approach (similar to SequenceMatcher.ratio())
      const ratio = calculateRatio(input, output);

      // Count changes by comparing words
      const changes = countChanges(input, output);

      // Calculate confidence based on text length difference
      const maxLength = Math.max(input.length, output.length);
      const lengthDiff = maxLength > 0 ? Math.abs(input.length - output.length) / maxLength : 0;
      const confidence = 1 - lengthDiff;

      return {
        ratio,
        confidence,
        changes,
        lengthDiff,
      };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.ratio;
    });
}
