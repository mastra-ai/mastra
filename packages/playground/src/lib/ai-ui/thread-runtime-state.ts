import { createContext, useContext } from 'react';

export type ThreadRuntimeState = {
  isStreaming: boolean;
  cancelStream: () => void | Promise<void>;
};

const ThreadRuntimeStateContext = createContext<ThreadRuntimeState>({
  isStreaming: false,
  cancelStream: () => {},
});

export const ThreadRuntimeStateProvider = ThreadRuntimeStateContext.Provider;

export const useThreadRuntimeState = () => useContext(ThreadRuntimeStateContext);
