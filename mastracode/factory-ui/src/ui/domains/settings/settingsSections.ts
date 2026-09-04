export type SettingsSection =
  | 'account'
  | 'preferences'
  | 'factory'
  | 'connections'
  | 'repositories'
  | 'intake'
  | 'models'
  | 'memory'
  | 'skills'
  | 'behavior';

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  account: 'My account',
  preferences: 'Preferences',
  factory: 'Manage Factory',
  connections: 'Connections',
  repositories: 'Repositories',
  intake: 'Work Intake',
  models: 'Models',
  memory: 'Memory',
  skills: 'Skills',
  behavior: 'Behavior',
};

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string' && value in SETTINGS_SECTION_LABELS;
}

export function settingsSectionPath(factoryId: string, section: SettingsSection): string {
  return `/factories/${factoryId}/settings/${section}`;
}
