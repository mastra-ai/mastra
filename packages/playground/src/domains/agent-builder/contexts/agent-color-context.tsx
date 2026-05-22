/* eslint-disable react-refresh/only-export-components */
import { stringToColor } from '@mastra/playground-ui';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../schemas';

export type AgentColors = {
  background: string;
  foreground: string;
  tint: string;
} | null;

export const AgentColorContext = createContext<AgentColors>(null);

interface AgentColorProviderProps {
  children: ReactNode;
}

export const AgentColorProvider = ({ children }: AgentColorProviderProps) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' });
  const trimmed = name?.trim() ?? '';

  const value = useMemo<AgentColors>(() => {
    if (!trimmed) return null;

    return {
      background: stringToColor(trimmed),
      foreground: stringToColor(trimmed, 20),
      tint: stringToColor(trimmed, 50),
    };
  }, [trimmed]);

  return <AgentColorContext.Provider value={value}>{children}</AgentColorContext.Provider>;
};

export const useAgentColor = (): AgentColors => useContext(AgentColorContext);
