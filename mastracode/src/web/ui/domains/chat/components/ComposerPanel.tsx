import { useActiveProjectContext } from '../../workspaces';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatSession } from '../context/ChatSessionProvider';
import { Composer } from './Composer';
import { StatusLine } from './StatusLine';

const composerPanelClass = 'mx-auto w-full max-w-[80ch] shrink-0';

/**
 * The pinned composer region: input + status line, wired to the chat session
 * and palette/composer command hand-off. Propless — must render inside
 * `ChatSessionProvider` with an active project.
 */
export function ComposerPanel() {
  const { activeProject } = useActiveProjectContext();
  const session = useChatSession();
  const { composerCommandName, clearComposerCommand } = useChatCommands();
  const { transcript, status, busy, modes } = session;

  // Parent only renders this component with an active project; TS narrowing.
  if (!activeProject) return null;

  return (
    <div className={composerPanelClass}>
      <Composer
        activeProject={activeProject}
        transcript={transcript}
        status={status}
        busy={busy}
        send={session.send}
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
