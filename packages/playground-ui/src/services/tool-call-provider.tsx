'use client';

import { createContext, useContext, ReactNode } from 'react';

interface ToolCallContextValue {
  approveToolcall: () => void;
  declineToolcall: () => void;
}

const ToolCallContext = createContext<ToolCallContextValue | undefined>(undefined);

interface ToolCallProviderProps {
  children: ReactNode;
  approveToolcall: () => void;
  declineToolcall: () => void;
}

export function ToolCallProvider({ children, approveToolcall, declineToolcall }: ToolCallProviderProps) {
  return <ToolCallContext.Provider value={{ approveToolcall, declineToolcall }}>{children}</ToolCallContext.Provider>;
}

export function useToolCall() {
  const context = useContext(ToolCallContext);

  if (!context) {
    throw new Error('useToolCall must be used within a ToolCallProvider');
  }

  return context;
}
