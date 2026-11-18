import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconBranch } from '@mastra/playground-ui/icons/central/IconBranch';
import { IconSettingsSliderHor } from '@mastra/playground-ui/icons/central/IconSettingsSliderHor';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import type { InstalledBoardInfo, InstalledPhaseInfo, IntakeRouteInfo } from '../../../../api/types';
import { boardConfigPath, boardRulesPath } from '../../boardConfig/boardConfigPaths';
import { Muted } from '../../boardConfig/components/PhaseTimeline';
import { outlineOfInstalled, PhaseWalkthrough } from '../../boardConfig/components/PhaseWalkthrough';
import { RuleRow } from '../../boardConfig/components/RuleRow';
import { AutoStartSwitch } from './AutoStartSwitch';
import { BoardStageIcon, phaseIconKind } from './BoardIcons';

/** Rules listed in the card before the rest are left to the Rules page. */
const SHOWN_RULES = 3;

/**
 * A phase read top to bottom, as the Overview does: the rules that bring cards in, how and who works them, how the work ends,
 * where cards go next. Starting on its own can be switched on its step.
 */
export function PhaseSetupCard({
  factoryId,
  boardId,
  phase,
  phases,
  label,
  start,
  arriving,
  rulesLoading,
  boards,
}: {
  factoryId: string;
  boardId: string;
  phase: InstalledPhaseInfo;
  phases: readonly InstalledPhaseInfo[];
  label: string;
  start: string | undefined;
  arriving: IntakeRouteInfo[] | undefined;
  rulesLoading: boolean;
  boards: readonly InstalledBoardInfo[] | undefined;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <BoardStageIcon stage={phase.id} kind={phaseIconKind(boardId, phase.kind)} decorative />
        <Txt as="span" variant="label" tone="ink" className="min-w-0 flex-1 truncate">
          {label}
        </Txt>
        <div className="-mr-1.5 flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip={`Rules into ${label}`}
            render={<Link to={boardRulesPath(factoryId, boardId, { into: phase.id })} />}
          >
            <IconBranch />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip="Phase settings"
            render={<Link to={boardConfigPath(factoryId, boardId, phase.id)} />}
          >
            <IconSettingsSliderHor />
          </Button>
        </div>
      </div>
      <PhaseWalkthrough
        boardId={boardId}
        phase={outlineOfInstalled(phase)}
        phases={phases.map(outlineOfInstalled)}
        arrivals={
          <>
            {rulesLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : arriving === undefined ? (
              <Muted>Rules didn’t load</Muted>
            ) : arriving.length === 0 ? (
              <Muted>No rule moves cards here</Muted>
            ) : (
              <>
                <ul aria-label={`Rules that move cards into ${label}`} className="mt-0.5 flex flex-col gap-1">
                  {arriving.slice(0, SHOWN_RULES).map(rule => (
                    <RuleRow key={rule.id} rule={rule} boardId={boardId} boards={boards} />
                  ))}
                </ul>
                {arriving.length > SHOWN_RULES && (
                  <Link
                    to={boardRulesPath(factoryId, boardId, { into: phase.id })}
                    className={cn(focusRing, 'text-muted-foreground hover:text-foreground w-fit rounded-sm text-xs')}
                  >
                    {arriving.length - SHOWN_RULES} more
                  </Link>
                )}
              </>
            )}
            {phase.id === start && <Muted>New cards start here</Muted>}
          </>
        }
        starts={<AutoStartSwitch factoryId={factoryId} boardId={boardId} phase={phase} label={label} />}
        agent={
          <Txt as="span" variant="caption" tone="ink" className="truncate">
            {phase.skill}
          </Txt>
        }
      />
    </>
  );
}
