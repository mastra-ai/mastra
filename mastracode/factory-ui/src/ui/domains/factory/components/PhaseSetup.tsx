import { HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowInbox } from '@mastra/playground-ui/icons/central/IconArrowInbox';
import { IconFlag2 } from '@mastra/playground-ui/icons/central/IconFlag2';
import { IconPlayCircle } from '@mastra/playground-ui/icons/central/IconPlayCircle';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import type { InstalledPhaseInfo } from '../../../../api/types';
import { boardConfigPath } from '../../boardConfig/boardConfigPaths';
import { approvalText, startsText } from '../../boardConfig/phaseSummary';
import { ruleCount } from '../../boardRules/ruleLanes';
import { usePhaseArrivals } from '../hooks/usePhaseArrivals';
import type { PhaseSetupHandle } from './PhaseSetupHoverCard';

/**
 * A phase's setup in its column header: the rules bringing cards in, with their count, and an icon each for its agent,
 * its starting on its own, and its exit tool. Shown for any phase with one of those. Hover or focus reads the whole
 * phase in the board's one PhaseSetupHoverCard; a click opens its settings.
 */
export function PhaseSetup({
  handle,
  factoryId,
  boardId,
  phase,
  phases,
}: {
  handle: PhaseSetupHandle;
  factoryId: string;
  boardId: string;
  phase: InstalledPhaseInfo;
  phases: readonly InstalledPhaseInfo[];
}) {
  const { into } = usePhaseArrivals(factoryId, boardId, phases[0]?.id);
  const arriving = into?.get(phase.id) ?? [];
  const { skill, autoStart, exitTool } = phase;
  if (!skill && !exitTool && !arriving.length) return null;
  const label = phase.name ?? phase.title;
  const summary = [
    arriving.length && `${ruleCount(arriving.length)} ${arriving.length === 1 ? 'moves' : 'move'} cards into ${label}.`,
    skill && `${label} runs ${skill}. ${startsText(phase)}.`,
    exitTool && `${label} ends when ${exitTool.id} succeeds. ${approvalText(exitTool)}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <HoverCardTrigger
      handle={handle}
      payload={phase.id}
      delay={0}
      closeDelay={150}
      render={<Link to={boardConfigPath(factoryId, boardId, phase.id)} aria-label={summary} />}
      className={cn(
        focusRing,
        'text-muted-foreground hover:text-foreground flex h-6 items-center gap-1 rounded-md px-1 transition-colors',
        'group-data-collapsed/column:h-auto group-data-collapsed/column:flex-col group-data-collapsed/column:py-1',
      )}
    >
      {!!arriving.length && (
        <span className="flex items-center gap-0.5 group-data-collapsed/column:flex-col">
          <IconArrowInbox className="size-icon-sm" aria-hidden />
          <Txt as="span" variant="meta" aria-hidden className="tabular-nums">
            {arriving.length}
          </Txt>
        </span>
      )}
      {skill && <IconRobot className="size-icon-sm" aria-hidden />}
      {skill && autoStart && <IconPlayCircle className="text-info-indicator size-icon-sm" aria-hidden />}
      {exitTool && <IconFlag2 className="size-icon-sm" aria-hidden />}
    </HoverCardTrigger>
  );
}
