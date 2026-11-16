import { INTAKE_ROUTE_RULE_FIELDS, routeEventsProblem } from '@mastra/factory/boards/board-events';
import { ruleGroupSchema } from '@mastra/factory/rules/rule-group';
import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Check, Filter } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../api/types';
import { ConditionRows } from '../../settings/components/ConditionRows';
import { describeRule, intakeRouteFacts } from '../../settings/components/conditionFields';
import { boardName, phaseName, phaseOptions } from '../ruleTargets';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { isOpenedLane, LANE_SECTIONS, laneText, placesCardless } from '../ruleLanes';
import type { RuleEvent } from '../ruleLanes';
import { ChoiceTile } from './ChoiceTile';
import { RuleTarget } from './RuleTarget';

const MAX_RULE_NAME = 120;
const WHEN_SCHEMA = ruleGroupSchema(INTAKE_ROUTE_RULE_FIELDS);

export type RuleStep = 'trigger' | 'conditions' | 'action' | 'review';

/** What the builder saves: a new rule, or the whole of an existing one. */
export type RuleDraft = Pick<IntakeRouteInfo, 'name' | 'on' | 'when'> & {
  /** `moveToBoardKey` names another board a card-move rule sends cards to; null keeps them on this board. */
  target: { phaseKey: string; moveToBoardKey: string | null };
};

const STEPS: { id: RuleStep; title: string; question: string }[] = [
  { id: 'trigger', title: 'Trigger', question: 'What should this rule listen for?' },
  { id: 'conditions', title: 'Only if', question: 'Which items should it apply to?' },
  { id: 'action', title: 'Move to', question: 'Where should it go?' },
  { id: 'review', title: 'Review', question: 'Name and check your rule' },
];

/**
 * Phases a rule may aim at. An item with no card yet can't land in a finished phase and starts in the board's first
 * phase, so it may only land where that phase can move it. A card already on a board can go to any phase.
 */
function targetPhases(board: InstalledBoardInfo | undefined, placesNew: boolean) {
  const phases = board?.phases ?? [];
  if (!placesNew) return phases;
  const first = phases.find(phase => phase.id === board?.initialPhase);
  return phases.filter(
    phase =>
      phase.kind !== 'terminal' &&
      (phase.id === first?.id || first?.transitions.some(transition => transition.to === phase.id) === true),
  );
}

/** What stops the rule saving, in words; undefined when it can save. */
function ruleProblem(on: readonly RuleEvent[], when: RuleGroup | null): string | undefined {
  if (when) {
    const parsed = WHEN_SCHEMA.safeParse(when);
    if (!parsed.success) return parsed.error.issues[0]?.message;
  }
  return routeEventsProblem(on, when) ?? undefined;
}

function suggestName(on: readonly RuleEvent[], when: RuleGroup | null, target: string) {
  const event = on.map(type => laneText(type).label.toLowerCase()).join(' or ');
  const where = when ? `, ${describeRule(when).charAt(0).toLowerCase()}${describeRule(when).slice(1)}` : '';
  const name = `When ${event}${where}, move to ${target}`;
  return name.length > MAX_RULE_NAME ? `${name.slice(0, MAX_RULE_NAME - 1)}…` : name;
}

