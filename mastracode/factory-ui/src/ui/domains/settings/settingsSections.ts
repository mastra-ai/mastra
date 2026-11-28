export {
  MODEL_DEFAULTS_ANCHORS,
  SETTINGS_SECTION_LABELS,
  VOICE_INPUT_ANCHOR,
  sessionDefaultsAnchor,
} from '../chat/services/sessionSettings';
export type { ModelDefaultsAnchor, SettingsSection } from '../chat/services/sessionSettings';
import { MODEL_DEFAULTS_ANCHORS, SETTINGS_SECTION_LABELS } from '../chat/services/sessionSettings';
import type { ModelDefaultsAnchor, SettingsSection, VOICE_INPUT_ANCHOR } from '../chat/services/sessionSettings';

type SettingsAnchor = ModelDefaultsAnchor | typeof VOICE_INPUT_ANCHOR;

type SettingsTarget = { section: SettingsSection; anchor?: ModelDefaultsAnchor };

const RETIRED_SETTINGS_SECTIONS = new Map<string, SettingsTarget>([
  ['preferences', { section: 'account' }],
  ['personal-models', { section: 'models', anchor: MODEL_DEFAULTS_ANCHORS.personal }],
  ['factory-memory', { section: 'memory' }],
  ['environment', { section: 'repositories' }],
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

export function settingsSectionPath(factoryId: string, section: SettingsSection, anchor?: SettingsAnchor): string {
  const path = `/factories/${factoryId}/settings/${section}`;
  return anchor ? `${path}#${anchor}` : path;
}

/** A skill's page, under Settings › Skills. */
export function skillPath(factoryId: string, skillName: string): string {
  return `${settingsSectionPath(factoryId, 'skills')}/${encodeURIComponent(skillName)}`;
}

/** The settings page that creates a skill. Not under `skills/`, where `new` could be a skill's name. */
export const NEW_SKILL_PAGE = 'new-skill';

export function newSkillPath(factoryId: string): string {
  return `/factories/${factoryId}/settings/${NEW_SKILL_PAGE}`;
}
