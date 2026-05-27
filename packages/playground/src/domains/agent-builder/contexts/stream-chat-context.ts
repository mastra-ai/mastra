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

export const StreamRunningContext = createContext<RunningContextValue>({ isRunning: false });
export const StreamMessagesContext = createContext<MessagesContextValue>({ messages: [] });
export const StreamSendContext = createContext<SendContextValue>({ send: () => {} });

export const useStreamRunning = (): boolean => useContext(StreamRunningContext).isRunning;
export const useStreamMessages = (): MastraUIMessage[] => useContext(StreamMessagesContext).messages;
export const useStreamSend = (): ((message: string) => void) => useContext(StreamSendContext).send;
