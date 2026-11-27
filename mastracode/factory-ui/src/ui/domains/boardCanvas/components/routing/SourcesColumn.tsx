import { SourcesColumn as SharedSourcesColumn } from '@mastra/playground-ui/domains/factory';

import { useIntakeBindingsQuery } from '../../../../../hooks/useIntakeConfig';
import { HrefLink } from '../../../../ui/HrefLink';
import { INTAKE_PROVIDERS, isIntakeProvider } from '../../../factory/boardSourceFilters';
import type { IntakeProvider } from '../../../factory/boardSourceFilters';
import { laneText } from '../../../boardRules/ruleLanes';
import type { RuleEvent } from '../../../boardRules/ruleLanes';
import { SettingsIntegrationIcon } from '../../../settings/components/brand-icons/SettingsIntegrationIcon';
import { settingsSectionPath } from '../../../settings/settingsSections';
import type { LinkedRepositoryPayload } from '../../../workspaces/services/github';
import { ARRIVAL_EVENTS, LaneIcon } from './laneIcon';

/** Code hosts send pull requests; every source sends issues. */
const CODE_HOSTS: readonly IntakeProvider[] = ['github', 'gitlab'];

/**
 * Where new issues and pull requests come from: the project's repositories and the issue trackers bound to it, with
 * what intake filed from each trigger in the last 30 days.
 */
export function SourcesColumn({
  factoryId,
  repositories,
  filed,
  routeList,
}: {
  factoryId: string;
  repositories: readonly LinkedRepositoryPayload[];
  /** Cards filed per trigger in the last 30 days; undefined while the counts load. */
  filed: ReadonlyMap<RuleEvent, number> | undefined;
  /** Intake still runs the old route list, so the order decides nothing yet. */
  routeList: boolean;
}) {
  const bindings = useIntakeBindingsQuery();
  const providers = new Set<IntakeProvider>(repositories.map(repository => repository.provider ?? 'github'));
  for (const binding of bindings.data ?? []) {
    if (binding.factoryProjectId === factoryId && isIntakeProvider(binding.integrationId)) {
      providers.add(binding.integrationId);
    }
  }

  const lanes = ARRIVAL_EVENTS.map(event => ({
    event,
    label: laneText(event).label,
    icon: <LaneIcon event={event} className="text-foreground size-icon-sm" />,
    filed: filed && (filed.get(event) ?? 0),
    sources: [...providers]
      .filter(provider => event !== 'pull_request.opened' || CODE_HOSTS.includes(provider))
      .map(provider => ({
        key: provider,
        name: INTAKE_PROVIDERS[provider],
        icon: <SettingsIntegrationIcon provider={provider} className="size-icon-xs" />,
      })),
  }));

  return (
    <SharedSourcesColumn
      lanes={lanes}
      routeList={routeList}
      intakeHref={settingsSectionPath(factoryId, 'intake')}
      LinkComponent={HrefLink}
    />
  );
}
