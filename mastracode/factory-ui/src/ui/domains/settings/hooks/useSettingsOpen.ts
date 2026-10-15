import { useLocation } from 'react-router';

export function useSettingsOpen() {
  const { pathname } = useLocation();
  return /^\/factories\/[^/]+\/settings(?:\/|$)/.test(pathname);
}
