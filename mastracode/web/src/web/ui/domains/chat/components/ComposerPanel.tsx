import { useApiConfig } from '../../../../../shared/api/config';
import { useOverlays } from '../../../lib/overlays';
import { useActiveProjectContext } from '../../workspaces';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatSession } from '../context/ChatSessionProvider';
import { useSwitchAgentControllerModeMutation } from '../hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { Composer } from './Composer';
import { StatusLine } from './StatusLine';

const composerPanelClass = 'w-full shrink-0';

type ComposerPanelProps = {
  composerVariant?: 'inline' | 'textarea';
};

export function ComposerPanel({ composerVariant = 'inline' }: ComposerPanelProps) {
  const { baseUrl } = useApiConfig();
  const overlays = useOverlays();
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const { composerCommandName, clearComposerCommand } = useChatCommands();
  const { transcript, modes, syncState, error } = useChatSession();
  const switchModeMutation = useSwitchAgentControllerModeMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });

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
        activeModeId={transcript.modeId}
        onModeChange={modeId => {
          void switchModeMutation.mutateAsync(modeId).then(() => syncState({ modeId }));
        }}
        onModelSelect={() => overlays.open('model-settings')}
        modelError={error?.message}
      />
    </div>
  );
}
