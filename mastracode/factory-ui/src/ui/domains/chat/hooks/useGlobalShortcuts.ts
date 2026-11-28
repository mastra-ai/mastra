import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useOverlays } from '../overlays';
import { useSessionHost } from '../context/SessionHostContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { useGlobalSearchControls } from '../../search/hooks/useGlobalSearchControls';
import { useChatSessionActions } from '../context/useChatSessionActions';

export function useGlobalShortcuts() {
  const overlays = useOverlays();
  const { factoryProjectId: factoryId } = useSessionHost();
  const { busy } = useChatTranscript();
  const { closeSearch } = useGlobalSearchControls();
  const { abort } = useChatSessionActions();

  function escapeAction() {
    if (!factoryId) return undefined;
    if (overlays.isOpen('search')) return closeSearch;
    if (overlays.isOpen('shortcuts')) return () => overlays.close('shortcuts');
    if (overlays.isOpen('sidebar')) return () => overlays.close('sidebar');
    if (busy) return () => void abort();
    return undefined;
  }
  const onEscape = escapeAction();

  useKeydown({ '?': () => overlays.toggle('shortcuts') }, { shouldHandle: () => !overlays.isOpen('search') });
  useKeydown({ Escape: () => onEscape?.() }, { enabled: onEscape !== undefined, insideFields: true });
}
