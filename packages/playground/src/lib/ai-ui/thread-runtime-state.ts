import { createContext, useContext } from 'react';

export type PendingSignalMessage = {
  id: string;
  preview: string;
};

export type ThreadRuntimeState = {
  isStreaming: boolean;
  cancelStream: () => void | Promise<void>;
  pendingSignals: PendingSignalMessage[];
  hasPendingMessages: boolean;
};

const ThreadRuntimeStateContext = createContext<ThreadRuntimeState>({
  isStreaming: false,
  cancelStream: () => {},
  pendingSignals: [],
  hasPendingMessages: false,
});

export const ThreadRuntimeStateProvider = ThreadRuntimeStateContext.Provider;

export const useThreadRuntimeState = () => useContext(ThreadRuntimeStateContext);
