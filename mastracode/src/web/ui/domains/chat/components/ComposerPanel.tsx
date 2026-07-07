import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useActiveProjectContext } from '../../workspaces';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatSession } from '../context/ChatSessionProvider';
import { Composer } from './Composer';
import { StatusLine } from './StatusLine';

const composerPanelClass = 'w-full shrink-0';

type ComposerPanelProps = {
  composerVariant?: 'inline' | 'textarea';
};

/**
 * The composer region: input + status line, wired to the chat session and
 * palette/composer command hand-off. Must render inside `ChatSessionProvider`
 * with an active project.
 */
export function ComposerPanel({ composerVariant = 'inline' }: ComposerPanelProps) {
  const { activeProject } = useActiveProjectContext();
  const session = useChatSession();
  const { composerCommandName, clearComposerCommand } = useChatCommands();
  const location = useLocation();
  const navigate = useNavigate();
  const { transcript, status, busy, modes } = session;

  const { createThread, send: sessionSend } = session;
  const send = useCallback(
    async (text: string) => {
      if (location.pathname === '/new') {
        const threadId = await createThread();
        await sessionSend(text);
        void navigate(`/threads/${threadId}`, { replace: true });
        return;
      }
      await sessionSend(text);
    },
    [location.pathname, createThread, navigate, sessionSend],
  );

  // Parent only renders this component with an active project; TS narrowing.
  if (!activeProject) return null;

  return (
    <div className={composerPanelClass}>
      <Composer
        variant={composerVariant}
        activeProject={activeProject}
        transcript={transcript}
        status={status}
        busy={busy}
        send={send}
        steer={session.steer}
        abort={session.abort}
        commandNameToApply={composerCommandName}
        onCommandApplied={clearComposerCommand}
        session={session}
      />

      <StatusLine
        modelId={transcript.modelId}
        followUpCount={transcript.followUpCount}
        omPhase={transcript.omPhase}
        omProgress={transcript.omProgress}
        goal={transcript.goal}
        tokensPerSec={transcript.tokensPerSec}
        modes={modes}
        activeModeId={transcript.modeId}
        onModeChange={modeId => void session.switchMode(modeId)}
      />
    </div>
  );
}
