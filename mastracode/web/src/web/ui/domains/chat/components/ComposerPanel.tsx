import { useActiveProjectContext } from '../../workspaces';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatTranscript } from '../context/ChatSessionProvider';
import { useChatModes } from '../context/useChatModes';
import { Composer } from './Composer';
import { StatusLine } from './StatusLine';

const composerPanelClass = 'w-full shrink-0';

type ComposerPanelProps = {
  composerVariant?: 'inline' | 'textarea';
};

export function ComposerPanel({ composerVariant = 'inline' }: ComposerPanelProps) {
  const { activeProject } = useActiveProjectContext();
  const { composerCommandName, clearComposerCommand } = useChatCommands();
  const { transcript } = useChatTranscript();
  const { modes, activeModeId, setMode } = useChatModes();

  if (!activeProject) return null;

  return (
    <div className={composerPanelClass}>
      <Composer
        variant={composerVariant}
        commandNameToApply={composerCommandName}
        onCommandApplied={clearComposerCommand}
      />

      <StatusLine
        modelId={transcript.modelId}
        followUpCount={transcript.followUpCount}
        omPhase={transcript.omPhase}
        omProgress={transcript.omProgress}
        goal={transcript.goal}
        tokensPerSec={transcript.tokensPerSec}
        modes={modes}
        activeModeId={activeModeId ?? modes[0]?.id}
        onModeChange={modeId => {
          void setMode(modeId);
        }}
      />
    </div>
  );
}
