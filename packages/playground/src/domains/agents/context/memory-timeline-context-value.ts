import { createContext } from 'react';

export interface MemoryTimelineContextValue {
  /** Whether the memory studio panel is visible */
  isPanelOpen: boolean;
  /** Open the memory studio panel */
  openPanel: () => void;
  /** Close the memory studio panel */
  closePanel: () => void;
  /** Replay cursor - the timestamp selected on the timeline, or null when not replaying */
  selectedTimestamp: number | null;
  /** Set the replay cursor */
  setSelectedTimestamp: (timestamp: number | null) => void;
}

export const MemoryTimelineContext = createContext<MemoryTimelineContextValue | null>(null);

export const NOOP_MEMORY_TIMELINE_VALUE: MemoryTimelineContextValue = {
  isPanelOpen: false,
  openPanel: () => {},
  closePanel: () => {},
  selectedTimestamp: null,
  setSelectedTimestamp: () => {},
};
