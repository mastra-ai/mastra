import type { FactoryModelScope } from '@internal/factory-contract';
import { MODEL_DEFAULTS_ANCHORS, MODEL_ROUTES } from '@mastra/playground-ui/domains/factory';

export type SettingsSection =
  | 'account'
  | 'factory'
  | 'connections'
  | 'repositories'
  | 'intake'
  | 'models'
  | 'memory'
  | 'tools'
  | 'skills'
  | 'behavior'
  | 'debug';

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  account: 'My account',
  factory: 'Manage Factory',
  connections: 'Connections',
  repositories: 'Repositories',
  intake: 'Work Intake',
  models: 'Models',
  memory: 'Memory',
  tools: 'Tools',
  skills: 'Skills',
  behavior: 'Behavior',
  debug: 'Debug',
};

export { MODEL_DEFAULTS_ANCHORS };

export type ModelDefaultsAnchor = (typeof MODEL_DEFAULTS_ANCHORS)[keyof typeof MODEL_DEFAULTS_ANCHORS];

export const VOICE_INPUT_ANCHOR = 'voice-input';

export function sessionDefaultsAnchor(modelScope: FactoryModelScope | undefined): ModelDefaultsAnchor {
  if (!modelScope) return MODEL_DEFAULTS_ANCHORS.personal;
  return MODEL_DEFAULTS_ANCHORS[MODEL_ROUTES[modelScope].chats];
}
