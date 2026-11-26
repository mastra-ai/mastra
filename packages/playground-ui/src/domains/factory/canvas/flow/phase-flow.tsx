import { useRef, useState } from 'react';
import { CARD_PORT, LINK_LINE, PhaseInlet, Port } from '../flow-links';
import { usePhoneLayout } from '../use-phone-layout';
import { useRowDrag } from '../use-row-drag';
import { IncomingChip } from './incoming-chip';
import type { FlowIncomingRule } from './incoming-chip';
import { IntakeBranch, IntakeBus, IntakeEntry } from './intake-entry';
import { NewPhaseCard } from './new-phase-card';
import { PhaseNode } from './phase-node';
import type { FlowPhase, FlowPhaseWork } from './phase-node';
import { RuleChip, TriggerLabel } from './rule-chip';
import type { FlowEmphasis, FlowRuleLine } from './rule-chip';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { focusRing } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

/** One phase of the flow with what its row shows. */
export interface PhaseFlowRow {
  phase: FlowPhase;
  /** The board's rules into the phase, trigger by trigger in the order Factory checks them. */
  lines: readonly FlowRuleLine[];
  /** Other boards' rules that move their cards into this phase. */
  incoming: readonly FlowIncomingRule[];
  /** Not the first phase, and no rule, move or Factory flow brings a card here. */
  unreached: boolean;
  /** New cards start in this phase. */
  start: boolean;
  /** How the phase's card reads beside the selection. */
  emphasis: FlowEmphasis;
  /** The phases its cards can move to, itself left out. */
  next: readonly string[];
  /** The moves its agent makes on its own. */
  automatic: ReadonlySet<string>;
  /** What its agent does; unset unless the phase is a working one. */
  work: FlowPhaseWork | undefined;
  /** Selects the phase. */
  href: string;
  /** Opens a new rule into the phase. */
  newRuleHref: string;
}

/** A run of phases, by index, that share an agent session, or where sessions stop. */
export interface FlowSessionSpan {
  label: string;
  from: number;
  to: number;
}

/** The board's phases top to bottom, as the flow draws them. */
export interface PhaseFlowModel {
  rows: readonly PhaseFlowRow[];
  sessions: readonly FlowSessionSpan[];
}

interface PhaseFlowProps {
  boardId: string;
  model: PhaseFlowModel;
  totals: ReadonlyMap<string, number>;
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
    /** The key a new phase's name gives while no key is typed. */
    keyFromName: (name: string) => string;
    /** Why a new phase's key can't be used, or undefined when it can. */
    keyProblem: (key: string, taken: readonly string[]) => string | undefined;
  };
  /** Where new issues and pull requests come onto the board. */
  intake: {
    /** Where the board stands in the intake order; unset until it loads. */
    sentence: string | undefined;
    /** The intake order, where the board's place is changed. */
    reorderHref: string;
    /** New items are offered to the board's rules: it's in the intake order, or the old route list still files. */
    asked: boolean;
  };
  LinkComponent: LinkComponent;
}

/** Rules past this many on one phase fold behind "+N more". */
const FOLD_AFTER = 5;

const RAIL = 'border-muted-foreground/35 border-l-2';
/** The rules beside a phase, and the gap their lines cross into its card; on a phone, the rules above the card. */
export const RULES_SIDE = 'mr-4 w-89.5 shrink-0 max-sm:mr-0 max-sm:w-full';
/** The cards' column and the link down its middle; on a phone, the link runs down the left gutter, by the ports. */
export const CARD_SIDE = 'flex w-75 shrink-0 justify-center max-sm:w-10';
/** The session a phase runs in, bracketing the phases that share one. A phone has no room beside the cards for it. */
export const SESSION_SIDE = 'w-30 shrink-0 max-sm:hidden';
/** A dashed pill that adds a rule or a phase where it stands, shown on hover, or always where there is no hover. */
const ADD_HERE =
  'border-border-strong text-caption text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full border border-dashed focus-visible:opacity-100';

type RowLink = 'card' | 'entry' | undefined;

