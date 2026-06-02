import type { MastraUIMessage } from '@mastra/react';
import { createContext, useContext } from 'react';

export interface RunningContextValue {
  isRunning: boolean;
}

export interface MessagesContextValue {
  messages: MastraUIMessage[];
}

export interface SendContextValue {
  send: (message: string) => void;
}

export interface ApprovalContextValue {
  approveToolCall: (toolCallId: string) => void;
  declineToolCall: (toolCallId: string) => void;
}

export const StreamRunningContext = createContext<RunningContextValue>({ isRunning: false });
export const StreamMessagesContext = createContext<MessagesContextValue>({ messages: [] });
export const StreamSendContext = createContext<SendContextValue>({ send: () => {} });
export const StreamApprovalContext = createContext<ApprovalContextValue>({
  approveToolCall: () => {},
  declineToolCall: () => {},
});

export const useStreamRunning = (): boolean => useContext(StreamRunningContext).isRunning;
export const useStreamMessages = (): MastraUIMessage[] => useContext(StreamMessagesContext).messages;
export const useStreamSend = (): ((message: string) => void) => useContext(StreamSendContext).send;
export const useStreamApproval = (): ApprovalContextValue => useContext(StreamApprovalContext);

/**
 * Returns a callback that resubmits the most recent user prompt against the
 * current builder thread, or `null` if there is no user message to retry yet
 * (e.g. a freshly opened agent before the first prompt is sent). Used by the
 * error message "Try again" affordance.
 */
export const useStreamRetry = (): (() => void) | null => {
  const messages = useStreamMessages();
  const send = useStreamSend();

  const lastUserText = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role !== 'user') continue;
      const textPart = message.parts.find(part => part.type === 'text') as { text?: string } | undefined;
      if (textPart?.text) return textPart.text;
    }
    return null;
  })();

  if (lastUserText === null) return null;
  return () => send(lastUserText);
};
