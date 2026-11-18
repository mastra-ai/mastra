import { Notice } from '@mastra/playground-ui/components/Notice';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
import { boardFlow } from '../../boardRules/boardFlow';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { boardConfigPath, boardRulesPath } from '../boardConfigPaths';
import { Muted } from './PhaseTimeline';
import { PhaseWalkthrough } from './PhaseWalkthrough';
import type { PhaseOutline } from './PhaseWalkthrough';
import { RuleCountCard } from './RuleCountCard';
import { SettingsColumn } from './SettingsColumn';

export interface MapPhase {
  outline: PhaseOutline;
  starts: ReactNode;
  agent: ReactNode;
}

/**
 * Lines the first column's content up with the settings column above it (42rem wide, centered), and leaves the same
 * gutter after the last one. A column's content sits 1.25rem inside its edge.
 */
const MAP_GUTTER = 'px-[max(0.75rem,calc((100cqw_-_42rem)/2_-_1.25rem))]';

export function PhaseMap({ children, ...props }: ComponentProps<'ol'>) {
  return (
    <ol {...props} className={cn('mx-auto flex w-max', MAP_GUTTER)}>
      {children}
    </ol>
  );
}

export function PhaseColumn({ label, head, children }: { label?: string; head: ReactNode; children: ReactNode }) {
  return (
    <li
      aria-label={label}
      className="before:via-border-strong relative flex w-64 shrink-0 flex-col px-2 not-first:before:absolute not-first:before:inset-y-0 not-first:before:left-0 not-first:before:w-px not-first:before:bg-linear-to-b not-first:before:from-transparent not-first:before:to-transparent"
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">{head}</div>
      <div className="px-3 py-3">{children}</div>
    </li>
  );
}

/**
 * A board as a map: its phases as columns, in board order, each reading top to bottom as a card's way through it:
 * how cards get in, who works them, how the work ends, and where they can go next. Rules are only counted here; the
 * Rules page holds what they say and in which order they apply.
 */
export function BoardOverview({
  factoryId,
  boardId,
  phases,
  action,
}: {
  factoryId: string;
  boardId: string;
  phases: readonly MapPhase[];
  action?: ReactNode;
}) {
  const catalog = useBoardCatalog(factoryId);
  const routes = useIntakeRoutesQuery(factoryId);
  const loading = catalog.isPending || routes.isPending;
  const outlines = phases.map(phase => phase.outline);
  const start = catalog.data?.find(board => board.id === boardId)?.initialPhase ?? outlines[0]?.key;
  const flow =
    routes.data && start ? boardFlow(routes.data.intakeRoutes, { key: boardId, initialPhase: start }) : undefined;

  return (
    <section aria-label="Board map" className="flex flex-col gap-3">
      {action && (
        <SettingsColumn pinned className="flex justify-end">
          {action}
        </SettingsColumn>
      )}
      {routes.isError && (
        <SettingsColumn pinned>
          <Notice variant="warning">
            <Notice.Message>Rules didn’t load, so the map doesn’t count them.</Notice.Message>
          </Notice>
        </SettingsColumn>
      )}
      {flow && flow.leaving.length > 0 && (
        <SettingsColumn pinned className="mb-4">
          <Txt as="p" variant="caption" tone="muted">
            <RuleCountCard
              rules={flow.leaving}
              title="Rules that send cards to other boards"
              to={boardRulesPath(factoryId, boardId, 'leaving')}
              boardId={boardId}
              boards={catalog.data}
            />{' '}
            {flow.leaving.length === 1 ? 'sends' : 'send'} cards from here to other boards.
          </Txt>
        </SettingsColumn>
      )}
      <PhaseMap aria-label="Phases">
        {phases.map(({ outline: phase, starts, agent }) => {
          const kind = phaseIconKind(boardId, phase.kind);
          const arriving = flow?.into.get(phase.key) ?? [];
          return (
            <PhaseColumn
              key={phase.key}
              label={phase.name}
              head={
                <Link
                  to={boardConfigPath(factoryId, boardId, phase.key)}
                  className="flex min-w-0 items-center gap-2 hover:underline focus-visible:underline focus-visible:outline-hidden"
                >
                  <BoardStageIcon stage={phase.key} kind={kind} decorative />
                  <Txt as="span" variant="label" tone="ink" className="truncate">
                    {phase.name}
                  </Txt>
                </Link>
              }
            >
              <PhaseWalkthrough
                boardId={boardId}
                phase={phase}
                phases={outlines}
                arrivals={
                  <>
                    {loading ? (
                      <SkeletonText line="text-caption" className="w-20 motion-reduce:before:animate-none" />
                    ) : flow ? (
                      arriving.length > 0 ? (
                        <RuleCountCard
                          rules={arriving}
                          title={`Rules that move cards into ${phase.name}`}
                          to={boardRulesPath(factoryId, boardId, { into: phase.key })}
                          boardId={boardId}
                          boards={catalog.data}
                        />
                      ) : (
                        <Muted>No rule moves cards here</Muted>
                      )
                    ) : (
                      <Muted>Rules didn’t load</Muted>
                    )}
                    {phase.key === start && <Muted>New cards start here</Muted>}
                  </>
                }
                starts={starts}
                agent={agent}
              />
            </PhaseColumn>
          );
        })}
      </PhaseMap>
    </section>
  );
}
