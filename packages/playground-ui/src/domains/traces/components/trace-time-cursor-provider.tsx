import { useState } from 'react';
import type { ReactNode } from 'react';
import { createTraceTimeCursorStore, TraceTimeCursorContext } from '../hooks/use-trace-time-cursor';
import type { TraceTimeCursorStore } from '../hooks/use-trace-time-cursor';

export function TraceTimeCursorProvider({ store, children }: { store?: TraceTimeCursorStore; children: ReactNode }) {
  const [own] = useState(() => store ?? createTraceTimeCursorStore());
  return <TraceTimeCursorContext value={store ?? own}>{children}</TraceTimeCursorContext>;
}
