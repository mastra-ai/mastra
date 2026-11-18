import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { FactorySkillInfo, InstalledBoardInfo } from '../../../../api/types';
import { unattended } from '../phaseSummary';
import { AddPhaseButton } from './AddPhaseButton';
import { BoardOverview, PhaseColumn, PhaseMap } from './BoardOverview';
import { PhaseRunnerCard, PhaseRunnerCardSkeleton } from './PhaseRunnerCard';
import { outlineOfInstalled, WalkthroughSteps } from './PhaseWalkthrough';
import { StartsToggle, StartsToggleSkeleton } from './StartsToggle';

const BAR = 'motion-reduce:before:animate-none';

function CaptionPlaceholder({ width }: { width: string }) {
  return <SkeletonText line="text-caption" className={cn(width, BAR)} />;
}

export function BoardOverviewSkeleton({
  factoryId,
  boardId,
  board,
  skills,
  sidebarHidden,
}: {
  factoryId: string;
  boardId: string;
  board: InstalledBoardInfo | undefined;
  skills: FactorySkillInfo[] | undefined;
  sidebarHidden: boolean;
}) {
  if (board) {
    return (
      <div role="status" aria-label="Loading board" inert>
        <BoardOverview
          factoryId={factoryId}
          boardId={boardId}
          action={
            sidebarHidden ? (
              <AddPhaseButton factoryId={factoryId} boardId={boardId} board={undefined} disabled={false} />
            ) : undefined
          }
          phases={board.phases.map(phase => {
            const name = phase.name ?? phase.title;
            return {
              outline: { ...outlineOfInstalled(phase), runs: phase.kind === 'working' },
              starts: (
                <StartsToggle
                  label={name}
                  autoStart={phase.autoStart ?? false}
                  autoStartWhen={phase.autoStartWhen}
                  onChange={() => undefined}
                />
              ),
              agent: (
                <PhaseRunnerCard
                  factoryId={factoryId}
                  boardId={boardId}
                  phase={{
                    key: phase.id,
                    name,
                    runner: { skill: phase.skill, goal: phase.goal, context: phase.context },
                  }}
                  skills={skills}
                />
              ),
            };
          })}
        />
      </div>
    );
  }

  return (
    <div role="status" aria-label="Loading board">
      <PhaseMap aria-hidden>
        {Array.from({ length: 4 }, (_, index) => (
          <PhaseColumn
            key={index}
            head={
              <>
                <Skeleton className={cn('size-4 shrink-0 rounded-full', BAR)} />
                <SkeletonText line="text-label" className={cn('w-24', BAR)} />
              </>
            }
          >
            {index === 0 ? (
              <WalkthroughSteps
                arrivals={
                  <>
                    <CaptionPlaceholder width="w-32" />
                    <CaptionPlaceholder width="w-28" />
                  </>
                }
                workIcon={unattended('resting').icon}
                work={<CaptionPlaceholder width="w-24" />}
                next={<SkeletonText line="text-body-sm" className={cn('w-20', BAR)} />}
              />
            ) : (
              <WalkthroughSteps
                arrivals={<CaptionPlaceholder width="w-32" />}
                starts={<StartsToggleSkeleton />}
                workIcon={IconRobot}
                work={<PhaseRunnerCardSkeleton />}
                next={<SkeletonText line="text-body-sm" className={cn('w-20', BAR)} />}
              />
            )}
          </PhaseColumn>
        ))}
      </PhaseMap>
    </div>
  );
}
