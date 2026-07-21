import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';

import { useOverlays } from '../../../lib/overlays';

export function useCloseSettings() {
  const overlays = useOverlays();
  const { openMobile: mobileDrawerOpen, setOpenMobile } = useMainSidebar();

  return function closeSettings() {
    overlays.close('settings');
    setOpenMobile(false);

    const focusTargetId = mobileDrawerOpen ? 'mobile-navigation-trigger' : 'settings-trigger';
    requestAnimationFrame(() => document.getElementById(focusTargetId)?.focus());
  };
}