export function RuleBuilderDialog({
  board,
  boards,
  initial,
  initialEvent,
  initialStep,
  readOnly,
  saving,
  error,
  onSave,
  onClose,
}: {
  board: InstalledBoardInfo;
  boards: readonly InstalledBoardInfo[];
  /** The rule being edited; a new rule when undefined. */
  initial?: IntakeRouteInfo;
  /** The lane a new rule was added from. */
  initialEvent?: RuleEvent;
  initialStep: RuleStep;
  readOnly: boolean;
  saving: boolean;
  /** Why the last save failed, from the server. */
  error?: string;
  onSave: (draft: RuleDraft) => void;
  onClose: () => void;
}) {
  const [on, setOn] = useState<RuleEvent[]>(() => initial?.on ?? (initialEvent ? [initialEvent] : []));
  const [when, setWhen] = useState<RuleGroup | null>(() => initial?.when ?? null);
  const [filtered, setFiltered] = useState(() => (initial?.when?.conditions.length ?? 0) > 0);
  const [incomplete, setIncomplete] = useState(false);
  const [boardKey, setBoardKey] = useState(() => initial?.target.moveToBoardKey ?? board.id);
  const [phaseKey, setPhaseKey] = useState<string | undefined>(() =>
    initial ? (initial.target.phaseKey ?? undefined) : undefined,
  );
  const [name, setName] = useState<string | undefined>(() => initial?.name);
  const [step, setStep] = useState<RuleStep>(initialStep);

  const cardless = placesCardless(on);
  const placesNew = on.some(isOpenedLane);
  const targetBoard = boards.find(candidate => candidate.id === boardKey);
  const phases = targetPhases(targetBoard, placesNew);
  const phase = phases.find(candidate => candidate.id === (phaseKey ?? targetBoard?.initialPhase));
  const rule = filtered ? when : null;
  const problem = on.length ? ruleProblem(on, rule) : undefined;
  const destination = phase && targetBoard ? `${boardName(targetBoard)} › ${phaseName(targetBoard, phase.id)}` : '';
  const shownName = name ?? (phase ? suggestName(on, rule, destination) : '');
  const complete: Record<RuleStep, boolean> = {
    trigger: on.length > 0,
    conditions: on.length > 0 && !(filtered && incomplete) && !problem,
    action: phase !== undefined,
    review: shownName.trim().length > 0,
  };
  const canSave = !readOnly && complete.trigger && complete.conditions && complete.action && complete.review;
  const stepIndex = STEPS.findIndex(candidate => candidate.id === step);
  const current = STEPS[stepIndex] ?? STEPS[0];

  const pickEvents = (next: RuleEvent[]) => {
    setOn(next);
    // An item with no card can only be filed on this board, so a rule that files one can't name another.
    if (placesCardless(next) && boardKey !== board.id) {
      setBoardKey(board.id);
      setPhaseKey(undefined);
    }
  };

  const save = () => {
    if (!canSave || !phase) return;
    onSave({
      name: shownName.trim(),
      on,
      when: rule,
      target: { phaseKey: phase.id, moveToBoardKey: boardKey === board.id ? null : boardKey },
    });
  };

  const summary: Record<RuleStep, ReactNode> = {
    trigger: on.length ? on.map(type => laneText(type).label).join(', ') : undefined,
    conditions: on.length ? describeRule(rule, phaseOptions(board)) : undefined,
    action: phase ? (
      <RuleTarget boards={boards} ownBoard={board.id} boardKey={boardKey} phaseKey={phase.id} />
    ) : undefined,
    review: undefined,
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{readOnly ? 'Rule' : initial ? 'Edit rule' : 'Add rule'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid min-h-105 grid-cols-1 gap-6 sm:grid-cols-[12rem_1fr]">
            <nav
              aria-label="Rule steps"
              className="sm:border-border flex gap-1 overflow-x-auto sm:flex-col sm:border-r sm:pr-4"
            >
              {STEPS.map((candidate, index) => {
                const reachable = index === 0 || STEPS.slice(0, index).every(before => complete[before.id]);
                const done = complete[candidate.id] && candidate.id !== 'review';
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={!reachable}
                    aria-current={step === candidate.id ? 'step' : undefined}
                    onClick={() => setStep(candidate.id)}
                    className={cn(
                      'flex shrink-0 items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors disabled:opacity-40',
                      step === candidate.id ? 'bg-fill-hover' : 'hover:bg-fill-subtle',
                    )}
                  >
                    <Txt
                      as="span"
                      variant="meta"
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                        done ? 'border-transparent bg-fill-inverse text-background' : 'border-border-strong',
                      )}
                    >
                      {done ? <Check className="size-3" aria-hidden /> : index + 1}
                    </Txt>
                    <span className="min-w-0">
                      <Txt as="span" variant="label" tone="ink" className="block">
                        {candidate.title}
                      </Txt>
                      {summary[candidate.id] && (
                        <Txt as="span" variant="caption" tone="muted" className="hidden truncate sm:block">
                          {summary[candidate.id]}
                        </Txt>
                      )}
                    </span>
                  </button>
                );
              })}
            </nav>

            <section aria-label={current.title} className="flex min-w-0 flex-col gap-4">
              <Txt as="h3" variant="heading">
                {current.question}
              </Txt>

              {step === 'trigger' && <TriggerStep value={on} disabled={readOnly} onChange={pickEvents} />}

              {step === 'conditions' && (
                <div className="flex flex-col gap-4">
                  <div role="radiogroup" aria-label="Which items" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ChoiceTile selected={!filtered} disabled={readOnly} onClick={() => setFiltered(false)}>
                      <TileText title={placesNew ? 'Every item' : 'Every card'} hint="Run whenever this happens." />
                    </ChoiceTile>
                    <ChoiceTile selected={filtered} disabled={readOnly} onClick={() => setFiltered(true)}>
                      <TileText
                        title="Only ones that match"
                        hint="Narrow it down by repository, label, author and more."
                      />
                    </ChoiceTile>
                  </div>
                  {filtered && (
                    <div className="border-border bg-fill-subtle rounded-xl border p-3">
                      <ConditionRows
                        label="Conditions"
                        rule={when}
                        facts={intakeRouteFacts(on)}
                        options={phaseOptions(board)}
                        onChange={(next, unfinished) => {
                          setWhen(next);
                          setIncomplete(unfinished);
                        }}
                      />
                    </div>
                  )}
                  {problem && <Notice variant="warning">{problem}</Notice>}
                </div>
              )}

              {step === 'action' && (
                <div className="flex flex-col gap-4">
                  {cardless ? (
                    <Txt as="p" variant="caption" tone="muted">
                      An item with no card yet can only be filed on this board.
                    </Txt>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Txt as="span" variant="eyebrow" tone="muted">
                        Board
                      </Txt>
                      <div role="radiogroup" aria-label="Board" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {boards.map(candidate => (
                          <ChoiceTile
                            key={candidate.id}
                            selected={candidate.id === boardKey}
                            disabled={readOnly}
                            onClick={() => {
                              setBoardKey(candidate.id);
                              if (candidate.id !== boardKey) setPhaseKey(undefined);
                            }}
                          >
                            <Txt as="span" variant="label" tone="ink">
                              {boardName(candidate)}
                              {candidate.id === board.id ? ' (this board)' : ''}
                            </Txt>
                          </ChoiceTile>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Txt as="span" variant="eyebrow" tone="muted">
                      Phase
                    </Txt>
                    <div role="radiogroup" aria-label="Phase" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {targetBoard &&
                        phases.map(candidate => (
                          <ChoiceTile
                            key={candidate.id}
                            selected={candidate.id === phase?.id}
                            disabled={readOnly}
                            onClick={() => {
                              setPhaseKey(candidate.id);
                              setStep('review');
                            }}
                          >
                            <span className="flex items-center gap-1.5">
                              <BoardStageIcon
                                stage={candidate.id}
                                kind={phaseIconKind(targetBoard.id, candidate.kind)}
                                decorative
                              />
                              <Txt as="span" variant="label" tone="ink">
                                {phaseName(targetBoard, candidate.id)}
                              </Txt>
                            </span>
                          </ChoiceTile>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 'review' && (
                <div className="flex flex-col gap-5">
                  <label className="flex flex-col gap-1.5">
                    <Txt as="span" variant="label" tone="muted">
                      Name
                    </Txt>
                    <Input
                      value={shownName}
                      maxLength={MAX_RULE_NAME}
                      disabled={readOnly}
                      onChange={change => setName(change.target.value)}
                    />
                  </label>
                  <div className="border-border bg-fill-subtle rounded-xl border p-4">
                    <Txt as="span" variant="eyebrow" tone="muted" className="mb-3 block">
                      This rule reads as
                    </Txt>
                    <ol className="flex flex-col gap-3">
                      <StoryLine label="When">{summary.trigger}</StoryLine>
                      <StoryLine label="Only if">
                        <span className="inline-flex items-center gap-1.5">
                          <Filter className="text-muted-foreground size-3.5" aria-hidden />
                          {summary.conditions}
                        </span>
                      </StoryLine>
                      <StoryLine label="Then">
                        <span className="inline-flex items-center gap-1.5">
                          Move to <ArrowRight className="size-3.5" aria-hidden /> {summary.action}
                        </span>
                      </StoryLine>
                    </ol>
                  </div>
                </div>
              )}

              {error && (
                <Notice variant="destructive" role="alert">
                  {error}
                </Notice>
              )}
            </section>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          <div className="flex-1" />
          {stepIndex > 0 && (
            <Button variant="default" onClick={() => setStep(STEPS[stepIndex - 1].id)}>
              Back
            </Button>
          )}
          {!readOnly &&
            (step === 'review' || (initial && canSave) ? (
              <Button variant="primary" disabled={!canSave || saving} onClick={save}>
                {saving ? 'Saving…' : initial ? 'Save rule' : 'Create rule'}
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={!complete[step]}
                onClick={() => setStep(STEPS[stepIndex + 1]?.id ?? 'review')}
              >
                Continue
              </Button>
            ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TileText({ title, hint }: { title: string; hint: string }) {
  return (
    <span>
      <Txt as="span" variant="label" tone="ink" className="block">
        {title}
      </Txt>
      <Txt as="span" variant="caption" tone="muted" className="block">
        {hint}
      </Txt>
    </span>
  );
}

function StoryLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[4.5rem_1fr] items-start gap-3">
      <Txt as="span" variant="body-sm" tone="muted">
        {label}
      </Txt>
      <Txt as="span" variant="body-sm">
        {children}
      </Txt>
    </li>
  );
}

/** Events grouped like the lanes: new items, then cards on this board; a rule may listen for several. */
function TriggerStep({
  value,
  disabled,
  onChange,
}: {
  value: readonly RuleEvent[];
  disabled: boolean;
  onChange: (on: RuleEvent[]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {LANE_SECTIONS.map(group => (
        <div key={group.title} role="group" aria-label={group.title} className="flex flex-col gap-2">
          <Txt as="span" variant="eyebrow" tone="muted">
            {group.title}
          </Txt>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.events.map(event => {
              const text = laneText(event);
              const Icon = text.icon;
              const selected = value.includes(event);
              return (
                <ChoiceTile
                  key={event}
                  role="checkbox"
                  selected={selected}
                  disabled={disabled || (selected && value.length === 1)}
                  onClick={() => onChange(selected ? value.filter(other => other !== event) : [...value, event])}
                >
                  <Icon className="text-badge-amber-indicator mt-0.5 size-4 shrink-0" aria-hidden />
                  <TileText title={text.label} hint={text.description} />
                </ChoiceTile>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
