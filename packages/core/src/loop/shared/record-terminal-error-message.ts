/**
 * Terminal-error recording for the agentic loops.
 *
 * Error chunks are deferred until every recovery avenue (model retries, error
 * processors, fallback models) is exhausted, and `buildMessagesFromChunks`
 * turns an error chunk into no parts at all. A turn that produced no normal
 * output therefore created no assistant message, so the failed turn vanished
 * from thread history: only the orphan-guard-blocked user message remained.
 *
 * This helper runs only at the loops' established terminal-error decision
 * point and appends a first-class `error` part — analogous to the stored
 * `step-start` part — to the assistant record of the failed attempt, creating
 * a normal error-only assistant message when the attempt produced nothing.
 * Because that message is a real assistant record, the failed turn forms a
 * persistable pair with its user message through the ordinary memory path.
 *
 * Only `{ name, message }` is persisted. Stack traces, causes, custom
 * enumerable fields and custom `toJSON` output stay on the runtime error
 * surfaces (stream chunk, `onError`, `result.error`); thread history has to be
 * deterministic, JSON-safe and safe to hand to clients.
 */

import { randomUUID } from 'node:crypto';

import type { MastraDBMessage, MastraErrorPart, MessageList } from '../../agent/message-list';

const FALLBACK_ERROR_NAME = 'Error';
const FALLBACK_ERROR_MESSAGE = 'Unknown error';

/**
 * Read one string field off an unknown error without letting a throwing getter
 * or proxy escape. Blank and whitespace-only values count as absent so a
 * persisted record never holds an empty string.
 */
function readErrorField(error: object, field: 'name' | 'message'): string | undefined {
  let value: unknown;
  try {
    value = (error as Record<string, unknown>)[field];
  } catch {
    return undefined;
  }
  if (typeof value !== 'string') return undefined;
  return value.trim().length > 0 ? value : undefined;
}

/**
 * Reduce an unknown terminal error to the JSON-safe identity that gets stored.
 * Never mutates the supplied error and never invokes `toJSON`, so a hostile or
 * circular error object cannot change what lands in history — or break it.
 */
export function toPersistedErrorIdentity(error: unknown): MastraErrorPart['error'] {
  if (error === null || (typeof error !== 'object' && typeof error !== 'function')) {
    return { name: FALLBACK_ERROR_NAME, message: FALLBACK_ERROR_MESSAGE };
  }

  return {
    name: readErrorField(error, 'name') ?? FALLBACK_ERROR_NAME,
    message: readErrorField(error, 'message') ?? FALLBACK_ERROR_MESSAGE,
  };
}

export type RecordTerminalErrorMessageArgs = {
  messageList: MessageList;
  /**
   * Materialization id of the failed attempt — the id its partial output was
   * stored under before error processors ran.
   */
  attemptId?: string;
  /**
   * Active response id after error processors ran. An error processor may have
   * rotated it, in which case it no longer matches `attemptId`.
   */
  activeId?: string;
  error: unknown;
};

/**
 * Record a terminal failure as an `error` part on the failed attempt's
 * assistant message, creating that message when the attempt produced no
 * output. Returns the message carrying the part, or undefined when there was
 * no assistant record to attach it to and none could be created.
 */
export function recordTerminalErrorMessage({
  messageList,
  attemptId,
  activeId,
  error,
}: RecordTerminalErrorMessageArgs): MastraDBMessage | undefined {
  const errorPart: MastraErrorPart = { type: 'error', error: toPersistedErrorIdentity(error) };
  const messages = messageList.get.all.db();

  // Prefer the failed attempt's own record so a rotated response id cannot
  // split partial output from its error. Deliberately never falls back to an
  // unrelated last assistant message.
  const target =
    (attemptId ? messages.find(message => message.id === attemptId) : undefined) ??
    (activeId ? messages.find(message => message.id === activeId) : undefined);

  const targetParts = target?.role === 'assistant' ? target.content?.parts : undefined;
  if (target && Array.isArray(targetParts)) {
    // A retried attempt can reach this point more than once; history keeps one
    // error part per record.
    if (targetParts.some(part => part?.type === 'error')) return target;

    targetParts.push(errorPart);
    // Re-add the same object rather than a copy: MessageList tracks messages by
    // identity, so this re-registers the record as unsaved (a debounced mid-run
    // flush may already have drained it) without leaving a stale duplicate
    // behind. `merge: false` keeps the part on this record instead of letting
    // the merger fold it into whatever assistant message happens to be last.
    messageList.add(target, 'response', { merge: false });
    return target;
  }

  // Reusing an id that already belongs to a record we cannot append to would
  // make MessageList replace-by-id and orphan the previous object in its
  // tracking sets, so only reuse an id that is actually free.
  const id = [activeId, attemptId].find(candidate => candidate && !messages.some(message => message.id === candidate));
  const message: MastraDBMessage = {
    id: id ?? randomUUID(),
    role: 'assistant',
    createdAt: new Date(),
    content: { format: 2, parts: [errorPart] },
  };

  messageList.add(message, 'response', { merge: false });
  return message;
}
