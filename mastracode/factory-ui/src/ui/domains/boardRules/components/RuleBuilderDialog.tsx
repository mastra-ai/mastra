import {
  INTAKE_ROUTE_RULE_FIELDS,
  matchesOutsiderPullRequests,
  routeEventsProblem,
} from '@mastra/factory/boards/board-events';
import { ruleGroupSchema } from '@mastra/factory/rules/rule-group';
import type { RuleCondition, RuleGroup } from '@mastra/factory/rules/rule-group';
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
import { RadioGroup } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Check, Filter } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../api/types';
import { useSourceSuggestions } from '../../../../hooks/useSourceSuggestions';
import { ConditionRows } from '../../settings/components/ConditionRows';
import { describeRule, intakeRouteFacts } from '../../settings/components/conditionFields';
import { boardName, phaseName, phaseOptions } from '../ruleTargets';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { LANE_SECTIONS, LEGACY_OPENED_EVENT, laneText, placesArrival } from '../ruleLanes';
import type { RuleEvent } from '../ruleLanes';
import { ChoiceTile, RadioTile } from './ChoiceTile';
import { GithubOnlyBadge } from './GithubOnlyBadge';
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
 * Phases a rule may aim at. An item with no card yet can't land in a finished phase; any other
 * phase works, even one the board's first phase can't move to — the rule's author designs the
 * board too. A card already on a board can go to any phase.
 */
