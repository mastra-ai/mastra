import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { PULL_REQUEST_SOURCE_FILTER } from '../../factory/boardSourceFilters';
import { rememberedBoardPath } from '../../factory/services/boardViews';
import type { GlobalSearchSelectHandler } from '../services/searchNavigation';
import { SETTINGS_SECTION_LABELS, settingsSectionPath } from '../../settings/settingsSections';
import { IconBrain } from '@mastra/playground-ui/icons/central/IconBrain';
import { IconChecklist } from '@mastra/playground-ui/icons/central/IconChecklist';
import { IconKanbanView } from '@mastra/playground-ui/icons/central/IconKanbanView';
import { IconPullRequest } from '@mastra/playground-ui/icons/central/IconPullRequest';
import { IconSettingsGear1 } from '@mastra/playground-ui/icons/central/IconSettingsGear1';

export function GlobalSearchNavigationResults({
  factoryId,
  onSelect,
}: {
  factoryId: string;
  onSelect: GlobalSearchSelectHandler;
}) {
  return (
    <CommandGroup heading="Navigation">
      <CommandPaletteItem
        icon={<IconKanbanView />}
        title="Work"
        subtitle="Factory navigation"
        value={`Work Factory navigation /factories/${factoryId}/work`}
        onSelect={() => onSelect(rememberedBoardPath(factoryId, DEFAULT_BOARD_ID), false)}
      />
      <CommandPaletteItem
        icon={<IconPullRequest />}
        title="Pull requests"
        subtitle="Factory navigation"
        value={`Pull requests Review Factory navigation /factories/${factoryId}/work`}
        onSelect={() => onSelect(`/factories/${factoryId}/work?source=${PULL_REQUEST_SOURCE_FILTER}`, false)}
      />
      <CommandPaletteItem
        icon={<IconChecklist />}
        title="Rules"
        subtitle="Factory navigation"
        value={`Rules Factory navigation /factories/${factoryId}/rules`}
        onSelect={() => onSelect(`/factories/${factoryId}/rules`, false)}
      />
      <CommandPaletteItem
        icon={<IconBrain />}
        title="Knowledge"
        subtitle="Factory navigation"
        value={`Knowledge Factory navigation /factories/${factoryId}/knowledge`}
        onSelect={() => onSelect(`/factories/${factoryId}/knowledge`, false)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear1 />}
        title={SETTINGS_SECTION_LABELS.preferences}
        subtitle="Settings"
        value={`Preferences Settings preferences ${settingsSectionPath(factoryId, 'preferences')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'preferences'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear1 />}
        title={SETTINGS_SECTION_LABELS.factory}
        subtitle="Settings"
        value={`Factory Settings factory ${settingsSectionPath(factoryId, 'factory')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'factory'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear1 />}
        title={SETTINGS_SECTION_LABELS.connections}
        subtitle="Settings"
        value={`Connections Settings connections ${settingsSectionPath(factoryId, 'connections')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'connections'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear1 />}
        title={SETTINGS_SECTION_LABELS.repositories}
        subtitle="Settings"
        value={`Repositories Settings repositories ${settingsSectionPath(factoryId, 'repositories')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'repositories'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear1 />}
        title={SETTINGS_SECTION_LABELS.intake}
        subtitle="Settings"
        value={`Work Intake Settings intake ${settingsSectionPath(factoryId, 'intake')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'intake'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear1 />}
        title={SETTINGS_SECTION_LABELS.models}
        subtitle="Settings"
        value={`Models Settings models personal factory defaults providers ${settingsSectionPath(factoryId, 'models')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'models'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear1 />}
        title={SETTINGS_SECTION_LABELS.memory}
        subtitle="Settings"
        value={`Memory Settings memory personal factory shared observational ${settingsSectionPath(factoryId, 'memory')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'memory'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear1 />}
        title={SETTINGS_SECTION_LABELS.behavior}
        subtitle="Settings"
        value={`Behavior Settings behavior ${settingsSectionPath(factoryId, 'behavior')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'behavior'), true)}
      />
    </CommandGroup>
  );
}
