import { useLocation } from 'react-router';

/** Settings pages swap the sidebar's main nav for the Settings sections. */
export function isSettingsPath(pathname: string) {
  return /^\/factories\/[^/]+\/settings(?:\/|$)/.test(pathname);
}

export function useSettingsOpen() {
  return isSettingsPath(useLocation().pathname);
}

/**
 * The state a link into Settings carries: the page Settings was opened from, so Back to app returns there. A link
 * within Settings keeps the page it already holds.
 */
export function useSettingsLinkState(): unknown {
  const location = useLocation();
  return isSettingsPath(location.pathname) ? location.state : { from: location };
}
