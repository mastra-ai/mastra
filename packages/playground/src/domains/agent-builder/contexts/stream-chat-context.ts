import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { createContext, useContext } from 'react';

export interface RunningContextValue {
  isRunning: boolean;
}

export interface MessagesContextValue {
  messages: MastraDBMessage[];
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
export const useStreamMessages = (): MastraDBMessage[] => useContext(StreamMessagesContext).messages;
export const useStreamSend = (): ((message: string) => void) => useContext(StreamSendContext).send;
export const useStreamApproval = (): ApprovalContextValue => useContext(StreamApprovalContext);
