import { useLocation } from 'react-router';

/** Settings pages swap the sidebar's main nav for the Settings sections. */
export function isSettingsPath(pathname: string) {
  return /^\/factories\/[^/]+\/settings(?:\/|$)/.test(pathname);
}

export function useSettingsOpen() {
  return isSettingsPath(useLocation().pathname);
}
