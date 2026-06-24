/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface MemoryTimelineContextValue {
  /** Whether the memory studio panel is visible */
  isPanelOpen: boolean;
  /** Open the memory studio panel */
  openPanel: () => void;
  /** Close the memory studio panel */
  closePanel: () => void;
  /** Replay cursor — the timestamp selected on the timeline, or null when not replaying */
  selectedTimestamp: number | null;
  /** Set the replay cursor */
  setSelectedTimestamp: (timestamp: number | null) => void;
}

const MemoryTimelineContext = createContext<MemoryTimelineContextValue | null>(null);

export function MemoryTimelineProvider({ children }: { children: ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const value = useMemo(
    () => ({
      isPanelOpen,
      openPanel,
      closePanel,
      selectedTimestamp,
      setSelectedTimestamp,
    }),
    [isPanelOpen, openPanel, closePanel, selectedTimestamp],
  );

  return <MemoryTimelineContext.Provider value={value}>{children}</MemoryTimelineContext.Provider>;
}

const NOOP_VALUE: MemoryTimelineContextValue = {
  isPanelOpen: false,
  openPanel: () => {},
  closePanel: () => {},
  selectedTimestamp: null,
  setSelectedTimestamp: () => {},
};

export function useMemoryTimeline(): MemoryTimelineContextValue {
  const context = useContext(MemoryTimelineContext);
  // Graceful no-op fallback when not wrapped in a provider (keeps consumers decoupled & testable)
  return context ?? NOOP_VALUE;
}
