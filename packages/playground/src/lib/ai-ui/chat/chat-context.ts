import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { CoreUserMessage } from '@mastra/core/llm';
import type { TaskItem } from '@mastra/core/signals';
import { createContext, useContext } from 'react';

/**
 * Plain-prop chat context for the main agent chat, replacing the assistant-ui
 * `useExternalStoreRuntime` runtime and the `ToolCallProvider`.
 *
 * The context is split into focused slices so that high-churn message updates
 * don't force the composer / running consumers to re-render and vice versa.
 */

export interface ChatSendArgs {
  /** Plain user text. */
  message: string;
  /** Attachments already converted to core user messages (images / files). */
  attachments?: CoreUserMessage[];
}

export interface MessagesContextValue {
  /** Live `useChat` messages merged with persisted-surviving stream errors. */
  messages: MastraDBMessage[];
}

export interface RunningContextValue {
  /** True while streaming OR awaiting a tool approval. Gates composer send/cancel state. */
  isRunning: boolean;
  /** Cancels the in-flight run (abort + OM reset + cancelRun). */
  cancelRun: () => void | Promise<void>;
  /** Whether the composer may send a new message mid-stream (thread signals). */
  canSendWhileStreaming: boolean;
}

export interface SendContextValue {
  send: (args: ChatSendArgs) => void;
}

export interface TasksContextValue {
  tasks: TaskItem[];
}

// NOTE: Tool/network approvals are NOT exposed here. The badge approval buttons
// consume the existing `ToolCallProvider` (`@/services/tool-call-provider`),
// which `ChatProvider` renders directly with `useChat`'s handlers — identical to
// how `MastraRuntimeProvider` wired them. That keeps every badge unchanged and
// preserves the `approveNetworkToolCall(toolName, runId?)` contract.

export const ChatMessagesContext = createContext<MessagesContextValue>({ messages: [] });
export const ChatRunningContext = createContext<RunningContextValue>({
  isRunning: false,
  cancelRun: () => {},
  canSendWhileStreaming: false,
});
export const ChatSendContext = createContext<SendContextValue>({ send: () => {} });
export const ChatTasksContext = createContext<TasksContextValue>({ tasks: [] });

export const useChatMessages = (): MastraDBMessage[] => useContext(ChatMessagesContext).messages;
export const useChatRunning = (): RunningContextValue => useContext(ChatRunningContext);
export const useChatSend = (): SendContextValue['send'] => useContext(ChatSendContext).send;
export const useChatTasks = (): TaskItem[] => useContext(ChatTasksContext).tasks;
