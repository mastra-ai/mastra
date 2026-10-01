import type { Message, Thread } from 'chat';

import type { IMastraLogger } from '../logger/logger';
import { chatModule } from './chat-lazy';

/**
 * How far past the history window the first-mention walk counts omitted
 * messages before giving up on an exact count. Slack's backward paging fetches
 * at least 200 per call, so this costs at most a few calls.
 */
export const THREAD_HISTORY_OMITTED_CAP = 500;

/** Prior platform messages gathered for a first mention. */
export interface ThreadHistoryWindow {
  /** The thread's first message, when it falls outside `recent`. */
  root: Message | undefined;
  /** Messages between `root` and `recent` that are not included. */
  omitted: number;
  /** True when the walk stopped at THREAD_HISTORY_OMITTED_CAP; `omitted` is a lower bound. */
  capped: boolean;
  /** The most recent `maxMessages - 1` messages before the trigger, oldest first. */
  recent: Message[];
}

/** Rich text when the platform provided it, else the plain text. */
export function messageText(message: Message): string {
  const richText = message.formatted ? chatModule().stringifyMarkdown(message.formatted).trim() : undefined;
  return richText || message.text;
}

/** Gap marker between the thread's first message and the recent window, e.g. `[… 6 earlier Slack messages omitted]`. */
export function formatOmittedMarker(platform: string, omitted: string): string {
  const label = platform.charAt(0).toUpperCase() + platform.slice(1);
  return `[… ${omitted} earlier ${label} messages omitted]`;
}

/** The omitted count as rendered, with a `+` suffix when the walk hit the cap. */
export function formatOmittedCount(history: ThreadHistoryWindow): string {
  return `${history.omitted}${history.capped ? '+' : ''}`;
}

/**
 * Collect the platform thread's prior messages for a first mention: the
 * thread's root message, how many messages sit between it and the window,
 * and the most recent `maxMessages - 1` messages (oldest first), excluding
 * the messages that triggered this request.
 *
 * The platform exposes no reply count, so the omitted count comes from
 * walking `chatThread.messages` (newest first) past the window. The walk
 * stops at THREAD_HISTORY_OMITTED_CAP; beyond that the root is fetched from
 * the front of the thread and the count renders as `${cap}+`.
 */
export async function collectThreadHistory(
  chatThread: Thread,
  excludeIds: ReadonlySet<string>,
  maxMessages: number,
  logger?: IMastraLogger,
): Promise<ThreadHistoryWindow> {
  const recentLimit = Math.max(0, maxMessages - 1);
  const recent: Message[] = []; // newest first while walking
  const older: Message[] = []; // newest first, everything past the window

  try {
    for await (const msg of chatThread.messages) {
      if (excludeIds.has(msg.id)) continue;
      if (recent.length < recentLimit) {
        recent.push(msg);
        continue;
      }
      older.push(msg);
      if (older.length >= THREAD_HISTORY_OMITTED_CAP) break;
    }
  } catch (err) {
    logger?.warn?.(`Failed to fetch thread history: ${err}`);
    return { root: undefined, omitted: 0, capped: false, recent: [] };
  }
  recent.reverse();

  if (older.length < THREAD_HISTORY_OMITTED_CAP) {
    // Walk exhausted: the oldest message seen is the thread root.
    if (older.length === 0) return { root: undefined, omitted: 0, capped: false, recent };
    return { root: older[older.length - 1], omitted: older.length - 1, capped: false, recent };
  }

  // Cap hit: fetch the root from the front of the thread.
  let root: Message | undefined;
  try {
    for await (const msg of chatThread.allMessages) {
      root = msg;
      break;
    }
  } catch (err) {
    logger?.warn?.(`Failed to fetch thread root message: ${err}`);
    return { root: undefined, omitted: 0, capped: false, recent };
  }
  if (!root) return { root: undefined, omitted: 0, capped: false, recent };
  const walked = new Set([...recent, ...older].map(m => m.id));
  if (walked.has(root.id)) {
    // The walk already reached the root (only possible when the thread has
    // exactly cap + window messages); treat as exhausted. `older` is at the
    // cap here, so the root is its oldest entry, never inside `recent`.
    return { root: older[older.length - 1], omitted: older.length - 1, capped: false, recent };
  }
  return { root, omitted: THREAD_HISTORY_OMITTED_CAP, capped: true, recent };
}

/** The pre-signals history shape, kept for agents that cannot persist rows. */
export function formatLegacyHistoryBlock(history: ThreadHistoryWindow, chatThread: Thread, platform: string): string {
  const lines = ['[Thread context — messages in this thread before you joined]'];
  const line = (msg: Message) => {
    const author = msg.author.fullName || msg.author.userName || 'Unknown';
    const mention = msg.author.userId ? chatThread.mentionUser(msg.author.userId) : undefined;
    let prefix = mention ? `${author} (${mention})` : author;
    if (msg.author.isBot === true) prefix += ' (bot)';
    return `[${prefix}] (msg:${msg.id}): ${messageText(msg)}`;
  };
  if (history.root) {
    lines.push(line(history.root));
    if (history.omitted > 0) lines.push(formatOmittedMarker(platform, formatOmittedCount(history)));
  }
  for (const msg of history.recent) lines.push(line(msg));
  return lines.join('\n');
}
