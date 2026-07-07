import type { PlanResume } from '@mastra/client-js';
import { createContext, useCallback, useContext } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
// Deep imports (not the workspaces barrel): the barrel re-exports components
// that consume this chat context, so importing it here would create a cycle.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { useProjectSessionSync } from '../../workspaces/hooks/useProjectSessionSync';
import { deriveProjectPath } from '../../workspaces/hooks/useWorkspaces';
import type { AgentControllerSessionApi } from '../hooks/useAgentControllerSession';
import { useAgentControllerSession } from '../hooks/useAgentControllerSession';
import { AGENT_CONTROLLER_ID } from '../services/constants';

/**
 * Owns the agent-controller session for the active project plus the derived
 * chat-run state (`busy`, `showWorkingIndicator`) and the stable prompt
 * callbacks. Chat-session state lives here — overlay/palette visibility is
 * deliberately elsewhere (`lib/overlays`) so the two never mix again.
 */
export interface ChatSessionApi extends AgentControllerSessionApi {
  /** Whether the agent is mid-run or a local send is pending. */
  busy: boolean;
  /**
   * Show the "working" indicator while busy, unless the last transcript entry
   * is a streaming assistant message that already has visible text (the
   * stream itself is then the feedback).
   */
  showWorkingIndicator: boolean;
  onApprove: (toolCallId: string, approved: boolean, id: string) => void;
  onRespond: (toolCallId: string, data: string | string[] | PlanResume, id: string) => void;
}

const ChatSessionContext = createContext<ChatSessionApi | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const { baseUrl } = useApiConfig();
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();

  const session = useAgentControllerSession({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath: deriveProjectPath(activeProject),
    baseUrl,
    enabled: sessionEnabled,
  });
  const { transcript, status, approveTool, respondSuspension } = session;

  useProjectSessionSync({ session, status, resourceId, activeProject });

  const onApprove = useCallback(
    (toolCallId: string, approved: boolean, id: string) => void approveTool(toolCallId, approved, id),
    [approveTool],
  );
  const onRespond = useCallback(
    (toolCallId: string, data: string | string[] | PlanResume, id: string) =>
      void respondSuspension(toolCallId, data, id),
    [respondSuspension],
  );

  const busy = transcript.running || transcript.pending;
  const lastEntry = transcript.entries[transcript.entries.length - 1];
  const lastEntryHasText =
    lastEntry?.kind === 'message' &&
    lastEntry.message.role === 'assistant' &&
    lastEntry.message.content.parts.some(part => part.type === 'text' && part.text.trim().length > 0);
  const showWorkingIndicator =
    busy &&
    !(
      lastEntry?.kind === 'message' &&
      lastEntry.message.role === 'assistant' &&
      lastEntry.streaming &&
      lastEntryHasText
    );

  const value: ChatSessionApi = { ...session, busy, showWorkingIndicator, onApprove, onRespond };

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession(): ChatSessionApi {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error('useChatSession must be used within a ChatSessionProvider');
  return ctx;
}
