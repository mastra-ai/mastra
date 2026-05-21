import type { AgentChunkType } from '../stream/types';

/**
 * Return value from a `TypingStatusFn`. Returning a non-empty string sets the
 * typing status. Returning `false`/`null`/`undefined`/`void` leaves the
 * current status untouched.
 */
export type TypingStatusReturn = string | false | null | undefined | void;

/**
 * Context passed to a `TypingStatusFn` on every chunk.
 */
export interface TypingStatusContext {
  /** Platform key for the current adapter (e.g. `'slack'`, `'discord'`). */
  platform: string;
  /** Chat SDK thread id for the current run. */
  threadId: string;
  /**
   * Live, read-only view of tools the run has called so far. Keyed by
   * `toolCallId`. Useful for branching on the number of concurrent tools or
   * the most recently called tool.
   */
  toolCalls: ReadonlyMap<string, { toolName: string; args: unknown; startedAt: number }>;
  /** Status string currently displayed (last value set), or `undefined` if none. */
  currentStatus: string | undefined;
}

/**
 * Function form of `typingStatus`. Called once per chunk in the agent stream.
 * Return a string to set the typing status; return `false`/`null`/`undefined`
 * to leave the current status unchanged.
 *
 * @example
 * ```ts
 * typingStatus: (chunk, ctx) => {
 *   if (chunk.type === 'tool-call' && chunk.payload.toolName === 'searchDocs') {
 *     return 'is searching docs…';
 *   }
 *   return defaultTypingStatus(chunk, ctx);
 * };
 * ```
 */
export type TypingStatusFn = (chunk: AgentChunkType<any>, ctx: TypingStatusContext) => TypingStatusReturn;

/**
 * Built-in default typing status map. Used when `typingStatus: true` (the
 * default) and exported so user functions can compose with it instead of
 * re-implementing the defaults for chunks they don't care about.
 *
 * Defaults are written without a leading subject so platforms that prepend the
 * app name (e.g. Slack Assistant: `<App Name> <status>`) read naturally as
 * "Devin is typing…".
 *
 * | Chunk type            | Status                            |
 * | --------------------- | --------------------------------- |
 * | `text-delta`          | `is typing…`                      |
 * | `tool-call`           | `is calling ${toolName}…`         |
 * | `tool-call-approval`  | `is requesting approval for ${toolName}…`        |
 * | _everything else_     | _no change_                       |
 */
export function defaultTypingStatus(chunk: AgentChunkType<any>, _ctx: TypingStatusContext): TypingStatusReturn {
  if (chunk.type.startsWith('data-om-')) {
    const t = chunk.type as string;
    if (t === 'data-om-buffering-start') {
      return 'is saving to memory…';
    }
    if (t === 'data-om-activation') {
      return 'is recalling memory…';
    }
  }

  if (['reasoning-start', 'reasoning-delta'].includes(chunk.type)) {
    return 'is thinking…';
  }

  if (['text-start', 'text-delta'].includes(chunk.type)) {
    return 'is typing…';
  }

  switch (chunk.type) {
    case 'start':
      return 'is working…';
    case 'tool-call':
      return `is calling ${chunk.payload.toolName}…`;

    case 'tool-call-approval':
      return `is requesting approval for ${chunk.payload.toolName}…`;

    default:
      return undefined;
  }
}
