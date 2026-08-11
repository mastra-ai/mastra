import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';

import { useOverlays } from '../../../lib/overlays';
import { rememberGlobalSearchTrigger } from '../services/searchTriggerFocus';

export function useGlobalSearchControls() {
  const overlays = useOverlays();
  const { setOpenMobile } = useMainSidebar();

  const openSearch = (trigger?: HTMLElement) => {
    // Falling back to activeElement inside an open overlay would remember a node that unmounts with it
    const focusIsInsideOverlay = overlays.isOpen('shortcuts') || overlays.isOpen('search');
    if (trigger || !focusIsInsideOverlay) rememberGlobalSearchTrigger(trigger);
    overlays.close('shortcuts');
    setOpenMobile(false);
    overlays.open('search');
  };

  const closeSearch = () => overlays.close('search');

  return {
    isSearchOpen: overlays.isOpen('search'),
    openSearch,
    closeSearch,
  };
}
