import { useKeyDown } from '../../../lib/hooks/useKeyDown';
import { useOverlays } from '../../../lib/overlays';
import { useParams } from 'react-router';
import { useChatTranscript } from '../context/useChatTranscript';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useGlobalSearchControls } from '../../search/hooks/useGlobalSearchControls';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useAbortAgentControllerMutation } from '../../../../hooks/useAgentControllerRunMutations';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export function useGlobalShortcuts() {
  const overlays = useOverlays();
  const { factoryId } = useParams<{ factoryId: string }>();
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { busy } = useChatTranscript();
  const { closeSearch } = useGlobalSearchControls();
  const abortMutation = useAbortAgentControllerMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });

  useKeyDown({
    '?': e => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || overlays.isOpen('search')) return;
      e.preventDefault();
      overlays.toggle('shortcuts');
    },
    escape: () => {
      if (!factoryId) return;
      if (overlays.isOpen('search')) {
        closeSearch();
        return;
      }
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
