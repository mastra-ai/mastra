export type SettingsSection = 'general' | 'source-control' | 'model' | 'behavior' | 'custom-providers';

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  general: 'General',
  'source-control': 'Source Control',
  model: 'Model',
  behavior: 'Behavior',
  'custom-providers': 'Custom',
};

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string' && value in SETTINGS_SECTION_LABELS;
}

export function settingsSectionPath(factoryId: string, section: SettingsSection): string {
  return `/factories/${factoryId}/settings/${section}`;
}
