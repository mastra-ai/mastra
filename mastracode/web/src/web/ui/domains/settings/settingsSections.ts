import type { SettingsSection } from './context/SettingsNavigationProvider';

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  general: 'General',
  'source-control': 'Source Control',
  model: 'Model',
  memory: 'Memory',
  behavior: 'Behavior',
  providers: 'API Keys',
  'custom-providers': 'Custom',
};
