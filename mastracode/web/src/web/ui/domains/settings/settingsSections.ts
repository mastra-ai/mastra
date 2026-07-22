export type SettingsSection =
  | 'general'
  | 'source-control'
  | 'model'
  | 'memory'
  | 'behavior'
  | 'providers'
  | 'custom-providers';

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  general: 'General',
  'source-control': 'Source Control',
  model: 'Model',
  memory: 'Memory',
  behavior: 'Behavior',
  providers: 'API Keys',
  'custom-providers': 'Custom',
};

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string' && value in SETTINGS_SECTION_LABELS;
}

export function settingsSectionPath(section: SettingsSection): string {
  return `/settings/${section}`;
}

export const DEFAULT_SETTINGS_PATH = settingsSectionPath('general');
