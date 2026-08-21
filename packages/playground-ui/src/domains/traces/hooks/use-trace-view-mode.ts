import { useState } from 'react';
import type { TraceViewMode } from '../types';

const TRACE_VIEW_MODE_STORAGE_KEY = 'mastra:traces:view-mode';

function readStoredViewMode(): TraceViewMode {
  if (typeof window === 'undefined') return 'review';

  try {
    const stored = window.localStorage.getItem(TRACE_VIEW_MODE_STORAGE_KEY);
    return stored === 'advanced' || stored === 'review' ? stored : 'review';
  } catch {
    return 'review';
  }
}

export function useTraceViewMode() {
  const [viewMode, setViewModeState] = useState<TraceViewMode>(readStoredViewMode);

  const setViewMode = (mode: TraceViewMode) => {
    setViewModeState(mode);
    try {
      window.localStorage.setItem(TRACE_VIEW_MODE_STORAGE_KEY, mode);
    } catch {}
  };

  return { viewMode, setViewMode };
}
