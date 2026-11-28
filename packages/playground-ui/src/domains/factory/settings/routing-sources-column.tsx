import {
  INTAKE_PROVIDERS,
  SettingsIntegrationIcon,
  SourcesColumn as SharedSourcesColumn,
  laneText,
  useBoardSettingsHost,
} from '..';
import type { IntakeProvider, RuleEvent } from '..';

import { ARRIVAL_EVENTS } from './arrival-events';
import { LaneIcon } from './lane-icon';

/** Code hosts send pull requests; every source sends issues. */
const CODE_HOSTS: readonly IntakeProvider[] = ['github', 'gitlab'];

/**
 * Where new issues and pull requests come from: the project's repositories and the issue trackers bound to it, with
 * what intake filed from each trigger in the last 30 days.
 */
export function RoutingSourcesColumn({
  filed,
  routeList,
}: {
  /** Cards filed per trigger in the last 30 days; undefined while the counts load. */
  filed: ReadonlyMap<RuleEvent, number> | undefined;
  /** Intake still runs the old route list, so the order decides nothing yet. */
  routeList: boolean;
}) {
  const host = useBoardSettingsHost();
  const providers = host.intakeProviders ?? [];

  const lanes = ARRIVAL_EVENTS.map(event => ({
    event,
    label: laneText(event).label,
    icon: <LaneIcon event={event} className="size-icon-sm text-foreground" />,
    filed: filed && (filed.get(event) ?? 0),
    sources: providers
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
      intakeHref={host.intakeSettingsHref()}
      LinkComponent={host.SettingsLinkComponent ?? host.LinkComponent}
    />
  );
}
