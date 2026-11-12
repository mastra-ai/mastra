import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useOverlays } from '../../../lib/overlays';
import { useParams } from 'react-router';
import { useChatTranscript } from '../context/useChatTranscript';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useGlobalSearchControls } from '../../search/hooks/useGlobalSearchControls';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useAbortAgentControllerMutation } from '../../../../hooks/useAgentControllerRunMutations';

export function useGlobalShortcuts() {
  const overlays = useOverlays();
  const { factoryId } = useParams<{ factoryId: string }>();
  const { sessionId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { busy } = useChatTranscript();
  const { closeSearch } = useGlobalSearchControls();
  const abortMutation = useAbortAgentControllerMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  });

  function escapeAction() {
    if (!factoryId) return undefined;
    if (overlays.isOpen('search')) return closeSearch;
    if (overlays.isOpen('shortcuts')) return () => overlays.close('shortcuts');
    if (overlays.isOpen('sidebar')) return () => overlays.close('sidebar');
    if (busy) return () => abortMutation.mutate();
    return undefined;
  }
  const onEscape = escapeAction();

  useKeydown({ '?': () => overlays.toggle('shortcuts') }, { shouldHandle: () => !overlays.isOpen('search') });
  useKeydown({ Escape: () => onEscape?.() }, { enabled: onEscape !== undefined, insideFields: true });
}
