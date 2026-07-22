import { useKeyDown } from '../../../lib/hooks';
import { useOverlays } from '../../../lib/overlays';
import { useParams } from 'react-router';
import { useChatTranscript } from '../context/useChatTranscript';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useAbortAgentControllerMutation } from '../../../../../shared/hooks/useAgentControllerRunMutations';

export function useGlobalShortcuts() {
  const overlays = useOverlays();
  const { factoryId } = useParams<{ factoryId: string }>();
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { busy } = useChatTranscript();
  const abortMutation = useAbortAgentControllerMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });

  useKeyDown({
    '?': e => {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      overlays.toggle('shortcuts');
    },
    escape: () => {
      if (!factoryId) return;
      if (overlays.isOpen('shortcuts')) {
        overlays.close('shortcuts');
        return;
      }
      if (overlays.isOpen('sidebar')) {
        overlays.close('sidebar');
        return;
      }
      if (busy) abortMutation.mutate();
    },
  });
}
