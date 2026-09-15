import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { MemoryTimelineContext } from './memory-timeline-context-value';

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
