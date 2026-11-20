import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { FactorySkillInfo, StoredPhaseInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
import { boardFlow } from '../../boardRules/boardFlow';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { boardConfigPath, boardRulesPath } from '../boardConfigPaths';
import { PhaseRunnerCard } from './PhaseRunnerCard';
import { Muted } from './PhaseTimeline';
import { outlineOfStored, PhaseWalkthrough } from './PhaseWalkthrough';
import { RuleCountCard } from './RuleCountCard';
import { SettingsColumn } from './SettingsColumn';
import { StartsToggle } from './StartsToggle';

/**
 * Lines the first column's content up with the settings column above it (42rem wide, centered), and leaves the same
 * gutter after the last one. A column's content sits 1.25rem inside its edge.
 */
const MAP_GUTTER = 'px-[max(0.75rem,calc((100cqw_-_42rem)/2_-_1.25rem))]';

/**
 * A board as a map: its phases as columns, in board order, each reading top to bottom as a card's way through it:
 * how cards get in, who works them, how the work ends, and where they can go next. Rules are only counted here; the
 * Rules page holds what they say and in which order they apply.
 */
export function BoardOverview({
  factoryId,
  boardId,
  phases,
  skills,
  action,
  onAutoStart,
}: {
  factoryId: string;
  boardId: string;
  phases: readonly StoredPhaseInfo[];
  /** Undefined until the factory's skills load. */
  skills: FactorySkillInfo[] | undefined;
  action?: ReactNode;
  /** Switches starting on its own in the draft; left out when the board can't be edited. */
  onAutoStart?: (phaseKey: string, on: boolean) => void;
}) {
  const catalog = useBoardCatalog(factoryId);
  const routes = useIntakeRoutesQuery(factoryId);
  const loading = catalog.isPending || routes.isPending;
  const start = catalog.data?.find(board => board.id === boardId)?.initialPhase ?? phases[0]?.key;
  const outlines = phases.map(phase => outlineOfStored(phase, phases));
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
      <ol aria-label="Phases" className={cn('mx-auto flex w-max', MAP_GUTTER)}>
        {phases.map(phase => {
          const kind = phaseIconKind(boardId, phase.kind);
          const arriving = flow?.into.get(phase.key) ?? [];
          return (
            <li
              key={phase.key}
              aria-label={phase.name}
              className="before:via-border-strong relative flex w-64 shrink-0 flex-col px-2 not-first:before:absolute not-first:before:inset-y-0 not-first:before:left-0 not-first:before:w-px not-first:before:bg-linear-to-b not-first:before:from-transparent not-first:before:to-transparent"
            >
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <Link
                  to={boardConfigPath(factoryId, boardId, phase.key)}
                  className="flex min-w-0 items-center gap-2 hover:underline focus-visible:underline focus-visible:outline-hidden"
                >
                  <BoardStageIcon stage={phase.key} kind={kind} decorative />
                  <Txt as="span" variant="label" tone="ink" className="truncate">
                    {phase.name}
                  </Txt>
                </Link>
              </div>
              <div className="px-3 py-3">
                <PhaseWalkthrough
                  boardId={boardId}
                  phase={outlineOfStored(phase, phases)}
                  phases={outlines}
                  arrivals={
                    <>
                      {loading ? (
                        <Skeleton className="h-4 w-20" />
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
                  starts={
                    <StartsToggle
                      label={phase.name}
                      autoStart={phase.autoStart ?? false}
                      autoStartWhen={phase.autoStartWhen}
                      onChange={onAutoStart && (on => onAutoStart(phase.key, on))}
                    />
                  }
                  agent={<PhaseRunnerCard factoryId={factoryId} boardId={boardId} phase={phase} skills={skills} />}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
