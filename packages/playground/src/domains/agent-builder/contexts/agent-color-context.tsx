/* eslint-disable react-refresh/only-export-components */
import { stringToColor } from '@mastra/playground-ui';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../schemas';

export type AgentColors = {
  background: string;
  foreground: string;
  /** Translucent variant of `background` for tinting surfaces (~20% alpha). */
  tintBackground: string;
  /** Slightly stronger translucent variant for hover states (~35% alpha). */
  tintBackgroundHover: string;
} | null;

export const AgentColorContext = createContext<AgentColors>(null);

interface AgentColorProviderProps {
  children: ReactNode;
}

const hslToHsla = (hsl: string, alpha: number): string => {
  const match = hsl.match(/^hsl\(([^)]+)\)$/);
  return match ? `hsla(${match[1]}, ${alpha})` : hsl;
};

export const AgentColorProvider = ({ children }: AgentColorProviderProps) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' });
  const trimmed = name?.trim() ?? '';

  const value = useMemo<AgentColors>(() => {
    if (!trimmed) return null;
    const background = stringToColor(trimmed);
    return {
      background,
      foreground: stringToColor(trimmed, 20),
      tintBackground: hslToHsla(background, 0.35),
      tintBackgroundHover: hslToHsla(background, 0.55),
    };
  }, [trimmed]);

  return <AgentColorContext.Provider value={value}>{children}</AgentColorContext.Provider>;
};

export const useAgentColor = (): AgentColors => useContext(AgentColorContext);
