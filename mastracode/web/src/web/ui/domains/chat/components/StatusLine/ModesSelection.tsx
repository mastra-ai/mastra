import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';

import { useApiConfig } from '../../../../../../shared/api/config';
import { useActiveProjectContext } from '../../../workspaces';
import { useChatSession } from '../../context/ChatSessionProvider';
import { useSwitchAgentControllerModeMutation } from '../../hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../../services/constants';

/** Session mode buttons; switches modes through the agent controller. */
export function ModesSelection() {
  const { baseUrl } = useApiConfig();
  const { resourceId, sessionEnabled } = useActiveProjectContext();
  const { transcript, modes, syncState } = useChatSession();
  const switchModeMutation = useSwitchAgentControllerModeMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const activeModeId = transcript.modeId;

  if (!modes || modes.length === 0) return null;

  return (
    <div role="group" aria-label="Session mode" className="shrink-0">
      <ButtonsGroup spacing="close">
        {modes.map(m => (
          <Button
            key={m.id}
            variant={activeModeId === m.id ? 'primary' : 'ghost'}
            size="sm"
            aria-pressed={activeModeId === m.id}
            onClick={() => {
              void switchModeMutation.mutateAsync(m.id).then(() => syncState({ modeId: m.id }));
            }}
          >
            {m.name ?? m.id}
          </Button>
        ))}
      </ButtonsGroup>
    </div>
  );
}
