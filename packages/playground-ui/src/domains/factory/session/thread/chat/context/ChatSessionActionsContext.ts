import type { ModelSelectionRequest } from '@internal/factory-contract';
import type { PlanResume } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { createContext } from 'react';

export interface OutgoingMessage {
  text: string;
  /** Base64-encoded attachments (e.g. pasted images). */
  files?: Array<{ data: string; mediaType: string; filename?: string }>;
}

export interface ChatGoalActions {
  set: (objective: string) => Promise<unknown>;
  pause: () => Promise<unknown>;
  resume: () => Promise<unknown>;
  clear: () => Promise<unknown>;
}

/**
 * What the chat UI can ask the session to do. Each surface supplies it from its own runtime;
 * optional members are capabilities the UI hides when absent.
 */
export interface ChatSessionActionsApi {
  send: (message: OutgoingMessage | string) => Promise<unknown>;
  sending: boolean;
  abort: () => Promise<unknown>;
  /** Rejects with a {@link RejectedReplyError} when the reply was not delivered. */
  approveTool: (toolCallId: string, approved: boolean) => Promise<unknown>;
  respondToSuspension: (
    toolCallId: string,
    resumeData: string | string[] | PlanResume,
    options?: { quietWhenEnded?: boolean },
  ) => Promise<unknown>;
  replying: boolean;
  createThread: () => Promise<{ id: string }>;
  /** Seeds a new thread's first message so its page renders before history loads. */
  seedThreadMessages?: (threadId: string, messages: MastraDBMessage[]) => void;
  /** A thread switch is in flight; the bound thread is unknown until it lands. */
  switchingThread: boolean;
  /** Queues a message to run after the current one. */
  followUp?: (text: string) => Promise<unknown>;
  goal?: ChatGoalActions;
  /** Pins the session to a model before its first message. */
  model?: { setSelection: (selection: ModelSelectionRequest) => Promise<unknown> };
  /** The session's threads, for titles. */
  threads?: { list: readonly ChatThreadSummary[] | undefined };
}

export interface ChatThreadSummary {
  id: string;
  title?: string;
}

export class RejectedReplyError extends Error {
  constructor(readonly reason: string | undefined) {
    super(
      reason === 'no_pending_suspension'
        ? 'This request is no longer waiting for a reply. Its run has ended.'
        : 'Your reply was not delivered. Someone may have already answered it.',
    );
  }
}

/** True when nothing will ever answer the prompt, so its card should go. */
export function isEndedPrompt(error: unknown): boolean {
  return error instanceof RejectedReplyError && error.reason === 'no_pending_suspension';
}

export const ChatSessionActionsContext = createContext<ChatSessionActionsApi | null>(null);
