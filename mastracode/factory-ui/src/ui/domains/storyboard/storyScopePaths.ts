import type { SettingsSection } from '../settings/settingsSections';
import { settingsSectionPath } from '../settings/settingsSections';

export type StoryScope = 'personal' | 'factory';

export const STORY_SCOPES: readonly StoryScope[] = ['personal', 'factory'];

const SECTION_SCOPES: Record<SettingsSection, readonly StoryScope[]> = {
  account: ['personal'],
  preferences: ['personal'],
  models: ['personal', 'factory'],
  connections: ['personal', 'factory'],
  factory: ['factory'],
  repositories: ['factory'],
  intake: ['factory'],
  memory: ['factory'],
  skills: ['factory'],
  behavior: ['factory'],
};

const SCOPE_HOME: Record<StoryScope, SettingsSection> = { personal: 'account', factory: 'models' };

export function asStoryScope(value: string | null): StoryScope | undefined {
  return STORY_SCOPES.find(scope => scope === value);
}

export function sectionInScope(section: SettingsSection, scope: StoryScope): boolean {
  return SECTION_SCOPES[section].includes(scope);
}

export function scopeOf(section: SettingsSection, param: string | null): StoryScope {
  const asked = asStoryScope(param);
  if (asked && sectionInScope(section, asked)) return asked;
  return SECTION_SCOPES[section][0] ?? 'personal';
}

export function scopedSectionPath(factoryId: string, section: SettingsSection, scope: StoryScope): string {
  return `${settingsSectionPath(factoryId, section)}?scope=${scope}`;
}

export function switchScopePath(factoryId: string, section: SettingsSection, scope: StoryScope): string {
  return scopedSectionPath(factoryId, sectionInScope(section, scope) ? section : SCOPE_HOME[scope], scope);
}
