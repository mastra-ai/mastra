import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useRef, useState } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
import { Connector, ConnectorLayer, useConnectorAnchors } from '../connectors';
import type { AnchorBox } from '../connectors';
import { DestinationBoardCard } from './DestinationBoardCard';
import { ARRIVAL_EVENTS, destinationKey, intakeMap, routeTakesFrom } from './intakeMap';
import type { IntakeSource } from './intakeMap';
import { ArrivalLane } from './ArrivalLane';
import { RouteNode } from './RouteNode';
import { boardTone } from '../boardTones';

const EVENT = ARRIVAL_EVENTS[0];

/** Every new-card route as a flow: where cards come from, the routes in the order they're tried, where each lands. */
export function IntakeRoutesMap({ factoryId }: { factoryId: string }) {
  const routesQuery = useIntakeRoutesQuery(factoryId);
  const catalog = useBoardCatalog(factoryId);

  if (routesQuery.isPending || catalog.isPending) {
    return (
      <Txt as="p" variant="caption" tone="muted" role="status">
        Loading intake routes…
      </Txt>
    );
  }
  const error = routesQuery.error ?? catalog.error;
  if (error) return <Notice variant="destructive">{error.message}</Notice>;
  return (
    <IntakeFlow
      factoryId={factoryId}
      map={intakeMap(routesQuery.data?.intakeRoutes ?? [], catalog.data ?? [], EVENT.id)}
      boardIds={(catalog.data ?? []).map(board => board.id)}
    />
  );
}

function IntakeFlow({
  factoryId,
  map,
  boardIds,
}: {
  factoryId: string;
  map: ReturnType<typeof intakeMap>;
  boardIds: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Anything that moves a route or a destination row moves the connectors, even when nothing resizes.
  const layoutKey = [
    ...map.routes.map(entry => `${entry.route.id}:${entry.destination}`),
    ...map.boards.flatMap(entry => entry.phases.map(phase => destinationKey(entry.board.id, phase.id))),
  ].join('|');
  const anchors = useConnectorAnchors(containerRef, layoutKey);
  const [activeRoute, setActiveRoute] = useState<string>();
  const [source, setSource] = useState<IntakeSource>();

  const routeDimmed = (id: string) => {
    const entry = map.routes.find(candidate => candidate.route.id === id);
    if (!entry) return false;
    if (activeRoute) return activeRoute !== id;
    if (!entry.route.enabled || entry.unreachable) return true;
    return source !== undefined && !routeTakesFrom(entry.route, source);
  };
  const activeDestination = activeRoute
    ? map.routes.find(entry => entry.route.id === activeRoute)?.destination
    : undefined;

  return (
    <div className="@container flex flex-col gap-5">
      <ArrivalLane
        label={EVENT.label}
        selected={source}
        onSelect={next => setSource(current => (current === next ? undefined : next))}
      />
      <div
        ref={containerRef}
        className="relative grid grid-cols-1 gap-4 @min-[36rem]:grid-cols-[minmax(0,1fr)_11rem] @min-[36rem]:gap-x-14"
      >
        <ConnectorLayer>
          {map.routes.map(entry => {
            const box = anchors.boxes.get(`route:${entry.route.id}`);
            const target = entry.destination ? anchors.boxes.get(`dest:${entry.destination}`) : undefined;
            if (!box || !target) return null;
            return (
              <g key={entry.route.id} className={routeDimmed(entry.route.id) ? 'opacity-15' : undefined}>
                <Connector
                  from={box}
                  to={target}
                  className={boardTone(boardIds, entry.route.target.boardKey)}
                  dashed={!entry.route.enabled}
                />
              </g>
            );
          })}
          {map.fallback && (
            <FallbackConnector
              anchors={anchors.boxes}
              destination={map.fallback.destination}
              tone={boardTone(boardIds, map.fallback.board.id)}
              dimmed={activeRoute !== undefined}
            />
          )}
        </ConnectorLayer>
        <ol aria-label="Intake routes in order" className="flex min-w-0 flex-col gap-2">
          {map.routes.map((entry, index) => (
            <RouteNode
              key={entry.route.id}
              factoryId={factoryId}
              entry={entry}
              position={index + 1}
              boards={map.boards}
              anchorRef={anchors.ref(`route:${entry.route.id}`)}
              dimmed={routeDimmed(entry.route.id)}
              onActive={active => setActiveRoute(active ? entry.route.id : undefined)}
            />
          ))}
          {map.fallback && (
            <li
              ref={anchors.ref('fallback')}
              className="border-border flex flex-col gap-1 rounded-xl border border-dashed p-3"
            >
              <Txt as="span" variant="label">
                Otherwise
              </Txt>
              <Txt as="span" variant="caption" tone="muted">
                Cards no route takes land on {map.fallback.board.name ?? map.fallback.board.title}’s first phase.
              </Txt>
            </li>
          )}
        </ol>
        <div className="flex min-w-0 flex-col gap-3 self-center">
          {map.boards.map(({ board, phases }) => (
            <DestinationBoardCard
              key={board.id}
              board={board}
              phases={phases}
              tone={boardTone(boardIds, board.id)}
              active={activeDestination}
              anchorRef={phaseKey => anchors.ref(`dest:${board.id}:${phaseKey}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FallbackConnector({
  anchors,
  destination,
  tone,
  dimmed,
}: {
  anchors: ReadonlyMap<string, AnchorBox>;
  destination: string;
  tone: string;
  dimmed: boolean;
}) {
  const from = anchors.get('fallback');
  const to = anchors.get(`dest:${destination}`);
  if (!from || !to) return null;
  return (
    <g className={dimmed ? 'opacity-20' : undefined}>
      <Connector from={from} to={to} className={tone} dashed />
    </g>
  );
}
