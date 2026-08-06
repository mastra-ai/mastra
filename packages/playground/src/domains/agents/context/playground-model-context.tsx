/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

interface PlaygroundModelContextType {
  provider: string;
  model: string;
  modelOverride?: string;
  setProvider: (provider: string) => void;
  setModel: (provider: string, model: string) => void;
}

interface ModelSelection {
  provider: string;
  model: string;
  explicit: boolean;
}

const PlaygroundModelContext = createContext<PlaygroundModelContextType | null>(null);

interface PlaygroundModelProviderProps {
  children: ReactNode;
  defaultProvider?: string;
  defaultModel?: string;
}

export function PlaygroundModelProvider({
  children,
  defaultProvider = '',
  defaultModel = '',
}: PlaygroundModelProviderProps) {
  const [selection, setSelection] = useState<ModelSelection>({
    provider: defaultProvider,
    model: defaultModel,
    explicit: false,
  });

  const selectProvider = (nextProvider: string) => {
    setSelection({ provider: nextProvider, model: '', explicit: false });
  };

  const selectModel = (nextProvider: string, nextModel: string) => {
    setSelection({ provider: nextProvider, model: nextModel, explicit: true });
  };

  const { provider, model, explicit } = selection;
  const modelOverride = explicit ? `${provider}/${model}` : undefined;

  return (
    <PlaygroundModelContext.Provider
      value={{ provider, model, modelOverride, setProvider: selectProvider, setModel: selectModel }}
    >
      {children}
    </PlaygroundModelContext.Provider>
  );
}

export function usePlaygroundModel() {
  const ctx = useContext(PlaygroundModelContext);
  if (!ctx) {
    throw new Error('usePlaygroundModel must be used within a PlaygroundModelProvider');
  }
  return ctx;
}

/** Like usePlaygroundModel but returns null outside the provider (e.g. shared session page). */
export function usePlaygroundModelOptional() {
  return useContext(PlaygroundModelContext) ?? undefined;
}
