import type { FactoryModelScope } from '../workspaces/services/github';
import { MODEL_ROUTES } from './components/models/routing/model-routes';
import type { ModelDefaults } from './components/models/routing/model-routes';

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

export const MODEL_DEFAULTS_ANCHORS = {
  personal: 'personal-defaults',
  factory: 'factory-defaults',
} as const satisfies Record<ModelDefaults, string>;

export type ModelDefaultsAnchor = (typeof MODEL_DEFAULTS_ANCHORS)[keyof typeof MODEL_DEFAULTS_ANCHORS];

export function sessionDefaultsAnchor(modelScope: FactoryModelScope | undefined): ModelDefaultsAnchor {
  if (!modelScope) return MODEL_DEFAULTS_ANCHORS.personal;
  return MODEL_DEFAULTS_ANCHORS[MODEL_ROUTES[modelScope].chats];
}

type SettingsTarget = { section: SettingsSection; anchor?: ModelDefaultsAnchor };

const RETIRED_SETTINGS_SECTIONS = new Map<string, SettingsTarget>([
  ['personal-models', { section: 'models', anchor: MODEL_DEFAULTS_ANCHORS.personal }],
  ['factory-memory', { section: 'memory' }],
  ['environment', { section: 'factory' }],
]);

export function retiredSettingsTarget(section: string | undefined, hash: string): SettingsTarget | undefined {
  if (section === 'models' && hash === '#model-packs')
    return { section: 'models', anchor: MODEL_DEFAULTS_ANCHORS.personal };
  if (!section) return undefined;
  return RETIRED_SETTINGS_SECTIONS.get(section);
}

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string' && value in SETTINGS_SECTION_LABELS;
}

export function settingsSectionPath(factoryId: string, section: SettingsSection, anchor?: ModelDefaultsAnchor): string {
  const path = `/factories/${factoryId}/settings/${section}`;
  return anchor ? `${path}#${anchor}` : path;
}
