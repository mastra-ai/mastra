import { DEFAULT_BOARD_ID, PULL_REQUEST_SOURCE_FILTER } from '@internal/factory-contract';
import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { IconBrain } from '@mastra/playground-ui/icons/central/IconBrain';
import { IconChecklist } from '@mastra/playground-ui/icons/central/IconChecklist';
import { IconKanbanView } from '@mastra/playground-ui/icons/central/IconKanbanView';
import { IconPullRequest } from '@mastra/playground-ui/icons/central/IconPullRequest';

import { rememberedBoardPath } from '../../factory/services/boardViews';
import type { GlobalSearchSelectHandler } from '../services/searchNavigation';
import { useSessionHost } from '../../chat/context/SessionHostContext';
import { SETTINGS_SECTION_LABELS } from '../../chat/services/sessionSettings';
import { IconSettingsGear5 } from '@mastra/playground-ui/icons/central/IconSettingsGear5';

export function GlobalSearchNavigationResults({
  factoryId,
  onSelect,
}: {
  factoryId: string;
  onSelect: GlobalSearchSelectHandler;
}) {
  const { links } = useSessionHost();
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
        icon={<IconSettingsGear5 />}
        title={SETTINGS_SECTION_LABELS.account}
        subtitle="Settings"
        value={`My account Settings account profile preferences theme ${links.settings('account')}`}
        onSelect={() => onSelect(links.settings('account'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear5 />}
        title={SETTINGS_SECTION_LABELS.factory}
        subtitle="Settings"
        value={`Factory Settings factory ${links.settings('factory')}`}
        onSelect={() => onSelect(links.settings('factory'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear5 />}
        title={SETTINGS_SECTION_LABELS.connections}
        subtitle="Settings"
        value={`Connections Settings connections ${links.settings('connections')}`}
        onSelect={() => onSelect(links.settings('connections'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear5 />}
        title={SETTINGS_SECTION_LABELS.repositories}
        subtitle="Settings"
        value={`Repositories Settings repositories ${links.settings('repositories')}`}
        onSelect={() => onSelect(links.settings('repositories'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear5 />}
        title={SETTINGS_SECTION_LABELS.intake}
        subtitle="Settings"
        value={`Work Intake Settings intake order not routed new cards ${links.settings('intake')}`}
        onSelect={() => onSelect(links.settings('intake'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear5 />}
        title={SETTINGS_SECTION_LABELS.models}
        subtitle="Settings"
        value={`Models Settings models personal factory defaults providers ${links.settings('models')}`}
        onSelect={() => onSelect(links.settings('models'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear5 />}
        title={SETTINGS_SECTION_LABELS.memory}
        subtitle="Settings"
        value={`Memory Settings memory personal factory shared observational ${links.settings('memory')}`}
        onSelect={() => onSelect(links.settings('memory'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear5 />}
        title={SETTINGS_SECTION_LABELS.skills}
        subtitle="Settings"
        value={`Skills Settings skills instructions phases new skill ${links.settings('skills')}`}
        onSelect={() => onSelect(links.settings('skills'), true)}
      />
      <CommandPaletteItem
        icon={<IconSettingsGear5 />}
        title={SETTINGS_SECTION_LABELS.behavior}
        subtitle="Settings"
        value={`Behavior Settings behavior ${links.settings('behavior')}`}
        onSelect={() => onSelect(links.settings('behavior'), true)}
      />
    </CommandGroup>
  );
}
