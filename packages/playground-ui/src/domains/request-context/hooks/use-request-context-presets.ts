import { useMemo } from 'react';

export interface RequestContextPresets {
  [key: string]: Record<string, unknown>;
}

export function useRequestContextPresets(): RequestContextPresets | null {
  return useMemo(() => {
    const presetsStr = typeof window !== 'undefined' ? (window as any).MASTRA_REQUEST_CONTEXT_PRESETS : undefined;

    if (!presetsStr || presetsStr === '%%MASTRA_REQUEST_CONTEXT_PRESETS%%') {
      return null;
    }

    try {
      const parsed = JSON.parse(presetsStr);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as RequestContextPresets;
      }
    } catch {
      console.warn('Failed to parse request context presets');
    }

    return null;
  }, []);
}
