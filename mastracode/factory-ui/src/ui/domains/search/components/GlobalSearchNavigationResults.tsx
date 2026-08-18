import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { Brain, Gauge, GitPullRequest, ListChecks, ScrollText, Settings, SquareKanban } from 'lucide-react';

import type { GlobalSearchSelectHandler } from '../services/searchNavigation';
import { SETTINGS_SECTION_LABELS, settingsSectionPath } from '../../settings/settingsSections';

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
        icon={<Gauge />}
        title="Overview"
        subtitle="Factory navigation"
        value={`Overview Factory navigation /factories/${factoryId}/overview`}
        onSelect={() => onSelect(`/factories/${factoryId}/overview`, false)}
      />
      <CommandPaletteItem
        icon={<SquareKanban />}
        title="Work"
        subtitle="Factory navigation"
        value={`Work Factory navigation /factories/${factoryId}/work`}
        onSelect={() => onSelect(`/factories/${factoryId}/work`, false)}
      />
      <CommandPaletteItem
        icon={<GitPullRequest />}
        title="Review"
        subtitle="Factory navigation"
        value={`Review Factory navigation /factories/${factoryId}/review`}
        onSelect={() => onSelect(`/factories/${factoryId}/review`, false)}
      />
      <CommandPaletteItem
        icon={<ListChecks />}
        title="Rules"
        subtitle="Factory navigation"
        value={`Rules Factory navigation /factories/${factoryId}/rules`}
        onSelect={() => onSelect(`/factories/${factoryId}/rules`, false)}
      />
      <CommandPaletteItem
        icon={<ScrollText />}
        title="Audit log"
        subtitle="Factory navigation"
        value={`Audit log Factory navigation /factories/${factoryId}/audit`}
        onSelect={() => onSelect(`/factories/${factoryId}/audit`, false)}
      />
      <CommandPaletteItem
        icon={<Brain />}
        title="Knowledge"
        subtitle="Factory navigation"
        value={`Knowledge Factory navigation /factories/${factoryId}/knowledge`}
        onSelect={() => onSelect(`/factories/${factoryId}/knowledge`, false)}
      />
      <CommandPaletteItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.preferences}
        subtitle="Settings"
        value={`Preferences Settings preferences ${settingsSectionPath(factoryId, 'preferences')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'preferences'), true)}
      />
      <CommandPaletteItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.factory}
        subtitle="Settings"
        value={`Factory Settings factory ${settingsSectionPath(factoryId, 'factory')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'factory'), true)}
      />
      <CommandPaletteItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.connections}
        subtitle="Settings"
        value={`Connections Settings connections ${settingsSectionPath(factoryId, 'connections')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'connections'), true)}
      />
      <CommandPaletteItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.repositories}
        subtitle="Settings"
        value={`Repositories Settings repositories ${settingsSectionPath(factoryId, 'repositories')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'repositories'), true)}
      />
      <CommandPaletteItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.intake}
        subtitle="Settings"
        value={`Work Intake Settings intake ${settingsSectionPath(factoryId, 'intake')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'intake'), true)}
      />
      <CommandPaletteItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.models}
        subtitle="Settings"
        value={`Models Settings models ${settingsSectionPath(factoryId, 'models')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'models'), true)}
      />
      <CommandPaletteItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.behavior}
        subtitle="Settings"
        value={`Behavior Settings behavior ${settingsSectionPath(factoryId, 'behavior')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'behavior'), true)}
      />
    </CommandGroup>
  );
}
