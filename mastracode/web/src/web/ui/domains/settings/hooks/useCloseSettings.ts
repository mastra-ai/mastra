import { useMaybeSidebar } from '@mastra/playground-ui/components/MainSidebar';

import { useOverlays } from '../../../lib/overlays';
import { useSetSettingsSection } from '../context/SettingsNavigationProvider';

export function useCloseSettings() {
  const overlays = useOverlays();
  const setSection = useSetSettingsSection();
  const sidebar = useMaybeSidebar();
  const mobileDrawerOpen = sidebar?.openMobile ?? false;
  const setOpenMobile = sidebar?.setOpenMobile;

  return () => {
    setSection('general');
    overlays.close('settings');
    if (mobileDrawerOpen) setOpenMobile?.(false);
    requestAnimationFrame(() => {
      const focusTarget = mobileDrawerOpen
        ? document.querySelector<HTMLButtonElement>('[aria-label="Open navigation menu"]')
        : document.getElementById('settings-trigger');
      focusTarget?.focus();
    });
  };
}
