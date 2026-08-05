import { useContext } from 'react';

import { MemoryTimelineContext, NOOP_MEMORY_TIMELINE_VALUE } from './memory-timeline-context-value';

export function useMemoryTimeline() {
  const context = useContext(MemoryTimelineContext);
  // Graceful no-op fallback when not wrapped in a provider keeps consumers decoupled and testable.
  return context ?? NOOP_MEMORY_TIMELINE_VALUE;
}
