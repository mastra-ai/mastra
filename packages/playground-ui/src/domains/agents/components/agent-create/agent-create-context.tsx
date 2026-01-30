'use client';

import { createContext, useContext, useRef, type ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { useAgentCreateForm, type UseAgentCreateFormOptions } from './use-agent-create-form';
import type { AgentFormValues } from '../create-agent/form-validation';

interface EntityOption {
  id: string;
  name: string;
  description: string;
}

export interface AgentCreateContextValue {
  form: UseFormReturn<AgentFormValues>;
  isLoading: boolean;
  toolOptions: EntityOption[];
  workflowOptions: EntityOption[];
  agentOptions: EntityOption[];
  memoryOptions: EntityOption[];
  scorerOptions: EntityOption[];
  toolsLoading: boolean;
  workflowsLoading: boolean;
  agentsLoading: boolean;
  memoryConfigsLoading: boolean;
  scorersLoading: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
}

const AgentCreateContext = createContext<AgentCreateContextValue | null>(null);

export interface AgentCreateProviderProps extends UseAgentCreateFormOptions {
  children: ReactNode;
}

export function AgentCreateProvider({ children, ...options }: AgentCreateProviderProps) {
  const formState = useAgentCreateForm(options);
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <AgentCreateContext.Provider value={{ ...formState, formRef }}>
      {children}
    </AgentCreateContext.Provider>
  );
}

export function useAgentCreateContext() {
  const context = useContext(AgentCreateContext);
  if (!context) {
    throw new Error('useAgentCreateContext must be used within an AgentCreateProvider');
  }
  return context;
}
