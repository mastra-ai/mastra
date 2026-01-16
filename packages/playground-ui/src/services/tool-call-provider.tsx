import { createContext, useContext, ReactNode } from 'react';

interface ToolCallContextValue {
  approveToolcall: (toolCallId: string) => void;
  declineToolcall: (toolCallId: string) => void;
  approveNetworkToolcall: (toolName: string, runId?: string) => void;
  declineNetworkToolcall: (toolName: string, runId?: string) => void;
  isRunning: boolean;
  toolCallApprovals: { [toolCallId: string]: { status: 'approved' | 'declined' } };
  networkToolCallApprovals: { [toolName: string]: { status: 'approved' | 'declined' } };
}

const ToolCallContext = createContext<ToolCallContextValue | undefined>(undefined);

interface ToolCallProviderProps {
  children: ReactNode;
  approveToolcall: (toolCallId: string) => void;
  declineToolcall: (toolCallId: string) => void;
  approveNetworkToolcall: (toolName: string, runId?: string) => void;
  declineNetworkToolcall: (toolName: string, runId?: string) => void;
  isRunning: boolean;
  toolCallApprovals: { [toolCallId: string]: { status: 'approved' | 'declined' } };
  networkToolCallApprovals: { [toolName: string]: { status: 'approved' | 'declined' } };
}

export function ToolCallProvider({
  children,
  approveToolcall,
  declineToolcall,
  approveNetworkToolcall,
  declineNetworkToolcall,
  isRunning,
  toolCallApprovals,
  networkToolCallApprovals,
}: ToolCallProviderProps) {
  return (
    <ToolCallContext.Provider
      value={{
        approveToolcall,
        declineToolcall,
        approveNetworkToolcall,
        declineNetworkToolcall,
        isRunning,
        toolCallApprovals,
        networkToolCallApprovals,
      }}
    >
      {children}
    </ToolCallContext.Provider>
  );
}

export function useToolCall() {
  const context = useContext(ToolCallContext);

  if (!context) {
    throw new Error('useToolCall must be used within a ToolCallProvider');
  }

  return context;
}
