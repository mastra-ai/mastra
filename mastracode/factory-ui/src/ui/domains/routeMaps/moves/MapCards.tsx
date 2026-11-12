import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Zap } from 'lucide-react';

import type { InstalledBoardInfo } from '../../../../api/types';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { describeConditions } from '../../settings/components/conditionFields';
import { phaseName, phaseOptions } from '../../settings/components/intakeRoutes';
import type { MapEventMove, MapPhase } from './movesMap';

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

const KIND_LABELS = { resting: 'Waits', working: 'Agent works', terminal: 'Finished' } as const;

/** One phase: what kind it is, how it starts and ends, and where cards may go from it. */
export function PhaseCard({
  board,
  entry,
  dimmed = false,
}: {
  board: InstalledBoardInfo;
  entry: MapPhase;
  dimmed?: boolean;
}) {
  const { phase, anyPhase, targets, isInitial } = entry;
  const name = phase.name ?? phase.title;
  return (
    <div
      data-dimmed={dimmed || undefined}
      className={cn(
        'bg-card border-border flex flex-col gap-2 rounded-xl border p-3 transition-opacity data-dimmed:opacity-35',
        phase.kind === 'terminal' && 'border-dashed',
      )}
    >
      <div className="flex items-center gap-2">
        <BoardStageIcon stage={phase.id} kind={phaseIconKind(board.id, phase.kind)} decorative />
        <Txt as="h3" variant="label" className="min-w-0 flex-1 truncate">
          {name}
        </Txt>
        <Txt as="span" variant="meta" tone="muted">
          {KIND_LABELS[phase.kind]}
        </Txt>
      </div>
      {(isInitial || phase.autoStart || phase.exitTool) && (
        <div className="flex flex-wrap gap-1">
          {isInitial && (
            <Badge size="sm" variant="info" emphasis="subtle">
              New cards start here
            </Badge>
          )}
          {phase.autoStart && (
            <Badge size="sm" emphasis="subtle">
              Starts on its own
            </Badge>
          )}
          {phase.exitTool && (
            <Badge size="sm" emphasis="subtle">
              {phase.exitTool.autoApprove
                ? `Ends with ${phase.exitTool.id}, approved on its own`
                : `Ends with ${phase.exitTool.id}, after approval`}
            </Badge>
          )}
        </div>
      )}
      <Txt as="p" variant="caption" tone="muted">
        {anyPhase
          ? 'Can move to any phase'
          : targets.length > 0
            ? `Can move to ${targets.map(target => target.name ?? target.title).join(', ')}`
            : 'Cards stay here'}
      </Txt>
    </div>
  );
}

/** A move a card makes when something happens to it: the route, what triggers it and when, and where it lands. */
export function EventMoveCard({
  board,
  move,
  dimmed = false,
}: {
  board: InstalledBoardInfo;
  move: MapEventMove;
  dimmed?: boolean;
}) {
  const conditions = describeConditions(move.route.when, phaseOptions(board));
  const target = board.phases.find(phase => phase.id === move.to);
  return (
    <div
      data-dimmed={dimmed || !move.route.enabled || undefined}
      className="bg-card border-border flex flex-col gap-1.5 rounded-xl border border-dashed p-3 transition-opacity data-dimmed:opacity-35"
    >
      <div className="flex items-center gap-2">
        <Zap className="text-chart-purple size-3.5 shrink-0" aria-hidden="true" />
        <Txt as="h3" variant="label" className="min-w-0 flex-1">
          {move.route.name}
        </Txt>
        {!move.route.enabled && (
          <Badge size="sm" emphasis="subtle">
            Off
          </Badge>
        )}
      </div>
      <Txt as="p" variant="caption" tone="muted">
        When {lowerFirst(move.trigger)}
      </Txt>
      {conditions && (
        <div className="flex flex-wrap gap-1">
          {conditions.parts.map((part, index) => (
            <Badge key={index} size="sm" emphasis="subtle">
              {part}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <Txt as="span" variant="meta" tone="muted">
          Moves to
        </Txt>
        <BoardStageIcon stage={move.to} kind={target && phaseIconKind(board.id, target.kind)} decorative />
        <Txt as="span" variant="meta">
          {phaseName(board, move.to) ?? move.to}
        </Txt>
      </div>
    </div>
  );
}
