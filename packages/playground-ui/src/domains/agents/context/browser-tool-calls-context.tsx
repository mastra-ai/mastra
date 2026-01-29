import { createContext, useContext, useCallback, useState, useMemo, type ReactNode } from 'react';

const BROWSER_TOOL_PREFIX = 'browser_';

export function isBrowserTool(toolName: string): boolean {
  return toolName.startsWith(BROWSER_TOOL_PREFIX);
}

export interface BrowserToolCallEntry {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown | undefined;
  status: 'pending' | 'complete' | 'error';
  timestamp: number;
}

interface BrowserToolCallsContextValue {
  toolCalls: BrowserToolCallEntry[];
  registerToolCall: (entry: BrowserToolCallEntry) => void;
}

const BrowserToolCallsContext = createContext<BrowserToolCallsContextValue | null>(null);

export function BrowserToolCallsProvider({ children }: { children: ReactNode }) {
  const [toolCallMap, setToolCallMap] = useState<Map<string, BrowserToolCallEntry>>(new Map());

  const registerToolCall = useCallback((entry: BrowserToolCallEntry) => {
    setToolCallMap(prev => {
      const existing = prev.get(entry.toolCallId);
      // Skip no-op updates
      if (existing && existing.result === entry.result && existing.status === entry.status) {
        return prev;
      }
      const next = new Map(prev);
      // Preserve original timestamp on upsert
      next.set(entry.toolCallId, existing ? { ...entry, timestamp: existing.timestamp } : entry);
      return next;
    });
  }, []);

  const toolCalls = useMemo(() => Array.from(toolCallMap.values()).sort((a, b) => a.timestamp - b.timestamp), [toolCallMap]);

  const value = useMemo(() => ({ toolCalls, registerToolCall }), [toolCalls, registerToolCall]);

  return <BrowserToolCallsContext.Provider value={value}>{children}</BrowserToolCallsContext.Provider>;
}

/**
 * Consumer hook for reading browser tool calls.
 * Must be used within a BrowserToolCallsProvider.
 */
export function useBrowserToolCalls(): BrowserToolCallsContextValue {
  const ctx = useContext(BrowserToolCallsContext);
  if (!ctx) {
    throw new Error('useBrowserToolCalls must be used within a BrowserToolCallsProvider');
  }
  return ctx;
}

/**
 * Safe variant that returns null outside the provider.
 * Used by ToolFallback which may render in non-agent contexts.
 */
export function useBrowserToolCallsSafe(): BrowserToolCallsContextValue | null {
  return useContext(BrowserToolCallsContext);
}
