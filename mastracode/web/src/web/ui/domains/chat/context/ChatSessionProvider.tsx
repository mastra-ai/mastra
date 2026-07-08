import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// Deep imports (not the workspaces barrel): the barrel re-exports components
// that consume this chat context, so importing it here would create a cycle.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath } from '../../workspaces/hooks/useWorkspaces';
import { useAgentControllerConnection } from '../hooks/useAgentControllerConnection';
import type { ConnectionStatus } from '../hooks/useAgentControllerConnection';
import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import type { TranscriptState } from '../services/transcript';
import { ChatConnectionGate } from './ChatConnectionGate';

export interface ChatSessionApi {
  transcript: TranscriptState;
  status: ConnectionStatus;
  modes: ReturnType<typeof useAgentControllerConnection>['modes'];
  busy: boolean;
  showWorkingIndicator: boolean;
  localUser: (text: string, steer?: boolean) => void;
  resetHydration: () => void;
  resetCurrentThread: (threadId?: string) => void;
  syncState: (state: {
    modeId?: string;
    modelId?: string;
    omProgress?: TranscriptState['omProgress'];
    tokenUsage?: TranscriptState['usage'];
  }) => void;
  reset: (state?: Parameters<ReturnType<typeof useAgentControllerTranscript>['reset']>[0], threadId?: string) => void;
  resolvePrompt: (id: string) => void;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
}

export const ChatSessionContext = createContext<ChatSessionApi | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const projectPath = deriveProjectPath(activeProject);

  return (
    <ChatConnectionGate
      key={`${resourceId}:${projectPath ?? ''}`}
      resourceId={resourceId}
      projectPath={projectPath}
      sessionEnabled={sessionEnabled}
    >
      {children}
    </ChatConnectionGate>
  );
}

export function useChatSession(): ChatSessionApi {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error('useChatSession must be used within a ChatSessionProvider');
  return ctx;
}
