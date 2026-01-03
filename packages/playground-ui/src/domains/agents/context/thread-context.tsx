import { createContext, ReactNode, useContext } from 'react';

interface ThreadContextType {
  threadId?: string;
  agentId?: string;
  onBranchCreated?: () => void;
}

export const ThreadContext = createContext<ThreadContextType>({});

export interface ThreadProviderProps {
  children: ReactNode;
  threadId?: string;
  agentId?: string;
  onBranchCreated?: () => void;
}

export function ThreadProvider({ children, threadId, agentId, onBranchCreated }: ThreadProviderProps) {
  return (
    <ThreadContext.Provider
      value={{
        threadId,
        agentId,
        onBranchCreated,
      }}
    >
      {children}
    </ThreadContext.Provider>
  );
}

export const useThreadContext = () => {
  return useContext(ThreadContext);
};
