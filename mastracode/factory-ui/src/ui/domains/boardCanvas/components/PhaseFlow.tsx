import { IconArrowDownRight } from '@mastra/playground-ui/icons/central/IconArrowDownRight';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import type { InstalledBoardInfo, IntakeOrderResponse, StoredPhaseInfo } from '../../../../api/types';
import { useRowDrag } from '../../settings/components/useRowDrag';
import { boardConfigPath } from '../../boardConfig/boardConfigPaths';
import { isOpenedLane } from '../../boardRules/ruleLanes';
import { boardName } from '../../boardRules/ruleTargets';
import { FOLD_AFTER, sessionSpans } from '../canvasModel';
import type { CanvasEmphasis, CanvasModel, PhaseRow } from '../canvasModel';
import { usePhoneLayout } from './CanvasChrome';
import { CARD_PORT, LINK_LINE, PhaseInlet, Port } from './FlowLinks';
import { IntakeBranch, IntakeBus, IntakeEntry } from './IntakeEntry';
import { NewPhaseCard } from './NewPhaseCard';
import { PhaseNode } from './PhaseNode';
import { CHIP, ChipTooltip, RuleChip, SELECTED_RING, TriggerLabel } from './RuleChip';
import type { LaneOrder } from './RuleChip';

interface PhaseFlowProps {
  factoryId: string;
  boardId: string;
  model: CanvasModel;
  boards: readonly InstalledBoardInfo[];
  totals: ReadonlyMap<string, number>;
  emphasis: CanvasEmphasis;
  /** How numbered chips show the order of the rules on their trigger. */
  lanes: LaneOrder;
  /** The phase whose panel is open: its "+ Rule" stays shown. */
  selectedPhase: string | undefined;
  /** The rule whose panel is open: its row unfolds to show it. */
  selectedRule: string | undefined;
  problems: ReadonlySet<string>;
  /** Whether rules can be added here; editing one is up to its panel. */
  rulesEditable: boolean;
  /** Absent when the board can't be changed here. */
  edit?: {
    required: (phaseKey: string) => ReadonlySet<string>;
    onMoves: (phaseKey: string, nextPhases: string[]) => void;
    onReorder: (from: number, to: number) => void;
    /** Adds a resting phase at `at`, opening its panel when `open`. */
    onAdd: (phase: { key: string; name: string }, at: number, open: boolean) => void;
  };
  /** Where the board stands in the intake order; unset until it loads. */
  order: IntakeOrderResponse | undefined;
}

const RAIL = 'border-muted-foreground/35 border-l-2';
/** The rules beside a phase, and the gap their lines cross into its card; on a phone, the rules above the card. */
const RULES_SIDE = 'mr-4 w-89.5 shrink-0 max-sm:mr-0 max-sm:w-full';
/** The cards' column and the link down its middle; on a phone, the link runs down the left gutter, by the ports. */
const CARD_SIDE = 'flex w-75 shrink-0 justify-center max-sm:w-10';
/** The session a phase runs in, bracketing the phases that share one. A phone has no room beside the cards for it. */
const SESSION_SIDE = 'w-30 shrink-0 max-sm:hidden';
/** A dashed pill that adds a rule or a phase where it stands, shown on hover, or always where there is no hover. */
const ADD_HERE =
  'border-border-strong text-caption text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full border border-dashed focus-visible:opacity-100';

type RowLink = 'card' | 'entry' | undefined;

/** Where the link into a row's card comes from on a phone: the card before, or the intake entry for the first. */
function rowLink(previous: StoredPhaseInfo | undefined, linked: boolean): RowLink {
  if (previous) return 'card';
  if (linked) return 'entry';
  return undefined;
}

/**
 * The board top to bottom: where new issues and pull requests come in, then each phase with the rules that bring
 * cards into it, the moves out, and its session. A phase is added where it should stand, from the gap after the phase
 * it follows.
 */
