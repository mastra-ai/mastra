import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowInbox } from '@mastra/playground-ui/icons/central/IconArrowInbox';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { IconBranch } from '@mastra/playground-ui/icons/central/IconBranch';
import { IconFlag2 } from '@mastra/playground-ui/icons/central/IconFlag2';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { IconSettingsSliderHor } from '@mastra/playground-ui/icons/central/IconSettingsSliderHor';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import type { InstalledBoardInfo, InstalledPhaseInfo, IntakeRouteInfo } from '../../../../api/types';
import { boardConfigPath, boardRulesPath } from '../../boardConfig/boardConfigPaths';
import { Muted, NextPhases, Step } from '../../boardConfig/components/PhaseTimeline';
import { RuleRow } from '../../boardConfig/components/RuleRow';
import { approvalText, toolLabel, unattended } from '../../boardConfig/phaseSummary';
import { AutoStartSwitch } from './AutoStartSwitch';
import { BoardStageIcon, phaseIconKind } from './BoardIcons';

/** Rules listed in the card before the rest are left to the Rules page. */
const SHOWN_RULES = 3;

/**
 * A phase read top to bottom, as the Overview does: the rules that bring cards in, who works them, how the work ends,
 * where cards go next. Starting on its own can be switched right there.
 */
export function PhaseSetupCard({
  factoryId,
  boardId,
  phase,
  phases,
  label,
  starts,
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
  starts: string;
  start: string | undefined;
  arriving: IntakeRouteInfo[] | undefined;
  rulesLoading: boolean;
  boards: readonly InstalledBoardInfo[] | undefined;
}) {
  const named = phases.map(candidate => ({
    key: candidate.id,
    name: candidate.name ?? candidate.title,
    kind: candidate.kind,
  }));

  return (
    <>
      <div className="flex items-center gap-2">
        <BoardStageIcon stage={phase.id} kind={phaseIconKind(boardId, phase.kind)} decorative />
        <Txt as="span" variant="label" tone="ink" className="min-w-0 flex-1 truncate">
          {label}
        </Txt>
        {phase.skill && <AutoStartSwitch factoryId={factoryId} boardId={boardId} phaseKey={phase.id} label={label} />}
        <div className="-mr-1.5 flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip={`Rules into ${label}`}
            render={<Link to={boardRulesPath(factoryId, boardId, phase.id)} />}
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
      <ol aria-label={`${label}, step by step`} className="flex flex-col">
        <Step label="In" icon={IconArrowInbox}>
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
                  to={boardRulesPath(factoryId, boardId, phase.id)}
                  className={cn(focusRing, 'text-muted-foreground hover:text-foreground w-fit rounded-sm text-xs')}
                >
                  {arriving.length - SHOWN_RULES} more
                </Link>
              )}
            </>
          )}
          {phase.id === start && <Muted>New cards start here</Muted>}
        </Step>
        <Step label="Work" icon={phase.skill ? IconRobot : unattended(phase.kind).icon}>
          {phase.skill ? (
            <>
              <Txt as="span" variant="caption" tone="ink" className="truncate">
                {phase.skill}
              </Txt>
              <Muted>{starts}</Muted>
              {phase.tools?.map(id => (
                <Muted key={id}>{toolLabel(id)}</Muted>
              ))}
            </>
          ) : (
            <Muted>{unattended(phase.kind).text}</Muted>
          )}
        </Step>
        {phase.exitTool && (
          <Step label="Ends with" icon={IconFlag2}>
            <Txt as="span" variant="caption" tone="ink" className="truncate">
              {phase.exitTool.id}
            </Txt>
            <Muted>{approvalText(phase.exitTool)}</Muted>
          </Step>
        )}
        <Step label="Next" icon={IconArrowRight}>
          <NextPhases boardId={boardId} next={phase.nextPhases ?? []} phases={named} />
        </Step>
      </ol>
    </>
  );
}
