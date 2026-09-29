import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

export interface ToolCallContextValue {
  approveToolcall: (toolCallId: string, resumeData?: unknown) => void;
  declineToolcall: (toolCallId: string) => void;
  approveToolcallGenerate: (toolCallId: string) => void;
  declineToolcallGenerate: (toolCallId: string) => void;
  approveNetworkToolcall: (toolName: string, runId?: string) => void;
  declineNetworkToolcall: (toolName: string, runId?: string) => void;
  isRunning: boolean;
  toolCallApprovals: { [toolCallId: string]: { status: 'approved' | 'declined' } };
  networkToolCallApprovals: { [toolName: string]: { status: 'approved' | 'declined' } };
}

const ToolCallContext = createContext<ToolCallContextValue | undefined>(undefined);

interface ToolCallProviderProps extends ToolCallContextValue {
  children: ReactNode;
}

export function ToolCallProvider({
  children,
  approveToolcall,
  declineToolcall,
  approveToolcallGenerate,
  declineToolcallGenerate,
  approveNetworkToolcall,
  declineNetworkToolcall,
  isRunning,
  toolCallApprovals,
  networkToolCallApprovals,
}: ToolCallProviderProps) {
  const value = useMemo<ToolCallContextValue>(
    () => ({
      approveToolcall,
      declineToolcall,
      approveToolcallGenerate,
      declineToolcallGenerate,
      approveNetworkToolcall,
      declineNetworkToolcall,
      isRunning,
      toolCallApprovals,
      networkToolCallApprovals,
    }),
    [
      approveToolcall,
      declineToolcall,
      approveToolcallGenerate,
      declineToolcallGenerate,
      approveNetworkToolcall,
      declineNetworkToolcall,
      isRunning,
      toolCallApprovals,
      networkToolCallApprovals,
    ],
  );

  return <ToolCallContext.Provider value={value}>{children}</ToolCallContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider and its hook intentionally share this module
export function useToolCall() {
  const context = useContext(ToolCallContext);

  if (!context) {
    throw new Error('useToolCall must be used within a ToolCallProvider');
  }

  return context;
}
