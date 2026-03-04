import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/** Progress data streamed from OM in real-time (maps to DataOmStatusPart) */
export interface OmProgressData {
  windows: {
    active: {
      messages: { tokens: number; threshold: number };
      observations: { tokens: number; threshold: number };
    };
    buffered: {
      observations: {
        chunks: number;
        messageTokens: number;
        projectedMessageRemoval: number;
        observationTokens: number;
        status: 'idle' | 'running' | 'complete';
      };
      reflection: {
        inputObservationTokens: number;
        observationTokens: number;
        status: 'idle' | 'running' | 'complete';
      };
    };
  };
  recordId: string;
  threadId: string;
  stepNumber: number;
  generationCount: number;
}

interface ObservationalMemoryContextValue {
  /** Whether an observation is currently in progress (from streaming) */
  isObservingFromStream: boolean;
  /** Set observation in progress state */
  setIsObservingFromStream: (value: boolean) => void;
  /** Whether a reflection is currently in progress (from streaming) */
  isReflectingFromStream: boolean;
  /** Set reflection in progress state */
  setIsReflectingFromStream: (value: boolean) => void;
  /** Trigger to indicate new observations were received */
  observationsUpdatedAt: number;
  /** Signal that observations were updated (triggers scroll) */
  signalObservationsUpdated: () => void;
  /** Real-time progress data from streaming */
  streamProgress: OmProgressData | null;
  /** Update progress data from stream */
  setStreamProgress: (data: OmProgressData | null) => void;
  /** Set of cycleIds that have been activated (for updating buffering badges) */
  activatedCycleIds: Set<string>;
  /** Mark a cycleId as activated */
  markCycleIdActivated: (cycleId: string) => void;
  /** Clear all progress state (e.g., on thread change) */
  clearProgress: () => void;
}

const ObservationalMemoryContext = createContext<ObservationalMemoryContextValue | null>(null);

export function ObservationalMemoryProvider({ children }: { children: ReactNode }) {
  const [isObservingFromStream, setIsObservingFromStream] = useState(false);
  const [isReflectingFromStream, setIsReflectingFromStream] = useState(false);
  const [observationsUpdatedAt, setObservationsUpdatedAt] = useState(0);
  const [streamProgress, setStreamProgress] = useState<OmProgressData | null>(null);
  const [activatedCycleIds, setActivatedCycleIds] = useState<Set<string>>(new Set());

  const signalObservationsUpdated = useCallback(() => {
    setObservationsUpdatedAt(Date.now());
  }, []);

  const markCycleIdActivated = useCallback((cycleId: string) => {
    setActivatedCycleIds(prev => new Set([...prev, cycleId]));
  }, []);

  const clearProgress = useCallback(() => {
    // Don't clear streamProgress — keep last known values for sidebar display on reload
    setIsObservingFromStream(false);
    setIsReflectingFromStream(false);
    setActivatedCycleIds(new Set());
  }, []);

  return (
    <ObservationalMemoryContext.Provider
      value={{
        isObservingFromStream,
        setIsObservingFromStream,
        isReflectingFromStream,
        setIsReflectingFromStream,
        observationsUpdatedAt,
        signalObservationsUpdated,
        streamProgress,
        setStreamProgress,
        activatedCycleIds,
        markCycleIdActivated,
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
      isReflectingFromStream: false,
      setIsReflectingFromStream: () => {},
      observationsUpdatedAt: 0,
      signalObservationsUpdated: () => {},
      streamProgress: null,
      setStreamProgress: () => {},
      activatedCycleIds: new Set<string>(),
      markCycleIdActivated: () => {},
      clearProgress: () => {},
    };
  }
  return context;
}
