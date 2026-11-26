import { BoardStageIcon, phaseIconKind } from '../../board/board-icons';
import type { BoardPhaseKind } from '../../board/board-icons';
import { IncomingChip } from './incoming-chip';
import type { FlowIncomingRule } from './incoming-chip';
import { RuleChip, TriggerLabel } from './rule-chip';
import type { FlowRuleLine } from './rule-chip';
import { Txt } from '@/ds/components/Txt';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '@/ds/primitives/raised-surface';
import { focusRing } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

/** A rule that sends this board's cards to another board, and where they land there. */
export interface OtherBoardMove {
  line: FlowRuleLine;
  /** Opens the phase they land in, on its board. */
  href: string;
  /** The phase they land in, drawn with its board's art; unset when the board or phase isn't known. */
  stage: { key: string; boardId: string; kind: BoardPhaseKind } | undefined;
  /** Unset when the board no longer has the phase. */
  phaseName: string | undefined;
  boardName: string;
}

interface OtherBoardsProps {
  leaving: readonly OtherBoardMove[];
  stray: readonly FlowRuleLine[];
  /** Other boards' rules that move their cards into a phase this board no longer has. */
  strayIncoming: readonly FlowIncomingRule[];
  LinkComponent: LinkComponent;
}

/** Rules that send this board's cards to another board, and rules into a phase the board no longer has. */
export function OtherBoards({ leaving, stray, strayIncoming, LinkComponent: Link }: OtherBoardsProps) {
  return (
    <>
      {leaving.length > 0 && (
        <section aria-labelledby="canvas-leaving" className="flex flex-col gap-4">
          <Txt as="h2" id="canvas-leaving" variant="body-sm" tone="muted">
            To other boards
          </Txt>
          <ul className="flex flex-col gap-3">
            {leaving.map(move => {
              const { line, stage } = move;
              const dimmed = line.emphasis === 'dimmed';
              return (
                <li key={`${line.event}:${line.ruleId}`} className="flex flex-wrap items-center gap-2.5">
                  <TriggerLabel trigger={line.trigger} dimmed={dimmed} />
                  <RuleChip line={line} LinkComponent={Link} />
                  <Link
                    href={move.href}
                    className={cn(
                      raisedSurfaceStyle,
                      surfaceStateLayerStyle,
                      'flex min-w-36 flex-col gap-0.5 rounded-2xl px-3.25 py-2.5 transition-opacity',
                      dimmed && 'opacity-35',
                      focusRing,
                    )}
                  >
                    <span className="flex items-center gap-2 text-card-title-strong text-foreground">
                      {stage && (
                        <BoardStageIcon stage={stage.key} kind={phaseIconKind(stage.boardId, stage.kind)} decorative />
                      )}
                      {move.phaseName ?? 'A removed phase'}
                    </span>
                    <span className="flex items-center gap-1 text-caption text-muted-foreground">
                      <IconArrowUpRight className="size-icon-xs" aria-hidden />
                      {move.boardName}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {stray.length + strayIncoming.length > 0 && (
        <section aria-labelledby="canvas-stray" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Txt as="h2" id="canvas-stray" variant="body-sm" tone="muted">
              Into a removed phase
            </Txt>
            <Txt as="p" variant="caption" tone="muted">
              These rules name a phase this board doesn’t have, so they can’t move cards. Open one to pick another
              phase.
            </Txt>
          </div>
          <ul className="flex flex-col items-start gap-1.5">
            {stray.map(line => (
              <li key={`${line.event}:${line.ruleId}`} className="flex flex-wrap items-center gap-2.5">
                <TriggerLabel trigger={line.trigger} dimmed={line.emphasis === 'dimmed'} />
                <RuleChip line={line} LinkComponent={Link} />
              </li>
            ))}
            {strayIncoming.map(rule => (
              <li key={rule.ruleId}>
                <IncomingChip rule={rule} stray LinkComponent={Link} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
