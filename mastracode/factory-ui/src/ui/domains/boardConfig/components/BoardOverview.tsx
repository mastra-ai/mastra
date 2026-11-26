import { Notice } from '@mastra/playground-ui/components/Notice';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { BoardMap } from '@mastra/playground-ui/domains/factory';
import type { ReactNode } from 'react';

import type { FactorySkillInfo, StoredPhaseInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
import { boardFlow } from '../../boardRules/boardFlow';
import { HrefLink } from '../../../ui/HrefLink';
import { boardConfigPath, boardRulesPath } from '../boardConfigPaths';
import { PhaseRunnerCard } from './PhaseRunnerCard';
import { Muted } from './PhaseTimeline';
import { outlineOfStored, sharedOutline } from './PhaseWalkthrough';
import { RuleCountCard } from './RuleCountCard';
import { StartsToggle } from './StartsToggle';

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
    <BoardMap
      boardId={boardId}
      phases={outlines.map(sharedOutline)}
      LinkComponent={HrefLink}
      action={action}
      notice={
        routes.isError && (
          <Notice variant="warning">
            <Notice.Message>Rules didn’t load, so the map doesn’t count them.</Notice.Message>
          </Notice>
        )
      }
      leaving={
        flow &&
        flow.leaving.length > 0 && (
          <>
            <RuleCountCard
              rules={flow.leaving}
              title="Rules that send cards to other boards"
              to={boardRulesPath(factoryId, boardId, 'leaving')}
              boardId={boardId}
              boards={catalog.data}
            />{' '}
            {flow.leaving.length === 1 ? 'sends' : 'send'} cards from here to other boards.
          </>
        )
      }
      column={outline => {
        const phase = phases.find(candidate => candidate.key === outline.key)!;
        const arriving = flow?.into.get(phase.key) ?? [];
        return {
          href: boardConfigPath(factoryId, boardId, phase.key),
          arrivals: (
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
          ),
          starts: (
            <StartsToggle
              label={phase.name}
              autoStart={phase.autoStart ?? false}
              autoStartWhen={phase.autoStartWhen}
              onChange={onAutoStart && (on => onAutoStart(phase.key, on))}
            />
          ),
          agent: <PhaseRunnerCard factoryId={factoryId} boardId={boardId} phase={phase} skills={skills} />,
        };
      }}
    />
  );
}
