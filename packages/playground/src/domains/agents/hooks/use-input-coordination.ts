import { useMemo } from 'react';
import { useBrowserToolCalls } from '../context/browser-tool-calls-context';

export interface InputCoordinationState {
  /** Whether any browser tool call is currently pending */
  isAgentBusy: boolean;
  /** Name of the currently executing browser tool (e.g., 'browser_navigate') */
  activeToolName: string | null;
  /** Number of pending browser tool calls */
  pendingCount: number;
}

/**
 * Derives input coordination state from the existing BrowserToolCallsContext.
 *
 * This hook does NOT create new state -- it reads the tool call context
 * and computes isAgentBusy as a derived value. When any browser tool call
 * has status === 'pending', the agent is actively executing.
 *
 * The derivation works because ToolFallback registers tool calls with
 * status: 'pending' when result is undefined (AI SDK streaming the call)
 * and status: 'complete' when result arrives.
 */
export function useInputCoordination(): InputCoordinationState {
  const { toolCalls } = useBrowserToolCalls();

  return useMemo(() => {
    const pendingCalls = toolCalls.filter(tc => tc.status === 'pending');
    const isAgentBusy = pendingCalls.length > 0;
    const activeToolName = isAgentBusy ? pendingCalls[0].toolName : null;

    return { isAgentBusy, activeToolName, pendingCount: pendingCalls.length };
  }, [toolCalls]);
}
