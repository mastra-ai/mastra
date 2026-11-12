import { createHash, randomBytes } from 'node:crypto';
import {
  DEFAULT_TASK_INITIAL_POLL_INTERVAL_MS,
  DEFAULT_TASK_INITIAL_POLL_WINDOW_MS,
  DEFAULT_TASK_POLL_INTERVAL_MS,
} from './constants';

/**
 * A new task id: 192 random bits, base64url. Task ids work as bearer tokens, so they must not be
 * guessable or derived from anything else (such as a workflow run id).
 *
 * @experimental SEP-2663 extension; API may change.
 */
export function createTaskId(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * A stable key for a task that is safe to store and show: the SHA-256 of the task id, base64url.
 * Client and server compute the same key, so traces on both sides can be matched without
 * recording the task id itself.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export function taskKeyOf(taskId: string): string {
  return createHash('sha256').update(taskId).digest('base64url');
}

/**
 * The poll interval a server suggests for a task created at `createdAt`: frequent while the task is
 * young, then slower.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export function suggestedPollIntervalMs(
  createdAt: number,
  now: number,
  options: { initialMs?: number; steadyMs?: number; initialWindowMs?: number } = {},
): number {
  const window = options.initialWindowMs ?? DEFAULT_TASK_INITIAL_POLL_WINDOW_MS;
  return now - createdAt < window
    ? (options.initialMs ?? DEFAULT_TASK_INITIAL_POLL_INTERVAL_MS)
    : (options.steadyMs ?? DEFAULT_TASK_POLL_INTERVAL_MS);
}
