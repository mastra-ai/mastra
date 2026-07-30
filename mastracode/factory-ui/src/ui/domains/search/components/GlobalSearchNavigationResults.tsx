import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { ChartLine, GitPullRequest, ListChecks, ScrollText, Settings, SquareKanban } from 'lucide-react';

import { SETTINGS_SECTION_LABELS, settingsSectionPath } from '../../settings/settingsSections';
import { GlobalSearchCommandItem } from './GlobalSearchCommandItem';
import type { GlobalSearchSelectHandler } from './GlobalSearchCommandItem';

export function GlobalSearchNavigationResults({
  factoryId,
  onSelect,
}: {
  factoryId: string;
  onSelect: GlobalSearchSelectHandler;
}) {
  return (
    <CommandGroup heading="Navigation">
      <GlobalSearchCommandItem
        icon={<SquareKanban />}
        title="Work"
        context="Factory navigation"
        value={`Work Factory navigation /factories/${factoryId}/work`}
        onSelect={() => onSelect(`/factories/${factoryId}/work`, false)}
      />
      <GlobalSearchCommandItem
        icon={<GitPullRequest />}
        title="Review"
        context="Factory navigation"
        value={`Review Factory navigation /factories/${factoryId}/review`}
        onSelect={() => onSelect(`/factories/${factoryId}/review`, false)}
      />
      <GlobalSearchCommandItem
        icon={<ChartLine />}
        title="Metrics"
        context="Factory navigation"
        value={`Metrics Factory navigation /factories/${factoryId}/metrics`}
        onSelect={() => onSelect(`/factories/${factoryId}/metrics`, false)}
      />
      <GlobalSearchCommandItem
        icon={<ListChecks />}
        title="Rules"
        context="Factory navigation"
        value={`Rules Factory navigation /factories/${factoryId}/rules`}
        onSelect={() => onSelect(`/factories/${factoryId}/rules`, false)}
      />
      <GlobalSearchCommandItem
        icon={<ScrollText />}
        title="Audit log"
        context="Factory navigation"
        value={`Audit log Factory navigation /factories/${factoryId}/audit`}
        onSelect={() => onSelect(`/factories/${factoryId}/audit`, false)}
      />
      <GlobalSearchCommandItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.preferences}
        context="Settings"
        value={`Preferences Settings preferences ${settingsSectionPath(factoryId, 'preferences')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'preferences'), true)}
      />
      <GlobalSearchCommandItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.factory}
        context="Settings"
        value={`Factory Settings factory ${settingsSectionPath(factoryId, 'factory')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'factory'), true)}
      />
      <GlobalSearchCommandItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.connections}
        context="Settings"
        value={`Connections Settings connections ${settingsSectionPath(factoryId, 'connections')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'connections'), true)}
      />
      <GlobalSearchCommandItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.repositories}
        context="Settings"
        value={`Repositories Settings repositories ${settingsSectionPath(factoryId, 'repositories')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'repositories'), true)}
      />
      <GlobalSearchCommandItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.intake}
        context="Settings"
        value={`Work Intake Settings intake ${settingsSectionPath(factoryId, 'intake')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'intake'), true)}
      />
      <GlobalSearchCommandItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.models}
        context="Settings"
        value={`Models Settings models ${settingsSectionPath(factoryId, 'models')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'models'), true)}
      />
      <GlobalSearchCommandItem
        icon={<Settings />}
        title={SETTINGS_SECTION_LABELS.behavior}
        context="Settings"
        value={`Behavior Settings behavior ${settingsSectionPath(factoryId, 'behavior')}`}
        onSelect={() => onSelect(settingsSectionPath(factoryId, 'behavior'), true)}
      />
    </CommandGroup>
  );
}
