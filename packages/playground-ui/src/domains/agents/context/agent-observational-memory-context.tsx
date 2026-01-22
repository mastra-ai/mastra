'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ObservationalMemoryContextValue {
  /** Whether an observation is currently in progress (from streaming) */
  isObservingFromStream: boolean;
  /** Set observation in progress state */
  setIsObservingFromStream: (value: boolean) => void;
  /** Trigger to indicate new observations were received */
  observationsUpdatedAt: number;
  /** Signal that observations were updated (triggers scroll) */
  signalObservationsUpdated: () => void;
}

const ObservationalMemoryContext = createContext<ObservationalMemoryContextValue | null>(null);

export function ObservationalMemoryProvider({ children }: { children: ReactNode }) {
  const [isObservingFromStream, setIsObservingFromStream] = useState(false);
  const [observationsUpdatedAt, setObservationsUpdatedAt] = useState(0);

  const signalObservationsUpdated = useCallback(() => {
    setObservationsUpdatedAt(Date.now());
  }, []);

  return (
    <ObservationalMemoryContext.Provider
      value={{
        isObservingFromStream,
        setIsObservingFromStream,
        observationsUpdatedAt,
        signalObservationsUpdated,
      }}
    >
      {children}
    </ObservationalMemoryContext.Provider>
  );
}

export function useObservationalMemoryContext() {
  const context = useContext(ObservationalMemoryContext);
  if (!context) {
    // Return a no-op context if not wrapped in provider (graceful degradation)
    return {
      isObservingFromStream: false,
      setIsObservingFromStream: () => {},
      observationsUpdatedAt: 0,
      signalObservationsUpdated: () => {},
    };
  }
  return context;
}
