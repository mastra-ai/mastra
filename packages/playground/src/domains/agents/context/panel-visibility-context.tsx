/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'agent-panel-visibility';

interface PanelVisibilityState {
  overview: boolean;
  memory: boolean;
}

export interface PanelVisibilityContextValue {
  visibility: PanelVisibilityState;
  toggleOverview: () => void;
  toggleMemory: () => void;
}

export const PanelVisibilityContext = createContext<PanelVisibilityContextValue | null>(null);

function getInitialState(): PanelVisibilityState {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        overview: typeof parsed.overview === 'boolean' ? parsed.overview : true,
        memory: typeof parsed.memory === 'boolean' ? parsed.memory : true,
      };
    }
  } catch {
    // Ignore parsing errors
  }
  return { overview: true, memory: true };
}

export function PanelVisibilityProvider({ children }: { children: ReactNode }) {
  const [visibility, setVisibility] = useState<PanelVisibilityState>(getInitialState);

  const toggleOverview = useCallback(() => {
    setVisibility(prev => {
      const next = { ...prev, overview: !prev.overview };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleMemory = useCallback(() => {
    setVisibility(prev => {
      const next = { ...prev, memory: !prev.memory };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ visibility, toggleOverview, toggleMemory }),
    [visibility, toggleOverview, toggleMemory],
  );

  return <PanelVisibilityContext.Provider value={value}>{children}</PanelVisibilityContext.Provider>;
}
