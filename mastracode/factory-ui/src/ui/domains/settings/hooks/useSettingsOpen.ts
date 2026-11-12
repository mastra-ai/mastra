import { useLocation } from 'react-router';
import { appPathname } from '../../../lib/app-root';

export function useSettingsOpen() {
  const { pathname } = useLocation();
  return /^\/factories\/[^/]+\/settings(?:\/|$)/.test(appPathname(pathname));
}
