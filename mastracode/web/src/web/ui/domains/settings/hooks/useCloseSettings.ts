import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { useLocation, useNavigate } from 'react-router';
import type { Location } from 'react-router';

import { useActiveFactoryContext } from '../../workspaces/context/ActiveFactoryProvider';
import { factoryHomePath } from '../../workspaces/services/factoryPaths';

/**
 * Leaving settings is navigation: return to the page settings was opened from
 * (carried in `location.state.from`), falling back to the draft composer for
 * deep links. Focus returns to the trigger that opened settings.
 */
export function useCloseSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeFactory } = useActiveFactoryContext();
  const { openMobile: mobileDrawerOpen, setOpenMobile } = useMainSidebar();

  return function closeSettings() {
    const from = (location.state as { from?: Location } | null)?.from;
    void navigate(from ?? (activeFactory ? factoryHomePath(activeFactory) : '/'));
    setOpenMobile(false);

    const focusTargetId = mobileDrawerOpen ? 'mobile-navigation-trigger' : 'settings-trigger';
    requestAnimationFrame(() => document.getElementById(focusTargetId)?.focus());
  };
}
