'use client';

import { createContext, useContext, ReactNode } from 'react';

interface ToolCallContextValue {
  approveToolcall: (toolCallId: string) => void;
  declineToolcall: (toolCallId: string) => void;
  isRunning: boolean;
}

const ToolCallContext = createContext<ToolCallContextValue | undefined>(undefined);

interface ToolCallProviderProps {
  children: ReactNode;
  approveToolcall: (toolCallId: string) => void;
  declineToolcall: (toolCallId: string) => void;
  isRunning: boolean;
}

export function ToolCallProvider({ children, approveToolcall, declineToolcall, isRunning }: ToolCallProviderProps) {
  return (
    <ToolCallContext.Provider value={{ approveToolcall, declineToolcall, isRunning }}>
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
