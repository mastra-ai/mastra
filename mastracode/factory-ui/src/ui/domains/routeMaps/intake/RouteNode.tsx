import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { Ref } from 'react';
import { Link } from 'react-router';

import { describeConditions } from '../../settings/components/conditionFields';
import { phaseOptions } from '../../settings/components/intakeRoutes';
import { intakeRouteAnchor, settingsSectionPath } from '../../settings/settingsSections';
import { INTAKE_SOURCE_LABELS, routeSources } from './intakeMap';
import type { MapDestinationBoard, MapRoute } from './intakeMap';
import { SourceIcon } from './SourceIcon';

/** Where a route lands its cards, in words, so the map reads without its connectors. */
function landsOn(entry: MapRoute, boards: readonly MapDestinationBoard[]): string {
  const [boardKey, phaseKey] = entry.destination?.split(':') ?? [];
  const destination = boards.find(candidate => candidate.board.id === boardKey);
  if (!destination) return `${entry.route.target.boardKey} (not installed)`;
  const phase = destination.phases.find(candidate => candidate.id === phaseKey);
  const where = `${destination.board.name ?? destination.board.title} › ${phase?.name ?? phase?.title ?? phaseKey}`;
  return entry.route.target.joinClosedIssue ? `Joins the issue’s card, moves it to ${where}` : where;
}

export function RouteNode({
  factoryId,
  entry,
  position,
  boards,
  anchorRef,
  dimmed,
  onActive,
}: {
  factoryId: string;
  entry: MapRoute;
  position: number;
  boards: readonly MapDestinationBoard[];
  anchorRef: Ref<HTMLAnchorElement>;
  dimmed: boolean;
  onActive: (active: boolean) => void;
}) {
  const { route } = entry;
  const board = boards.find(candidate => candidate.board.id === route.target.boardKey)?.board;
  const conditions = describeConditions(route.when, phaseOptions(board));
  const sources = routeSources(route.when);

  return (
    <li>
      <Link
        ref={anchorRef}
        to={settingsSectionPath(factoryId, 'intake', intakeRouteAnchor(route.id))}
        aria-label={`${route.name}: ${landsOn(entry, boards)}`}
        onPointerEnter={() => onActive(true)}
        onPointerLeave={() => onActive(false)}
        onFocus={() => onActive(true)}
        onBlur={() => onActive(false)}
        data-dimmed={dimmed || undefined}
        className={cn(
          'bg-card hover:border-border-hover focus-visible:outline-border-focus flex flex-col gap-2 rounded-xl border border-transparent p-3 transition-opacity focus-visible:outline-2',
          'data-dimmed:opacity-40',
        )}
      >
        <span className="flex items-center gap-2">
          <Txt as="span" variant="meta" tone="muted" className="tabular-nums">
            {position}
          </Txt>
          <Txt as="span" variant="meta" tone="muted">
            {entry.step}
          </Txt>
          <Txt as="span" variant="label" className="min-w-0 flex-1 truncate">
            {route.name}
          </Txt>
          {!route.enabled && (
            <Badge size="sm" emphasis="subtle">
              Off
            </Badge>
          )}
          {entry.isCatchAll && (
            <Badge size="sm" variant="info" emphasis="subtle">
              Catch-all
            </Badge>
          )}
        </span>
        {(conditions || sources) && (
          <span className="flex flex-wrap items-center gap-1.5">
            {sources?.map(source => (
              <span
                key={source}
                title={INTAKE_SOURCE_LABELS[source]}
                className="text-muted-foreground flex [&_svg]:size-3.5"
              >
                <SourceIcon source={source} />
              </span>
            ))}
            {conditions?.parts.map((part, index) => (
              <Badge key={index} size="sm" emphasis="subtle">
                {part}
              </Badge>
            ))}
          </span>
        )}
        <Txt as="span" variant="caption" tone="muted">
          → {landsOn(entry, boards)}
        </Txt>
        {entry.unreachable && (
          <Txt as="span" variant="meta" tone="muted">
            Never runs: a route above takes every new card.
          </Txt>
        )}
      </Link>
    </li>
  );
}