export function PhaseFlow({
  factoryId,
  boardId,
  model,
  boards,
  totals,
  emphasis,
  lanes,
  selectedPhase,
  selectedRule,
  problems,
  rulesEditable,
  edit,
  order,
}: PhaseFlowProps) {
  const phases = model.rows.map(row => row.phase);
  const phone = usePhoneLayout();
  const [adding, setAdding] = useState<number>();
  const spans = sessionSpans(phases);
  const spanOf = (index: number) => spans.find(span => index >= span.from && index <= span.to);
  const drag = useRowDrag({ min: 1, max: phases.length - 1, onDrop: (from, to) => edit?.onReorder(from, to) });
  const flow = useRef<HTMLDivElement>(null);
  // The old route list still files by these rules; a board left out of the order never gets the chance.
  const asked =
    order !== undefined && (order.evaluator === 'route-list' || order.boards.some(board => board.boardKey === boardId));
  const linked =
    asked && model.rows.some(row => row.lines.some(line => isOpenedLane(line.event) && !line.movesCardsOnly));
  const insertable = edit !== undefined && adding === undefined;
  const last = phases.at(-1);

  return (
    <div ref={flow} data-dragging={drag.drag ? '' : undefined} className="group/flow relative flex flex-col">
      <IntakeEntry factoryId={factoryId} boardId={boardId} order={order} linked={linked} />
      {/* A phone's flow is one column with no room beside the rules for the intake line or the links into cards. */}
      {!phone && <IntakeBus flow={flow} />}
      <ol aria-label="Phases" className="flex flex-col">
        {model.rows.map((row, index) => {
          const { phase } = row;
          const span = spanOf(index);
          const previous = phases[index - 1];
          const next = phases[index + 1];
          const dragging = drag.drag?.from === index;
          const motion = drag.rowMotion(index);
          const movable = insertable && index > 0 && phases.length > 2;
          const linkedOn = next !== undefined || adding === index;
          return (
            <li
              key={phase.key}
              data-dragging={dragging || undefined}
              style={motion.style}
              onPointerDown={movable ? event => drag.onPointerDown(event, index) : undefined}
              onKeyDown={movable ? event => drag.onKeyDown(event, index) : undefined}
              className={cn('group/row relative flex flex-col', motion.className)}
            >
              {previous && (
                <div aria-hidden className="flex h-8 gap-4">
                  <span
                    className={cn(
                      RULES_SIDE,
                      'text-caption text-muted-foreground flex items-center justify-end max-sm:order-last max-sm:w-auto',
                    )}
                  >
                    {phase.kind === 'terminal' && previous.kind !== 'terminal' && 'Cards are finished here'}
                  </span>
                  <span className={CARD_SIDE}>
                    <span className={LINK_LINE} />
                  </span>
                  <span className={cn(SESSION_SIDE, span && span.from < index && RAIL)} />
                </div>
              )}
              <div className="group/phase relative flex gap-4 max-sm:flex-col max-sm:gap-2">
                <RowIn
                  factoryId={factoryId}
                  boardId={boardId}
                  boards={boards}
                  row={row}
                  emphasis={emphasis}
                  lanes={lanes}
                  selectedPhase={selectedPhase}
                  selectedRule={selectedRule}
                  rulesEditable={rulesEditable}
                  asked={asked}
                  linkedFrom={rowLink(previous, linked)}
                />
                {/* The card keeps its own height in a taller row; its link runs on down to the next card. */}
                <div data-grip={movable ? '' : undefined} className="flex flex-col items-center max-sm:items-stretch">
                  <div data-inlet-card="" className="relative">
                    {(previous || linked) && <Port className={cn(CARD_PORT, '-top-1.25', !previous && 'sm:hidden')} />}
                    <PhaseNode
                      boardId={boardId}
                      phase={phase}
                      phases={phases}
                      total={totals.get(phase.key)}
                      to={boardConfigPath(factoryId, boardId, phase.key)}
                      emphasis={emphasis.node(phase.key)}
                      problem={problems.has(phase.key)}
                      unreached={row.unreached}
                      moves={
                        edit && {
                          required: edit.required(phase.key),
                          onChange: nextPhases => edit.onMoves(phase.key, nextPhases),
                        }
                      }
                    />
                    {linkedOn && <Port className={cn(CARD_PORT, '-bottom-1.25')} />}
                  </div>
                  {linkedOn && (
                    <span className="group/gap relative flex flex-1 justify-center self-stretch">
                      <span className={LINK_LINE} />
                      {/* Down to the next card, across the gap after this row, so it sits halfway along the link. A
                          phone, or a touch with no hover to show it, adds after the last phase only. */}
                      {insertable && (
                        <span className="absolute inset-x-0 top-0 -bottom-8 z-10 flex items-center justify-center max-sm:hidden pointer-coarse:hidden">
                          <AddPhaseButton
                            after={phase}
                            onClick={() => setAdding(index)}
                            className="opacity-0 group-hover/gap:opacity-100"
                          />
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className={cn(SESSION_SIDE, 'text-caption text-muted-foreground pl-2.5', span && RAIL)}>
                  {span?.from === index && span.label}
                </div>
                {!phone && <PhaseInlet />}
              </div>
              {edit && adding === index && (
                <>
                  <div aria-hidden className="flex h-8 gap-4">
                    <span className={cn(RULES_SIDE, 'max-sm:hidden')} />
                    <span className={CARD_SIDE}>
                      <span className={LINK_LINE} />
                    </span>
                    <span className={cn(SESSION_SIDE, next && span && span.to > index && RAIL)} />
                  </div>
                  <div className="flex gap-4">
                    <span className={cn(RULES_SIDE, 'max-sm:hidden')} />
                    <NewPhaseCard
                      boardId={boardId}
                      takenKeys={phases.map(candidate => candidate.key)}
                      linked={next !== undefined}
                      onAdd={(added, open) => {
                        setAdding(undefined);
                        edit.onAdd(added, index + 1, open);
                      }}
                      onCancel={() => setAdding(undefined)}
                    />
                    <span className={cn(SESSION_SIDE, next && span && span.to > index && RAIL)} />
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {insertable && last && (
        <div className="flex gap-4 pt-3">
          <span className={cn(RULES_SIDE, 'max-sm:hidden')} />
          <span className="flex w-75 shrink-0 justify-center max-sm:w-auto max-sm:justify-start">
            <AddPhaseButton
              after={last}
              onClick={() => setAdding(phases.length - 1)}
              className="opacity-0 group-hover/flow:opacity-100 pointer-coarse:opacity-100"
            />
          </span>
        </div>
      )}
    </div>
  );
}

/** Opens a new phase after `after`, in the gap it sits in. */
function AddPhaseButton({
  after,
  onClick,
  className,
}: {
  after: StoredPhaseInfo;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      aria-label={`Add a phase after ${after.name}`}
      onClick={onClick}
      className={cn(
        ADD_HERE,
        'bg-card z-10 h-5 px-2 transition-opacity group-data-dragging/flow:invisible',
        focusRing,
        className,
      )}
    >
      <IconPlusMedium className="size-icon-xs" aria-hidden />
      Phase
    </button>
  );
}

/**
 * The rules into a phase, folded past five, then other boards' rules that move cards here, each with a line into the
 * card's name, and last a way to add one. They start level with the name. The intake line runs down the gutter on
 * the left and plugs into the triggers new items arrive on. On a phone they stand above the card instead, and the link
 * into it, from the card before or the intake entry, runs down the gutter beside them.
 */
function RowIn({
  factoryId,
  boardId,
  boards,
  row,
  emphasis,
  lanes,
  selectedPhase,
  selectedRule,
  rulesEditable,
  asked,
  linkedFrom,
}: {
  factoryId: string;
  boardId: string;
  boards: readonly InstalledBoardInfo[];
  row: PhaseRow;
  emphasis: CanvasEmphasis;
  lanes: LaneOrder;
  selectedPhase: string | undefined;
  selectedRule: string | undefined;
  rulesEditable: boolean;
  asked: boolean;
  linkedFrom: RowLink;
}) {
  const [open, setOpen] = useState(false);
  const folded = row.lines.slice(FOLD_AFTER);
  const unfolded = open || folded.some(line => line.rule.id === selectedRule);
  const shown = unfolded ? row.lines : row.lines.slice(0, FOLD_AFTER);
  const selected = selectedPhase === row.phase.key;
  // A rule that only moves cards on its trigger files no new item, so the line stops short of a trigger holding no other.
  const takesNew = (event: string) => row.lines.some(line => line.event === event && !line.movesCardsOnly);

  return (
    <div
      data-rules-in=""
      className={cn(
        RULES_SIDE,
        'relative flex flex-col items-end gap-1.5 pt-2 pl-7 max-sm:items-start max-sm:pt-0 max-sm:pl-10',
      )}
    >
      {linkedFrom && (
        <span
          aria-hidden
          className={cn(
            LINK_LINE,
            'absolute -bottom-2 left-5 -translate-x-1/2 sm:hidden',
            linkedFrom === 'entry' ? '-top-8' : 'top-0',
          )}
        />
      )}
      {shown.map((line, index) => {
        const lineEmphasis = emphasis.line(line, row.phase.key);
        const labelled = shown[index - 1]?.event !== line.event;
        const inlet = labelled && isOpenedLane(line.event);
        // A long trigger and name don't fit on one line: the chip drops under its trigger instead of cutting the name.
        return (
          <div
            key={`${line.event}:${line.rule.id}`}
            className={cn(
              'flex max-w-full min-w-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-1 max-sm:justify-start',
              inlet && 'w-full',
            )}
          >
            {inlet && <IntakeBranch linked={asked && takesNew(line.event)} />}
            {labelled && <TriggerLabel event={line.event} dimmed={lineEmphasis === 'dimmed'} />}
            <RuleChip
              line={line}
              to={boardConfigPath(factoryId, boardId, undefined, { rule: line.rule.id })}
              emphasis={lineEmphasis}
              lanes={lanes}
            />
          </div>
        );
      })}
      {folded.length > 0 && !unfolded && (
        <button
          type="button"
          data-join=""
          onClick={() => setOpen(true)}
          className={cn(
            'border-border text-caption text-muted-foreground hover:text-foreground h-6.5 rounded-full border px-2.5',
            focusRing,
          )}
        >
          +{folded.length} more
        </button>
      )}
      {row.incoming.map(rule => {
        const from = boards.find(board => board.id === rule.target.boardKey);
        const name = from ? boardName(from) : rule.target.boardKey;
        const outside = emphasis.outside(rule.id);
        return (
          <ChipTooltip key={rule.id} title={undefined} lines={[`“${rule.name}” on ${name} moves cards here.`]}>
            <Link
              data-join=""
              data-dimmed={outside === 'dimmed' || undefined}
              to={boardConfigPath(factoryId, rule.target.boardKey, undefined, { rule: rule.id })}
              className={cn(
                CHIP,
                'border-border bg-transparent text-body-sm text-foreground border transition-opacity',
                outside === 'dimmed' && 'opacity-35',
                outside === 'selected' && SELECTED_RING,
              )}
            >
              <IconArrowDownRight className="size-icon-xs shrink-0" aria-hidden />
              <span className="truncate">{name}</span>
            </Link>
          </ChipTooltip>
        );
      })}
      {rulesEditable && (
        <Link
          to={boardConfigPath(factoryId, boardId, undefined, { newRule: { into: row.phase.key } })}
          aria-label={`Add a rule into ${row.phase.name}`}
          className={cn(
            ADD_HERE,
            'h-6.5 px-2.5',
            selected
              ? 'opacity-100'
              : 'opacity-0 group-has-[[data-rules-in]:hover,[data-inlet-card]:hover]/phase:opacity-100 pointer-coarse:opacity-100',
            focusRing,
          )}
        >
          <IconPlusMedium className="size-icon-xs" aria-hidden />
          Rule
        </Link>
      )}
    </div>
  );
}
