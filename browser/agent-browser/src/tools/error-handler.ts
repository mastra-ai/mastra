/**
 * Browser Tool Error Handler
 */

import { createError } from '@mastra/core/browser';

export function handleBrowserError(error: unknown, context: string) {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('aborted')) {
    return createError('timeout', `${context} timed out.`, 'Try again or increase timeout.');
  }
  if (msg.includes('not launched') || msg.includes('Browser is not launched')) {
    return createError(
      'browser_error',
      'Browser was not initialized.',
      'This is an internal error - please try again.',
    );
  }
  if (msg.includes('stale') || msg.includes('Stale')) {
    return createError('stale_ref', 'Element ref is no longer valid.', 'Get a fresh snapshot and use updated refs.');
  }
  if (msg.includes('not found') || msg.includes('No element')) {
    return createError('element_not_found', `Element not found.`, 'Check the ref is correct or get a fresh snapshot.');
  }

  return createError('browser_error', `${context} failed: ${msg}`, 'Check the browser state and try again.');
}
