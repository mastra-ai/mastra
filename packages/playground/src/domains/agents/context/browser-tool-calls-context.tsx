import { createContext, useContext, useCallback, useState, useMemo } from 'react';
import type { ReactNode } from 'react';

const BROWSER_TOOL_PREFIXES = ['browser_', 'stagehand_'];

export function isBrowserTool(toolName: string): boolean {
  return BROWSER_TOOL_PREFIXES.some(prefix => toolName.startsWith(prefix));
}

export interface BrowserToolCallEntry {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown | undefined;
  status: 'pending' | 'complete' | 'error';
  timestamp: number;
}

/**
 * Checks if a tool result indicates an error.
 * Browser tools return { success: false, code, message } on failure.
 */
export function isBrowserToolError(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const r = result as Record<string, unknown>;
  return r.success === false && typeof r.code === 'string';
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

  const toolCalls = useMemo(
    () => Array.from(toolCallMap.values()).sort((a, b) => a.timestamp - b.timestamp),
    [toolCallMap],
  );

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
