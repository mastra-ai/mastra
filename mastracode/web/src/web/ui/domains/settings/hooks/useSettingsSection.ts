import { matchPath, useLocation } from 'react-router';

import { isSettingsSection, type SettingsSection } from '../settingsSections';

/**
 * The active settings section is the `:section` URL segment of
 * `/settings/:section`, derived from the location so it works anywhere the
 * settings UI renders (page content or sidebar navigation). `SettingsPage`
 * redirects unknown segments to the default section, so consumers below it
 * always see a valid value; the fallback only covers the frame between
 * navigation and that redirect.
 */
export function useSettingsSection(): SettingsSection {
  const { pathname } = useLocation();
  const section = matchPath('/settings/:section', pathname)?.params.section;
  return isSettingsSection(section) ? section : 'general';
}
