'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/** Progress data streamed from OM in real-time */
export interface OmProgressData {
  pendingTokens: number;
  threshold: number;
  thresholdPercent: number;
  observationTokens: number;
  reflectionThreshold: number;
  reflectionThresholdPercent: number;
  willObserve: boolean;
  recordId: string;
  threadId: string;
  stepNumber: number;
}

interface ObservationalMemoryContextValue {
  /** Whether an observation is currently in progress (from streaming) */
  isObservingFromStream: boolean;
  /** Set observation in progress state */
  setIsObservingFromStream: (value: boolean) => void;
  /** Trigger to indicate new observations were received */
  observationsUpdatedAt: number;
  /** Signal that observations were updated (triggers scroll) */
  signalObservationsUpdated: () => void;
  /** Real-time progress data from streaming */
  streamProgress: OmProgressData | null;
  /** Update progress data from stream */
  setStreamProgress: (data: OmProgressData | null) => void;
  /** Clear all progress state (e.g., on thread change) */
  clearProgress: () => void;
}

const ObservationalMemoryContext = createContext<ObservationalMemoryContextValue | null>(null);

export function ObservationalMemoryProvider({ children }: { children: ReactNode }) {
  const [isObservingFromStream, setIsObservingFromStream] = useState(false);
  const [observationsUpdatedAt, setObservationsUpdatedAt] = useState(0);
  const [streamProgress, setStreamProgress] = useState<OmProgressData | null>(null);

  const signalObservationsUpdated = useCallback(() => {
    setObservationsUpdatedAt(Date.now());
  }, []);

  const clearProgress = useCallback(() => {
    setStreamProgress(null);
    setIsObservingFromStream(false);
  }, []);

  return (
    <ObservationalMemoryContext.Provider
      value={{
        isObservingFromStream,
        setIsObservingFromStream,
        observationsUpdatedAt,
        signalObservationsUpdated,
        streamProgress,
        setStreamProgress,
        clearProgress,
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
      streamProgress: null,
      setStreamProgress: () => {},
      clearProgress: () => {},
    };
  }
  return context;
}
