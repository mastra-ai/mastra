import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';

import { useOverlays } from '../../../lib/overlays';
import { rememberGlobalSearchTrigger } from '../services/searchTriggerFocus';

export function useGlobalSearchControls() {
  const overlays = useOverlays();
  const { setOpenMobile } = useMainSidebar();

  const openSearch = (trigger?: HTMLElement) => {
    rememberGlobalSearchTrigger(trigger);
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
