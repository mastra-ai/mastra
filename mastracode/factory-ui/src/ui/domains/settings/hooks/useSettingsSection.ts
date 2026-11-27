import { matchPath, useLocation } from 'react-router';

import { NEW_SKILL_PAGE, isSettingsSection } from '../settingsSections';
import type { SettingsSection } from '../settingsSections';

/**
 * The active settings section is the `:section` URL segment of
 * `/settings/:section`, derived from the location so it works anywhere the
 * settings UI renders (page content or sidebar navigation). `SettingsPage`
 * redirects unknown segments to the default section, so consumers below it
 * always see a valid value; the fallback only covers the frame between
 * navigation and that redirect. The new skill page sits beside `skills/`, and
 * belongs to Skills.
 */
export function useSettingsSection(): SettingsSection {
  const { pathname } = useLocation();
  const section =
    matchPath('/factories/:factoryId/settings/:section/*', pathname)?.params.section ??
    matchPath('/factories/:factoryId/settings/:section', pathname)?.params.section ??
    matchPath('/settings/:section', pathname)?.params.section;
  if (section === NEW_SKILL_PAGE) return 'skills';
  return isSettingsSection(section) ? section : 'account';
}
