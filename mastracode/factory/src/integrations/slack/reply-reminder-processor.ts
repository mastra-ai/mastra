import type { MastraDBMessage } from '@mastra/core/agent';
import type { ProcessInputStepArgs, Processor } from '@mastra/core/processors';

import { REPLY_TOOL_NAME } from './reply-tool.js';

const ID = 'factory-reply-reminder';

/** How long a run may work without posting before it is nudged. */
export const REPLY_REMINDER_AFTER_MS = 5 * 60_000;

interface ReminderState {
  /** When the current silence started: run start, last post, or last nudge. */
  quietSince?: number;
  seenCalls?: string[];
}

export interface FactoryReplyReminderOptions {
  afterMs?: number;
  now?: () => number;
}

/**
 * With reply text hidden, a long job can run silently for an hour while the
 * person who asked has no idea whether anything is happening. Once a run has
 * gone `afterMs` without calling `reply_in_thread`, this sends the agent one
 * signal suggesting a status update, then restarts the clock. Ignoring it is
 * how the agent stays quiet. A signal joins the end of the transcript, so the
 * cached prompt prefix is untouched. Only runs that have the reply tool are
 * touched.
 */
export class FactoryReplyReminderProcessor implements Processor {
  readonly id = ID;
  readonly #afterMs: number;
  readonly #now: () => number;

  constructor({ afterMs = REPLY_REMINDER_AFTER_MS, now = Date.now }: FactoryReplyReminderOptions = {}) {
    this.#afterMs = afterMs;
    this.#now = now;
  }

  async processInputStep({ messageList, tools, state, sendSignal }: ProcessInputStepArgs) {
    if (!tools || !(REPLY_TOOL_NAME in tools) || !sendSignal) return undefined;
    const reminder = state as ReminderState;
    const now = this.#now();
    reminder.quietSince ??= now;

    const seen = new Set(reminder.seenCalls ?? []);
    const calls = replyCalls(messageList.get.response.db());
    if (calls.some(id => !seen.has(id))) reminder.quietSince = now;
    reminder.seenCalls = calls;

    const silentFor = now - reminder.quietSince;
    if (silentFor < this.#afterMs) return undefined;
    const minutes = Math.floor(silentFor / 60_000);
    await sendSignal({
      type: 'reactive',
      contents: `It has been ${minutes} minute${minutes === 1 ? '' : 's'} since you last posted in this thread. If the people there would want to know where things stand, post a short status with \`${REPLY_TOOL_NAME}\`. Otherwise keep working.`,
    });
    reminder.quietSince = now;
    return undefined;
  }
}

/** Ids of the `reply_in_thread` calls this run has finished. */
function replyCalls(messages: MastraDBMessage[]): string[] {
  const ids: string[] = [];
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const part of message.content.parts ?? []) {
      if (part.type !== 'tool-invocation') continue;
      const { toolName, toolCallId, state } = part.toolInvocation;
      if (toolName === REPLY_TOOL_NAME && state === 'result') ids.push(toolCallId);
    }
  }
  return ids;
}