/** Where the link into a row's card comes from on a phone: the card before, or the intake entry for the first. */
function rowLink(previous: FlowPhase | undefined, linked: boolean): RowLink {
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
  boardId,
  model,
  totals,
  selectedPhase,
  selectedRule,
  problems,
  rulesEditable,
  edit,
  intake,
  LinkComponent: Link,
}: PhaseFlowProps) {
  const phases = model.rows.map(row => row.phase);
  const phone = usePhoneLayout();
  const [adding, setAdding] = useState<number>();
  const spanOf = (index: number) => model.sessions.find(span => index >= span.from && index <= span.to);
  const [moved, setMoved] = useState('');
  const drag = useRowDrag({
    min: 1,
    max: phases.length - 1,
    onDrop: (from, to) => {
      edit?.onReorder(from, to);
      setMoved(`${phases[from]?.name} moved to position ${to + 1} of ${phases.length}.`);
    },
  });
  const flow = useRef<HTMLDivElement>(null);
  const { asked } = intake;
  const linked = asked && model.rows.some(row => row.lines.some(line => line.opened && !line.movesCardsOnly));
  const insertable = edit !== undefined && adding === undefined;
  const last = phases.at(-1);

  return (
    <div ref={flow} data-dragging={drag.drag ? '' : undefined} className="group/flow relative flex flex-col">
      <IntakeEntry sentence={intake.sentence} reorderHref={intake.reorderHref} linked={linked} LinkComponent={Link} />
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
                      'flex items-center justify-end text-caption text-muted-foreground max-sm:order-last max-sm:w-auto',
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
                  row={row}
                  selectedPhase={selectedPhase}
                  selectedRule={selectedRule}
                  rulesEditable={rulesEditable}
                  asked={asked}
                  linkedFrom={rowLink(previous, linked)}
                  LinkComponent={Link}
                />
                {/* The card keeps its own height in a taller row; its link runs on down to the next card. */}
                <div data-grip={movable ? '' : undefined} className="flex flex-col items-center max-sm:items-stretch">
                  <div data-inlet-card="" className="relative">
                    {(previous || linked) && <Port className={cn(CARD_PORT, '-top-1.25', !previous && 'sm:hidden')} />}
                    <PhaseNode
                      boardId={boardId}
                      phase={phase}
                      phases={phases}
                      next={row.next}
                      automatic={row.automatic}
                      work={row.work}
                      total={totals.get(phase.key)}
                      href={row.href}
                      emphasis={row.emphasis}
                      problem={problems.has(phase.key)}
                      unreached={row.unreached}
                      start={row.start}
                      movable={movable}
                      moves={
                        edit && {
                          required: edit.required(phase.key),
                          onChange: nextPhases => edit.onMoves(phase.key, nextPhases),
                        }
                      }
                      LinkComponent={Link}
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
                <div className={cn(SESSION_SIDE, 'pl-2.5 text-caption text-muted-foreground', span && RAIL)}>
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
                      keyFromName={edit.keyFromName}
                      keyProblem={edit.keyProblem}
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
      <span role="status" className="sr-only">
        {moved}
      </span>
    </div>
  );
}

/** Opens a new phase after `after`, in the gap it sits in. */
function AddPhaseButton({ after, onClick, className }: { after: FlowPhase; onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      aria-label={`Add a phase after ${after.name}`}
      onClick={onClick}
      className={cn(
        ADD_HERE,
        'z-10 h-5 bg-card px-2 transition-opacity group-data-dragging/flow:invisible',
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
  row,
  selectedPhase,
  selectedRule,
  rulesEditable,
  asked,
  linkedFrom,
  LinkComponent: Link,
}: {
  row: PhaseFlowRow;
  selectedPhase: string | undefined;
  selectedRule: string | undefined;
  rulesEditable: boolean;
  asked: boolean;
  linkedFrom: RowLink;
  LinkComponent: LinkComponent;
}) {
  const [open, setOpen] = useState(false);
  const folded = row.lines.slice(FOLD_AFTER);
  const unfolded = open || folded.some(line => line.ruleId === selectedRule);
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
        const lineEmphasis = line.emphasis;
        const labelled = shown[index - 1]?.event !== line.event;
        const inlet = labelled && line.opened;
        // A long trigger and name don't fit on one line: the chip drops under its trigger instead of cutting the name.
        return (
          <div
            key={`${line.event}:${line.ruleId}`}
            className={cn(
              'flex max-w-full min-w-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-1 max-sm:justify-start',
              inlet && 'w-full',
            )}
          >
            {inlet && <IntakeBranch linked={asked && takesNew(line.event)} />}
            {labelled && <TriggerLabel trigger={line.trigger} dimmed={lineEmphasis === 'dimmed'} />}
            <RuleChip line={line} LinkComponent={Link} />
          </div>
        );
      })}
      {folded.length > 0 && !unfolded && (
        <button
          type="button"
          data-join=""
          onClick={() => setOpen(true)}
          className={cn(
            'h-6.5 rounded-full border border-border px-2.5 text-caption text-muted-foreground hover:text-foreground',
            focusRing,
          )}
        >
          +{folded.length} more
        </button>
      )}
      {row.incoming.map(rule => (
        <IncomingChip key={rule.ruleId} rule={rule} LinkComponent={Link} />
      ))}
      {rulesEditable && (
        <Link
          href={row.newRuleHref}
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
