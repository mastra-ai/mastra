import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import { useIntakeBindingsQuery } from '../../../../../hooks/useIntakeConfig';
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

  return (
    <section aria-label="Sources" className="flex w-63 shrink-0 flex-col gap-3 max-sm:w-full">
      <div className="flex h-5 items-center justify-between">
        <Txt as="h2" variant="column" tone="muted">
          Sources
        </Txt>
        <Link
          to={settingsSectionPath(factoryId, 'intake')}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Txt as="span" variant="caption">
            Work Intake
          </Txt>
          <IconArrowUpRight className="size-icon-xs" aria-hidden />
        </Link>
      </div>

      <ul className="flex flex-col gap-3">
        {ARRIVAL_EVENTS.map(event => {
          const from = [...providers].filter(
            provider => event !== 'pull_request.opened' || CODE_HOSTS.includes(provider),
          );
          return (
            <li
              key={event}
              data-link-source
              aria-label={laneText(event).label}
              className={cn(raisedSurfaceStyle, 'flex h-17 flex-col gap-1.75 rounded-2xl px-3.25 pt-2.75 pb-3')}
            >
              {/* The order cards' title row height, so a link between two titles at one height runs straight. */}
              <div className="flex min-h-5.5 items-center gap-2">
                <LaneIcon event={event} className="text-foreground size-icon-sm" />
                <Txt as="span" variant="card-title-strong" tone="ink" className="flex-1">
                  {laneText(event).label}
                </Txt>
                {filed && (
                  <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
                    {filed.get(event) ?? 0}
                  </Txt>
                )}
              </div>
              <div className="flex items-center gap-3">
                {from.map(provider => (
                  <span key={provider} className="flex items-center gap-1.25">
                    <SettingsIntegrationIcon provider={provider} className="size-icon-xs" />
                    <Txt as="span" variant="caption" tone="muted">
                      {INTAKE_PROVIDERS[provider]}
                    </Txt>
                  </span>
                ))}
                {from.length === 0 && (
                  <Txt as="span" variant="caption" tone="muted">
                    No source connected
                  </Txt>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* With the old route list still in charge, the order's notice says so instead. */}
      {!routeList && (
        <div className="flex flex-col gap-2.5 px-3.25 pt-2">
          <Txt as="p" variant="caption" tone="muted">
            A new issue or pull request is offered to the boards in this order. The first rule that matches keeps it.
          </Txt>
          <Txt as="p" variant="caption" tone="muted">
            After that, only its board’s card rules apply.
          </Txt>
        </div>
      )}
    </section>
  );
}
