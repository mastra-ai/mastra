import type { AgentChunkType } from '../stream/types';
import { asOmChunk } from './om';
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
  /** Status string currently displayed (last value set), or `undefined` if none. */
  currentStatus: string | undefined;
  /**
   * Names of the built-in channel tools available in the current thread.
   */
  channelTools: ReadonlySet<string>;
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
 * Built-in typing-status resolver. Used when `typingStatus: true` (the default)
 * and exported so custom `TypingStatusFn` implementations can compose with it
 * — call `defaultTypingStatus(chunk, ctx)` to fall back to the built-in copy
 * for any chunk type you don't handle yourself.
 *
 * Status strings are written without a leading subject so platforms that
 * prepend the app name (e.g. Slack Assistant renders `<App Name> <status>`)
 * read naturally as `<App Name> is typing…`.
 *
 * Channel tools (`add_reaction`, etc.) are filtered via `ctx.channelTools` so
 * internal plumbing never bleeds into the user-facing indicator.
 *
 * | Chunk type            | Status                                     |
 * | --------------------- | ------------------------------------------ |
 * | `start`               | `is working…`                              |
 * | `text-delta`          | `is typing…`                               |
 * | `reasoning-delta`     | `is thinking…`                             |
 * | `tool-call`           | `is calling ${toolName}…`                  |
 * | `tool-call-approval`  | `is requesting approval for ${toolName}…`  |
 * | `data-om-buffering-start` | `is saving to memory…`                 |
 * | `data-om-activation`  | `is recalling memory…`                     |
 * | _everything else_     | _no change_                                |
 */
export function defaultTypingStatus(chunk: AgentChunkType<any>, ctx: TypingStatusContext): TypingStatusReturn {
  if (chunk.type.startsWith('data-')) {
    const omChunk = asOmChunk(chunk);
    if (omChunk) {
      switch (omChunk.type) {
        case 'data-om-buffering-start':
          return STATUS_TEXT.SAVING_MEMORY;
        case 'data-om-activation':
          return STATUS_TEXT.RECALLING_MEMORY;
      }
    }
  }

  switch (chunk.type) {
    case 'start':
      return STATUS_TEXT.WORKING;

    case 'text-delta':
      return STATUS_TEXT.TYPING;

    case 'reasoning-delta':
      return STATUS_TEXT.THINKING;

    case 'tool-call':
      if (ctx.channelTools.has(chunk.payload.toolName)) return undefined;
      return STATUS_TEXT.CALLING_TOOL(chunk.payload.toolName);

    case 'tool-call-approval':
      if (ctx.channelTools.has(chunk.payload.toolName)) return undefined;
      return STATUS_TEXT.REQUESTING_APPROVAL(chunk.payload.toolName);

    default:
      return undefined;
  }
}

const STATUS_TEXT = {
  TYPING: 'is typing…',
  WORKING: 'is working…',
  THINKING: 'is thinking…',
  SAVING_MEMORY: 'is saving to memory…',
  RECALLING_MEMORY: 'is recalling memory…',
  CALLING_TOOL: (name: string) => `is calling ${name}…`,
  REQUESTING_APPROVAL: (name: string) => `is requesting approval for ${name}…`,
};
