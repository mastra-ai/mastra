import { createContext, useContext } from 'react';

export type PendingSignalMessage = {
  id: string;
  preview: string;
};

export type ThreadStateSignal = {
  id: string;
  title: string;
  preview: string;
  source?: string;
  updatedAt?: string;
};

export type ThreadNotificationSignal = {
  id: string;
  title: string;
  preview: string;
  source?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
  count?: number;
};

export type ThreadRuntimeState = {
  isStreaming: boolean;
  canSendWhileStreaming: boolean;
  cancelStream: () => void | Promise<void>;
  pendingSignals: PendingSignalMessage[];
  hasPendingMessages: boolean;
  stateSignals: ThreadStateSignal[];
  notifications: ThreadNotificationSignal[];
};

const ThreadRuntimeStateContext = createContext<ThreadRuntimeState>({
  isStreaming: false,
  canSendWhileStreaming: false,
  cancelStream: () => {},
  pendingSignals: [],
  hasPendingMessages: false,
  stateSignals: [],
  notifications: [],
});

export const ThreadRuntimeStateProvider = ThreadRuntimeStateContext.Provider;

export const useThreadRuntimeState = () => useContext(ThreadRuntimeStateContext);
