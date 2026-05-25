import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

interface PlaygroundModelContextType {
  provider: string;
  model: string;
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
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
  const [provider, setProvider] = useState(defaultProvider);
  const [model, setModel] = useState(defaultModel);

  // Sync from form when it loads (defaultProvider/defaultModel may be empty on first render)
  useEffect(() => {
    if (defaultProvider && !provider) setProvider(defaultProvider);
  }, [defaultProvider]);

  useEffect(() => {
    if (defaultModel && !model) setModel(defaultModel);
  }, [defaultModel]);

  return (
    <PlaygroundModelContext.Provider value={{ provider, model, setProvider, setModel }}>
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
