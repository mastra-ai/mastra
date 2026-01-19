import type { RetryConfig } from './types';

/**
 * Calculate exponential backoff delay for retries.
 *
 * @param attempt - The attempt number (1-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempt: number, config: Required<RetryConfig>): number {
  const { baseDelay, maxDelay, multiplier, jitter } = config;

  // Exponential: baseDelay * (multiplier ^ (attempt - 1))
  let delay = baseDelay * Math.pow(multiplier, attempt - 1);

  // Cap at maxDelay
  delay = Math.min(delay, maxDelay);

  // Add jitter (±25%)
  if (jitter) {
    const jitterRange = delay * 0.25;
    delay += (Math.random() * 2 - 1) * jitterRange;
  }

  return Math.floor(delay);
}

/**
 * Check if an error is retryable based on common patterns.
 *
 * @param error - The error to check
 * @returns Whether the error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes('econnreset')) return true;
  if (message.includes('etimedout')) return true;
  if (message.includes('fetch failed')) return true;
  if (message.includes('network')) return true;

  // Rate limits
  if (message.includes('rate limit')) return true;
  if (message.includes('429')) return true;
  if (message.includes('too many requests')) return true;

  // Temporary failures
  if (message.includes('503')) return true;
  if (message.includes('502')) return true;
  if (message.includes('500')) return true;
  if (message.includes('service unavailable')) return true;

  // Non-retryable by default
  return false;
}

/**
 * Generate a unique task ID.
 */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
