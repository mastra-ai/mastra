/**
 * Command construction helpers for the Boat sandbox provider.
 *
 * Boat's command endpoint accepts only `{ command, cwd, timeoutSeconds, detached }` —
 * there is no per-command environment. Callers that need one get it by wrapping
 * the command in `env K=V … sh -c '<command>'`, which is what {@link withEnv} builds.
 */

import { shellQuote } from '../utils/shell-quote';

/**
 * Wrap a command so it runs with `env` applied.
 *
 * Returns the command unchanged when there is nothing to inject, so the common
 * case doesn't pay for an extra shell level. Values go through `env`'s
 * `NAME=VALUE` form rather than `export`, and are shell-quoted, so a value never
 * reaches the shell as code. `undefined` values are dropped: they mean "not
 * set", and Boat has no way to unset a variable the VM already has.
 */
export function withEnv(command: string, env?: NodeJS.ProcessEnv): string {
  const assignments = Object.entries(env ?? {})
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${shellQuote(value)}`);

  if (assignments.length === 0) return command;

  return `env ${assignments.join(' ')} sh -c ${shellQuote(command)}`;
}

/**
 * Return the output a stream has produced since the last poll.
 *
 * Boat's streams are append-only, so everything past what has already been
 * emitted is new. A stream that came back shorter than what we hold (a rotated
 * log, or a short read) yields nothing rather than re-emitting from the start.
 */
export function newOutputSince(emitted: string, full: string): string {
  if (full.length <= emitted.length) return '';
  return full.slice(emitted.length);
}
