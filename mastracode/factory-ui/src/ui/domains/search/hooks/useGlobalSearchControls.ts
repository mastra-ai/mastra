import { useSidebar } from '@mastra/playground-ui/components/Sidebar';

import { useOverlays } from '../../../lib/overlays';
import { rememberGlobalSearchTrigger } from '../services/searchTriggerFocus';

export function useGlobalSearchControls() {
  const overlays = useOverlays();
  const { isMobile, openMobile, setOpenMobile, mobileTriggerRef } = useSidebar();

  const openSearch = (trigger?: HTMLElement) => {
    // Falling back to activeElement inside an open overlay would remember a node that unmounts with it
    const focusIsInsideOverlay = overlays.isOpen('shortcuts') || overlays.isOpen('search');
    // The phone sidebar hides as search opens, so focus returns to the button that reopens it.
    const returnTo = isMobile && openMobile ? (mobileTriggerRef.current ?? trigger) : trigger;
    if (returnTo || !focusIsInsideOverlay) rememberGlobalSearchTrigger(returnTo);
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
