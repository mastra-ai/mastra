import type { BufferedObservationChunk } from '@mastra/core/storage';

import type { ThresholdRange } from './types';

/**
 * Get the maximum value from a threshold (simple number or range).
 */
export function getMaxThreshold(threshold: number | ThresholdRange): number {
  if (typeof threshold === 'number') {
    return threshold;
  }
  return threshold.max;
}

/**
 * Calculate dynamic threshold based on observation space.
 * When shareTokenBudget is enabled, the message threshold can expand
 * into unused observation space, up to the total context budget.
 *
 * Total budget = messageTokens + observationTokens
 * Effective threshold = totalBudget - currentObservationTokens
 *
 * Example with 30k:40k thresholds (70k total):
 * - 0 observations → messages can use ~70k
 * - 10k observations → messages can use ~60k
 * - 40k observations → messages back to ~30k
 */
export function calculateDynamicThreshold(
  threshold: number | ThresholdRange,
  currentObservationTokens: number,
): number {
  // If not using adaptive threshold (simple number), return as-is
  if (typeof threshold === 'number') {
    return threshold;
  }

  // Adaptive threshold: use remaining space in total budget
  // Total budget is stored as threshold.max (base + reflection threshold)
  // Base threshold is stored as threshold.min
  const totalBudget = threshold.max;
  const baseThreshold = threshold.min;

  // Effective threshold = total budget minus current observations
  // But never go below the base threshold
  const effectiveThreshold = Math.max(totalBudget - currentObservationTokens, baseThreshold);

  return Math.round(effectiveThreshold);
}

/**
 * Resolve bufferTokens config value.
 * Values in (0, 1) are treated as ratios of the message threshold.
 * e.g. bufferTokens: 0.25 with messageTokens: 20_000 → 5_000
 */
export function resolveBufferTokens(
  bufferTokens: number | false | undefined,
  messageTokens: number | ThresholdRange,
): number | undefined {
  if (bufferTokens === false) return undefined;
  if (bufferTokens === undefined) return undefined;
  if (bufferTokens > 0 && bufferTokens < 1) {
    const threshold = typeof messageTokens === 'number' ? messageTokens : messageTokens.max;
    return Math.round(threshold * bufferTokens);
  }
  return bufferTokens;
}

/**
 * Resolve blockAfter config value.
 * Values in [1, 100) are treated as multipliers of the threshold.
 * e.g. blockAfter: 1.5 with messageTokens: 20_000 → 30_000
 * Values >= 100 are treated as absolute token counts.
 * Defaults to 1.2 (120% of threshold) when async buffering is enabled but blockAfter is omitted.
 */
export function resolveBlockAfter(
  blockAfter: number | undefined,
  messageTokens: number | ThresholdRange,
): number | undefined {
  if (blockAfter === undefined) return undefined;
  // Values between 1 (inclusive) and 100 (exclusive) are treated as multipliers of the threshold.
  // e.g. blockAfter: 1.5 means 1.5x the threshold. blockAfter: 1 means exactly at threshold.
  // Values >= 100 are treated as absolute token counts.
  if (blockAfter >= 1 && blockAfter < 100) {
    const threshold = typeof messageTokens === 'number' ? messageTokens : messageTokens.max;
    return Math.round(threshold * blockAfter);
  }
  return blockAfter;
}

/**
 * Convert bufferActivation to an absolute retention floor (tokens to keep after activation).
 * When bufferActivation >= 1000, it's an absolute retention target.
 * Otherwise it's a ratio: retentionFloor = threshold * (1 - ratio).
 */
export function resolveRetentionFloor(bufferActivation: number, messageTokensThreshold: number): number {
  if (bufferActivation >= 1000) return bufferActivation;
  return messageTokensThreshold * (1 - bufferActivation);
}

/**
 * Convert bufferActivation to the equivalent ratio (0-1) for the storage layer.
 * When bufferActivation >= 1000, it's an absolute retention target, so we compute
 * the equivalent ratio: 1 - (bufferActivation / threshold).
 */
export function resolveActivationRatio(bufferActivation: number, messageTokensThreshold: number): number {
  if (bufferActivation >= 1000) {
    return Math.max(0, Math.min(1, 1 - bufferActivation / messageTokensThreshold));
  }
  return bufferActivation;
}

/**
 * Calculate the projected message tokens that would be removed if activation happened now.
 * This replicates the chunk boundary logic in swapBufferedToActive without actually activating.
 */
export function calculateProjectedMessageRemoval(
  chunks: BufferedObservationChunk[],
  bufferActivation: number,
  messageTokensThreshold: number,
  currentPendingTokens: number,
): number {
  if (chunks.length === 0) return 0;

  const retentionFloor = resolveRetentionFloor(bufferActivation, messageTokensThreshold);
  const targetMessageTokens = Math.max(0, currentPendingTokens - retentionFloor);

  // Find the closest chunk boundary to the target, biased over (prefer removing
  // slightly more than the target so remaining context lands at or below retentionFloor).
  // Track both best-over and best-under boundaries so we can fall back to under
  // if the over boundary would overshoot by too much.
  let cumulativeMessageTokens = 0;
  let bestOverBoundary = 0;
  let bestOverTokens = 0;
  let bestUnderBoundary = 0;
  let bestUnderTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    cumulativeMessageTokens += chunks[i]!.messageTokens ?? 0;
    const boundary = i + 1;

    if (cumulativeMessageTokens >= targetMessageTokens) {
      // Over or equal — track the closest (lowest) over boundary
      if (bestOverBoundary === 0 || cumulativeMessageTokens < bestOverTokens) {
        bestOverBoundary = boundary;
        bestOverTokens = cumulativeMessageTokens;
      }
    } else {
      // Under — track the closest (highest) under boundary
      if (cumulativeMessageTokens > bestUnderTokens) {
        bestUnderBoundary = boundary;
        bestUnderTokens = cumulativeMessageTokens;
      }
    }
  }

  // Safeguard: if the over boundary would eat into more than 95% of the
  // retention floor, fall back to the best under boundary instead.
  // This prevents edge cases where a large chunk overshoots dramatically.
  // Additionally, never bias over if it would leave fewer than the smaller of
  // 1000 tokens or the retention floor — at that level the agent may lose
  // all meaningful context.
  const maxOvershoot = retentionFloor * 0.95;
  const overshoot = bestOverTokens - targetMessageTokens;
  const remainingAfterOver = currentPendingTokens - bestOverTokens;
  const remainingAfterUnder = currentPendingTokens - bestUnderTokens;
  // When activationRatio ≈ 1.0, retentionFloor is 0 and minRemaining becomes 0 — intentional for "activate everything" configs.
  const minRemaining = Math.min(1000, retentionFloor);

  let bestBoundaryMessageTokens: number;

  if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) {
    bestBoundaryMessageTokens = bestOverTokens;
  } else if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) {
    bestBoundaryMessageTokens = bestUnderTokens;
  } else if (bestOverBoundary > 0) {
    // All boundaries are over and exceed the safeguard — still activate
    // the closest over boundary (better than nothing)
    bestBoundaryMessageTokens = bestOverTokens;
  } else {
    return chunks[0]?.messageTokens ?? 0;
  }

  return bestBoundaryMessageTokens;
}