function targetPhases(board: InstalledBoardInfo | undefined, placesNew: boolean) {
  const phases = board?.phases ?? [];
  if (!placesNew) return phases;
  return phases.filter(phase => phase.kind !== 'terminal');
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
  factoryId,
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
  /** The Factory project whose repositories, teams and projects the source filter suggests. */
  factoryId: string;
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
  const sources = useSourceSuggestions(factoryId);
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
  // Bumped when the dialog rewrites the conditions itself: the editor reads them once per key.
  const [rewrites, setRewrites] = useState(0);

  const placesNew = placesArrival(on);
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
    if (placesArrival(next) && boardKey !== board.id) {
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

  // The rule moves cards on pull request events for whoever opened them, so it can narrow itself to trusted authors.
  const addTrustedCondition = () => {
    const trusted: RuleCondition = { field: 'pullRequest.trusted', operator: 'equals', value: true };
    setWhen(
      rule === null
        ? { operator: 'AND', conditions: [trusted] }
        : rule.operator === 'AND'
          ? { ...rule, conditions: [...rule.conditions, trusted] }
          : { operator: 'AND', conditions: [rule, trusted] },
    );
    setFiltered(true);
    setIncomplete(false);
    setRewrites(count => count + 1);
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
                      {done ? <Check className="size-icon-xs" aria-hidden /> : index + 1}
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
                  <RadioGroup
                    aria-label="Which ones"
                    value={filtered ? 'matching' : 'every'}
                    disabled={readOnly}
                    onValueChange={value => {
                      setFiltered(value === 'matching');
                      // The conditions editor rebuilds from the last complete rule, dropping any unfinished row.
                      setIncomplete(false);
                    }}
                    className="grid-cols-1 sm:grid-cols-2"
                  >
                    <RadioTile value="every" selected={!filtered} disabled={readOnly}>
                      <TileText title={placesNew ? 'Every new one' : 'Every card'} hint="Run whenever this happens." />
                    </RadioTile>
                    <RadioTile value="matching" selected={filtered} disabled={readOnly}>
                      <TileText
                        title="Only ones that match"
                        hint="Narrow it down by repository, label, author and more."
                      />
                    </RadioTile>
                  </RadioGroup>
                  {filtered && (
                    <div className="border-border bg-fill-subtle rounded-xl border p-3">
                      <ConditionRows
                        key={rewrites}
                        label="Conditions"
                        rule={when}
                        facts={intakeRouteFacts(on)}
                        options={{ ...phaseOptions(board), 'source.repository': sources }}
                        onChange={(next, unfinished) => {
                          setWhen(next);
                          setIncomplete(unfinished);
                        }}
                      />
                    </div>
                  )}
                  {problem && <Notice variant="warning">{problem}</Notice>}
                  {!initial?.outsiderPullRequestsGated && matchesOutsiderPullRequests(on, rule) && (
                    <Notice variant="info">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Also matches pull requests from outside authors.</span>
                        {!readOnly && (
                          <button type="button" onClick={addTrustedCondition} className="shrink-0 underline">
                            Add: Pull request trusted is yes
                          </button>
                        )}
                      </span>
                    </Notice>
                  )}
                </div>
              )}

              {step === 'action' && (
                <div className="flex flex-col gap-4">
                  {placesNew ? (
                    <Txt as="p" variant="caption" tone="muted">
                      An item with no card yet can only be filed on this board.
                    </Txt>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Txt as="span" variant="eyebrow" tone="muted">
                        Board
                      </Txt>
                      <RadioGroup
                        aria-label="Board"
                        value={boardKey}
                        disabled={readOnly}
                        onValueChange={value => {
                          if (typeof value !== 'string' || value === boardKey) return;
                          setBoardKey(value);
                          setPhaseKey(undefined);
                        }}
                        className="grid-cols-1 sm:grid-cols-3"
                      >
                        {boards.map(candidate => (
                          <RadioTile
                            key={candidate.id}
                            value={candidate.id}
                            selected={candidate.id === boardKey}
                            disabled={readOnly}
                          >
                            <Txt as="span" variant="label" tone="ink">
                              {boardName(candidate)}
                              {candidate.id === board.id ? ' (this board)' : ''}
                            </Txt>
                          </RadioTile>
                        ))}
                      </RadioGroup>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Txt as="span" variant="eyebrow" tone="muted">
                      Phase
                    </Txt>
                    <RadioGroup
                      aria-label="Phase"
                      value={phase?.id ?? null}
                      disabled={readOnly}
                      onValueChange={value => typeof value === 'string' && setPhaseKey(value)}
                      className="grid-cols-1 sm:grid-cols-2"
                    >
                      {targetBoard &&
                        phases.map(candidate => (
                          <RadioTile
                            key={candidate.id}
                            value={candidate.id}
                            selected={candidate.id === phase?.id}
                            disabled={readOnly}
                            // A click picks and moves on; the arrow keys only move the choice.
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
                          </RadioTile>
                        ))}
                    </RadioGroup>
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
                          <Filter className="text-muted-foreground size-icon-sm" aria-hidden />
                          {summary.conditions}
                        </span>
                      </StoryLine>
                      <StoryLine label="Then">
                        <span className="inline-flex items-center gap-1.5">
                          Move to <ArrowRight className="size-icon-sm" aria-hidden /> {summary.action}
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

/** Events grouped like the lanes, issues then pull requests; a rule may listen for several. */
function TriggerStep({
  value,
  disabled,
  onChange,
}: {
  value: readonly RuleEvent[];
  disabled: boolean;
  onChange: (on: RuleEvent[]) => void;
}) {
  const on: readonly string[] = value;
  return (
    <div className="flex flex-col gap-5">
      {on.includes(LEGACY_OPENED_EVENT) && (
        <Notice variant="info">
          Also listens on “{laneText(LEGACY_OPENED_EVENT).label}”, which takes new issues and pull requests. Saving
          keeps it.
        </Notice>
      )}
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
                  selected={selected}
                  disabled={disabled || (selected && value.length === 1)}
                  onClick={() => onChange(selected ? value.filter(other => other !== event) : [...value, event])}
                >
                  <Icon className="text-badge-amber-indicator mt-0.5 size-4 shrink-0" aria-hidden />
                  <TileText title={text.label} hint={text.description} />
                  {text.githubOnly && (
                    <span className="ml-auto shrink-0">
                      <GithubOnlyBadge />
                    </span>
                  )}
                </ChoiceTile>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
