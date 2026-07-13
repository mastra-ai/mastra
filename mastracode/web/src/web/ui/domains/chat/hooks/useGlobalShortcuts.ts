import { useKeyDown } from '../../../lib/hooks';
import { useOverlays } from '../../../lib/overlays';
import { useActiveProjectContext } from '../../workspaces';
import { useChatTranscript } from '../context/useChatTranscript';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useAbortAgentControllerMutation } from './useAgentControllerRunMutations';

export function useGlobalShortcuts() {
  const overlays = useOverlays();
  const { projects } = useActiveProjectContext();
  const { resourceId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { busy } = useChatTranscript();
  const abortMutation = useAbortAgentControllerMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
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
      const projectsForcedOpen = overlays.isOpen('projects') || projects.length === 0;
      if (projectsForcedOpen) return;
      if (overlays.isOpen('shortcuts')) {
        overlays.close('shortcuts');
        return;
      }
      if (overlays.isOpen('settings')) {
        overlays.close('settings');
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
