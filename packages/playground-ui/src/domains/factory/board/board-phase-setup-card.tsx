import type { InstalledBoardInfo, InstalledPhaseInfo, IntakeRouteInfo } from '@mastra/client-js';
import { approvalText, toolLabel } from '../rules/phase-summary';
import { AutoStartSwitch } from './auto-start-switch';
import { useBoardNavigation } from './board-navigation';
import { Muted, PhaseSetupCard } from './phase-walkthrough';

import type { PhaseOutline } from './phase-walkthrough';
import { RuleRow } from './rule-row';
import { Button } from '@/ds/components/Button';
import { SkeletonText } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { IconSettingsSliderHor } from '@/ds/icons/central/IconSettingsSliderHor';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

/** Rules listed in the card before the rest are left to the board's settings. */
const SHOWN_RULES = 3;

/**
 * A phase read top to bottom, as the Overview does: the rules that bring cards in, how and who works them, how the work ends,
 * where cards go next. Starting on its own can be switched on its step.
 */
/** A phase as the walkthrough reads it, with Factory's tool labels and approval wording. */
function installedPhaseOutline(phase: InstalledPhaseInfo): PhaseOutline {
  return {
    key: phase.id,
    name: phase.name ?? phase.title,
    kind: phase.kind,
    runs: Boolean(phase.skill),
    tools: phase.tools?.map(toolLabel),
    exitTool: phase.exitTool ? { id: phase.exitTool.id, approval: approvalText(phase.exitTool) } : null,
    nextPhases: phase.nextPhases,
  };
}

export function BoardPhaseSetupCard({
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
  const { LinkComponent: Link, boardConfigHref } = useBoardNavigation();
  return (
    <PhaseSetupCard
      boardId={boardId}
      label={label}
      phase={installedPhaseOutline(phase)}
      phases={phases.map(installedPhaseOutline)}
      actions={
        <Button
          variant="ghost"
          size="icon-sm"
          tooltip="Phase settings"
          render={<Link href={boardConfigHref(boardId, phase.id)} />}
        >
          <IconSettingsSliderHor />
        </Button>
      }
      arrivals={
        <>
          {rulesLoading ? (
            <SkeletonText line="text-caption" className="h-3 w-24 motion-reduce:before:animate-none" />
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
                  href={boardConfigHref(boardId, phase.id)}
                  className={cn(focusRing, 'w-fit rounded-sm text-caption text-muted-foreground hover:text-foreground')}
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
  );
}
