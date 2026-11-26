import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { boardConfigPath } from '../../boardConfig/boardConfigPaths';
import { boardName, phaseName } from '../../boardRules/ruleTargets';
import type { Emphasis, RuleLine } from '../canvasModel';
import { RuleChip, TriggerLabel } from './RuleChip';
import type { LaneOrder } from './RuleChip';

interface OtherBoardsProps {
  factoryId: string;
  boardId: string;
  boards: readonly InstalledBoardInfo[];
  leaving: RuleLine[];
  stray: RuleLine[];
  emphasis: (line: RuleLine) => Emphasis;
  lanes: LaneOrder;
}

/** Rules that send this board's cards to another board, and rules into a phase the board no longer has. */
export function OtherBoards({ factoryId, boardId, boards, leaving, stray, emphasis, lanes }: OtherBoardsProps) {
  return (
    <>
      {leaving.length > 0 && (
        <section aria-labelledby="canvas-leaving" className="flex flex-col gap-4">
          <Txt as="h2" id="canvas-leaving" variant="body-sm" tone="muted">
            To other boards
          </Txt>
          <ul className="flex flex-col gap-3">
            {leaving.map(line => {
              const key = line.rule.target.moveToBoardKey ?? line.rule.target.boardKey;
              const board = boards.find(candidate => candidate.id === key);
              const phaseKey = line.rule.target.phaseKey ?? board?.initialPhase;
              const phase = board?.phases.find(candidate => candidate.id === phaseKey);
              const dimmed = emphasis(line) === 'dimmed';
              return (
                <li key={`${line.event}:${line.rule.id}`} className="flex flex-wrap items-center gap-2.5">
                  <TriggerLabel event={line.event} dimmed={dimmed} />
                  <RuleChip
                    line={line}
                    to={boardConfigPath(factoryId, boardId, undefined, { rule: line.rule.id })}
                    emphasis={emphasis(line)}
                    lanes={lanes}
                  />
                  <Link
                    to={boardConfigPath(factoryId, key, phaseKey ?? undefined)}
                    className={cn(
                      raisedSurfaceStyle,
                      surfaceStateLayerStyle,
                      'flex min-w-36 flex-col gap-0.5 rounded-2xl px-3.25 py-2.5 transition-opacity',
                      dimmed && 'opacity-35',
                      focusRing,
                    )}
                  >
                    <span className="text-card-title-strong text-foreground flex items-center gap-2">
                      {phaseKey && board && (
                        <BoardStageIcon
                          stage={phaseKey}
                          kind={phaseIconKind(key, phase?.kind ?? 'resting')}
                          decorative
                        />
                      )}
                      {phaseName(board, line.rule.target.phaseKey) ?? 'A removed phase'}
                    </span>
                    <span className="text-caption text-muted-foreground flex items-center gap-1">
                      <IconArrowUpRight className="size-icon-xs" aria-hidden />
                      {board ? boardName(board) : key}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {stray.length > 0 && (
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
              <li key={`${line.event}:${line.rule.id}`} className="flex flex-wrap items-center gap-2.5">
                <TriggerLabel event={line.event} dimmed={emphasis(line) === 'dimmed'} />
                <RuleChip
                  line={line}
                  to={boardConfigPath(factoryId, boardId, undefined, { rule: line.rule.id })}
                  emphasis={emphasis(line)}
                  lanes={lanes}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
