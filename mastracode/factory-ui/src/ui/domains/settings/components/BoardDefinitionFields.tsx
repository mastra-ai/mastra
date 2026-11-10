import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import type { StoredBoardInfo, StoredPhaseInfo } from '../../../../api/types';
import { keyFromName, keyProblem } from '../services/boardDraft';
import type { BoardDraft } from '../services/boardDraft';
import { RuleEditor } from './RuleEditor';

const MAX_INSTRUCTIONS = 1000;
const MAX_OBJECTIVE = 2000;
const MAX_GOAL_RUNS = 50;
const NO_SKILL = '__none__';

type CardRule = NonNullable<StoredPhaseInfo['autoStartWhen']>;
type CodeBehaviour = NonNullable<StoredBoardInfo['codeBehaviour']>[string];
type PhaseTool = NonNullable<StoredPhaseInfo['tools']>[number];

/** The Factory tools a phase can grant the session working its cards. */
const PHASE_TOOLS: { id: PhaseTool; label: string }[] = [
  { id: 'factory_record_review_verdict', label: 'Record a review verdict' },
  { id: 'factory_review_source', label: 'Review the source of a change request' },
];

type PhaseKind = StoredPhaseInfo['kind'];
const PHASE_KINDS: { kind: PhaseKind; label: string }[] = [
  { kind: 'resting', label: 'Resting' },
  { kind: 'working', label: 'Working' },
  { kind: 'terminal', label: 'Terminal' },
];

/** What stops a move or a removal: the first phase is where cards start, so it stays a resting one. */
interface PhasePlacement {
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  /** Code phases keep their kind, and the first phase stays resting. */
  kindLocked: boolean;
}

/** Every other phase when `nextPhases` is unset, none from a terminal phase, as the server reads it. */
function nextPhasesOf(phase: StoredPhaseInfo, phases: StoredPhaseInfo[]): string[] {
  if (phase.nextPhases != null) return phase.nextPhases;
  return phase.kind === 'terminal' ? [] : phases.filter(other => other.key !== phase.key).map(other => other.key);
}

function PhaseEditor({
  phase,
  phases,
  code,
  skills,
  disabled,
  placement,
  onChange,
  onMove,
  onRemove,
  onRuleProblem,
}: {
  phase: StoredPhaseInfo;
  phases: StoredPhaseInfo[];
  code: CodeBehaviour | undefined;
  skills: string[];
  disabled: boolean;
  placement: PhasePlacement;
  onChange: (phase: StoredPhaseInfo) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onRuleProblem: (field: string, problem: string | undefined) => void;
}) {
  const id = useId();
  const working = phase.kind === 'working';
  const next = nextPhasesOf(phase, phases);
  const required = new Set(code?.requiredNextPhases ?? []);
  const instructions = phase.runner?.instructions ?? '';
  const exitToolId = phase.exitTool?.id ?? '';
  const goal = phase.runner?.goal;
  const objective = goal?.objective ?? '';
  const tools = phase.tools ?? [];
  const skillOptions =
    phase.runner?.skill && !skills.includes(phase.runner.skill) ? [phase.runner.skill, ...skills] : skills;
  const setRunner = (runner: Partial<NonNullable<StoredPhaseInfo['runner']>>) => {
    const merged = { ...phase.runner, ...runner };
    const cleaned = Object.fromEntries(Object.entries(merged).filter(([, value]) => value != null && value !== ''));
    onChange({ ...phase, runner: Object.keys(cleaned).length > 0 ? cleaned : null });
  };

  return (
    <SettingsContainer>
      <section aria-label={`${phase.name} phase`} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Txt tone="ink" as="h4" variant="body" className="m-0">
            {phase.name}
          </Txt>
          <Txt font="mono" tone="muted" as="span" variant="caption">
            {phase.key}
          </Txt>
          {disabled || placement.kindLocked ? (
            <Badge>{phase.kind}</Badge>
          ) : (
            <Select
              value={phase.kind}
              onValueChange={kind => {
                if (kind === null || kind === phase.kind) return;
                onRuleProblem('autoStartWhen', undefined);
                onRuleProblem('autoApproveWhen', undefined);
                // Only a working phase has a runner, automation, an exit tool and tools.
                onChange({
                  key: phase.key,
                  name: phase.name,
                  description: phase.description,
                  kind,
                  nextPhases: kind === 'terminal' ? [] : next,
                  ...(kind === 'working' ? { runner: { context: 'work' } } : {}),
                });
              }}
            >
              <SelectTrigger size="sm" className="w-32" aria-label={`${phase.name} kind`}>
                {PHASE_KINDS.find(option => option.kind === phase.kind)?.label}
              </SelectTrigger>
              <SelectContent>
                {PHASE_KINDS.map(option => (
                  <SelectItem key={option.kind} value={option.kind}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!disabled && (
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                tooltip="Move up"
                aria-label={`Move ${phase.name} up`}
                disabled={!placement.canMoveUp}
                onClick={() => onMove(-1)}
              >
                <ArrowUp />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                tooltip="Move down"
                aria-label={`Move ${phase.name} down`}
                disabled={!placement.canMoveDown}
                onClick={() => onMove(1)}
              >
                <ArrowDown />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                tooltip="Remove phase"
                aria-label={`Remove ${phase.name}`}
                disabled={!placement.canRemove}
                onClick={onRemove}
              >
                <Trash2 />
              </Button>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
            <Input
              id={`${id}-name`}
              value={phase.name}
              disabled={disabled}
              onChange={event => onChange({ ...phase, name: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
            <Input
              id={`${id}-description`}
              value={phase.description ?? ''}
              disabled={disabled}
              onChange={event => onChange({ ...phase, description: event.target.value || null })}
            />
          </Field>
        </div>

        {working && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-skill`}>Skill</FieldLabel>
                <Select
                  value={phase.runner?.skill ?? NO_SKILL}
                  disabled={disabled}
                  onValueChange={value => setRunner({ skill: value === NO_SKILL ? undefined : String(value) })}
                >
                  <SelectTrigger id={`${id}-skill`} size="sm" aria-label={`${phase.name} skill`}>
                    {phase.runner?.skill ?? 'None'}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SKILL}>None</SelectItem>
                    {skillOptions.map(skill => (
                      <SelectItem key={skill} value={skill}>
                        {skill}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-context`}>Runner context</FieldLabel>
                <Input
                  id={`${id}-context`}
                  value={phase.runner?.context ?? ''}
                  placeholder="work"
                  disabled={disabled}
                  onChange={event => setRunner({ context: event.target.value })}
                />
              </Field>
            </div>
            <Field invalid={instructions.length > MAX_INSTRUCTIONS}>
              <FieldLabel htmlFor={`${id}-instructions`}>Instructions</FieldLabel>
              <FieldDescription>
                Added to what the agent is told when this phase starts. {instructions.length}/{MAX_INSTRUCTIONS}
              </FieldDescription>
              <Textarea
                id={`${id}-instructions`}
                value={instructions}
                maxLength={MAX_INSTRUCTIONS}
                rows={3}
                disabled={disabled}
                onChange={event => setRunner({ instructions: event.target.value })}
              />
            </Field>
            <Field invalid={objective.length > MAX_OBJECTIVE}>
              <FieldLabel htmlFor={`${id}-goal`}>Goal</FieldLabel>
              <FieldDescription>
                The agent keeps working until a judge finds this objective met, so say when it is done and when it
                should wait for a person. Leave empty for a single run. {objective.length}/{MAX_OBJECTIVE}
              </FieldDescription>
              <Textarea
                id={`${id}-goal`}
                value={objective}
                maxLength={MAX_OBJECTIVE}
                rows={4}
                disabled={disabled}
                onChange={event => {
                  const text = event.target.value;
                  setRunner({ goal: text.trim() ? { ...goal, objective: text } : undefined });
                }}
              />
            </Field>
            {goal && (
              <Field>
                <FieldLabel htmlFor={`${id}-goal-runs`}>Goal runs</FieldLabel>
                <FieldDescription>
                  How many runs the goal gets before it pauses for a person, from 1 to {MAX_GOAL_RUNS}. Leave empty for
                  Factory&apos;s default.
                </FieldDescription>
                <Input
                  id={`${id}-goal-runs`}
                  type="number"
                  min={1}
                  max={MAX_GOAL_RUNS}
                  value={goal.maxRuns ?? ''}
                  disabled={disabled}
                  onChange={event => {
                    const runs = Number.parseInt(event.target.value, 10);
                    const { maxRuns: _maxRuns, ...rest } = goal;
                    setRunner({ goal: Number.isInteger(runs) ? { ...rest, maxRuns: runs } : rest });
                  }}
                />
              </Field>
            )}

            <Field orientation="horizontal" className="items-start gap-4">
              <div className="flex flex-1 flex-col gap-1">
                <FieldLabel htmlFor={`${id}-auto-start`}>Start on its own</FieldLabel>
                <FieldDescription>Run this phase without waiting for a person to approve it.</FieldDescription>
              </div>
              <Switch
                id={`${id}-auto-start`}
                aria-label={`${phase.name}: start on its own`}
                checked={phase.autoStart ?? false}
                disabled={disabled}
                onCheckedChange={checked => {
                  onChange({ ...phase, autoStart: checked, autoStartWhen: checked ? phase.autoStartWhen : null });
                  if (!checked) onRuleProblem('autoStartWhen', undefined);
                }}
              />
            </Field>
            {phase.autoStart && (
              <RuleEditor
                schema={cardRuleGroupSchema}
                label={`${phase.name}: start only when`}
                description="Leave empty to start every card on its own."
                rule={phase.autoStartWhen}
                disabled={disabled}
                onChange={(rule, problem) => {
                  onChange({ ...phase, autoStartWhen: rule });
                  onRuleProblem('autoStartWhen', problem);
                }}
              />
            )}

            <Field>
              <FieldLabel htmlFor={`${id}-exit-tool`}>Exit tool</FieldLabel>
              <FieldDescription>The tool whose success ends the phase. Leave empty for none.</FieldDescription>
              <Input
                id={`${id}-exit-tool`}
                value={exitToolId}
                disabled={disabled}
                onChange={event => {
                  const value = event.target.value.trim();
                  onChange({ ...phase, exitTool: value ? { ...phase.exitTool, id: value } : null });
                  if (!value) onRuleProblem('autoApproveWhen', undefined);
                }}
              />
            </Field>
            {exitToolId !== '' && (
              <Field orientation="horizontal" className="items-start gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <FieldLabel htmlFor={`${id}-auto-approve`}>Approve on its own</FieldLabel>
                  <FieldDescription>Approve {exitToolId} without a person, such as a submitted plan.</FieldDescription>
                </div>
                <Switch
                  id={`${id}-auto-approve`}
                  aria-label={`${phase.name}: approve ${exitToolId} on its own`}
                  checked={phase.exitTool?.autoApprove ?? false}
                  disabled={disabled}
                  onCheckedChange={checked => {
                    onChange({
                      ...phase,
                      exitTool: {
                        ...phase.exitTool,
                        id: exitToolId,
                        autoApprove: checked,
                        autoApproveWhen: checked ? phase.exitTool?.autoApproveWhen : undefined,
                      },
                    });
                    if (!checked) onRuleProblem('autoApproveWhen', undefined);
                  }}
                />
              </Field>
            )}
            {exitToolId !== '' && phase.exitTool?.autoApprove && (
              <RuleEditor
                schema={cardRuleGroupSchema}
                label={`${phase.name}: approve only when`}
                description="Leave empty to approve for every card."
                rule={phase.exitTool.autoApproveWhen}
                disabled={disabled}
                onChange={(rule, problem) => {
                  onChange({
                    ...phase,
                    exitTool: {
                      ...phase.exitTool,
                      id: exitToolId,
                      autoApprove: true,
                      autoApproveWhen: rule ?? undefined,
                    },
                  });
                  onRuleProblem('autoApproveWhen', problem);
                }}
              />
            )}
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend>
                <Txt as="span" variant="caption" tone="ink">
                  Factory tools
                </Txt>
              </legend>
              <Txt as="p" variant="caption" tone="muted">
                Given to the session that works the card in this phase, in its runner context.
              </Txt>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {PHASE_TOOLS.map(tool => (
                  <label key={tool.id} className="flex items-center gap-2">
                    <Checkbox
                      aria-label={`${phase.name}: ${tool.label}`}
                      checked={tools.includes(tool.id)}
                      disabled={disabled}
                      onCheckedChange={checked => {
                        const chosen = PHASE_TOOLS.map(({ id: key }) => key).filter(key =>
                          key === tool.id ? checked === true : tools.includes(key),
                        );
                        onChange({ ...phase, tools: chosen.length > 0 ? chosen : null });
                      }}
                    />
                    <Txt as="span" variant="caption">
                      {tool.label}
                    </Txt>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend>
            <Txt as="span" variant="caption" tone="ink">
              Next phases
            </Txt>
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {phases
              .filter(other => other.key !== phase.key)
              .map(other => (
                <label key={other.key} className="flex items-center gap-2">
                  <Checkbox
                    aria-label={`${phase.name} moves to ${other.name}`}
                    checked={next.includes(other.key)}
                    disabled={disabled || required.has(other.key)}
                    onCheckedChange={checked =>
                      onChange({
                        ...phase,
                        nextPhases: checked
                          ? phases.filter(p => p.key === other.key || next.includes(p.key)).map(p => p.key)
                          : next.filter(key => key !== other.key),
                      })
                    }
                  />
                  <Txt as="span" variant="caption">
                    {other.name}
                  </Txt>
                </label>
              ))}
          </div>
        </fieldset>
      </section>
    </SettingsContainer>
  );
}

/** A phase the server would refuse for its length, which the form holds the save back for. */
function tooLong(draft: BoardDraft): boolean {
  return draft.phases.some(
    phase =>
      (phase.runner?.instructions?.length ?? 0) > MAX_INSTRUCTIONS ||
      (phase.runner?.goal?.objective.length ?? 0) > MAX_OBJECTIVE,
  );
}

/** Whether the draft is one the server could accept; the server still has the last word. */
export function draftIsComplete(draft: BoardDraft): boolean {
  return draft.name.trim() !== '' && draft.phases.every(phase => phase.name.trim() !== '') && !tooLong(draft);
}

function placementOf(
  index: number,
  phases: StoredPhaseInfo[],
  codeBehaviour: StoredBoardInfo['codeBehaviour'],
): PhasePlacement {
  const isCode = (phase: StoredPhaseInfo | undefined) =>
    phase !== undefined && codeBehaviour?.[phase.key] !== undefined;
  // Whoever takes the first place has to be a resting phase, and a code board keeps its own first phase.
  const canLead = (phase: StoredPhaseInfo | undefined) => phase?.kind === 'resting' && !isCode(phases[0]);
  const phase = phases[index];
  return {
    canMoveUp: index > 1 || (index === 1 && canLead(phase)),
    canMoveDown: index < phases.length - 1 && (index > 0 || canLead(phases[1])),
    canRemove: !isCode(phase) && phases.length > 1 && (index > 0 || phases[1]?.kind === 'resting'),
    kindLocked: index === 0 || isCode(phase),
  };
}

/** Adds a phase under a key that stays with it: other phases and cards refer to a phase by its key. */
function AddPhase({ taken, onAdd }: { taken: string[]; onAdd: (phase: StoredPhaseInfo) => void }) {
  const [name, setName] = useState('');
  const [key, setKey] = useState<string | undefined>(undefined);
  const id = useId();
  const phaseKey = key ?? keyFromName(name);
  const problem = name.trim() === '' && key === undefined ? undefined : keyProblem(phaseKey, taken);

  return (
    <div className="flex flex-wrap items-start gap-4">
      <Field className="min-w-40 flex-1">
        <FieldLabel htmlFor={`${id}-name`}>New phase name</FieldLabel>
        <Input id={`${id}-name`} value={name} onChange={event => setName(event.target.value)} />
      </Field>
      <Field className="min-w-40 flex-1" invalid={problem !== undefined}>
        <FieldLabel htmlFor={`${id}-key`}>New phase key</FieldLabel>
        <Input id={`${id}-key`} value={phaseKey} onChange={event => setKey(event.target.value)} />
        {problem ? (
          <FieldError>{problem}</FieldError>
        ) : (
          <FieldDescription>Cannot be changed once the phase is added.</FieldDescription>
        )}
      </Field>
      <Button
        className="mt-6"
        disabled={name.trim() === '' || keyProblem(phaseKey, taken) !== undefined}
        onClick={() => {
          onAdd({ key: phaseKey, name: name.trim(), kind: 'resting', nextPhases: [] });
          setName('');
          setKey(undefined);
        }}
      >
        Add phase
      </Button>
    </div>
  );
}

/**
 * The editable part of a board, shared by the editor of a stored board and the new-board form:
 * its name, description and phases in order — each phase's kind, runner (skill, context,
 * instructions, goal), automation, exit tool, Factory tools and next phases. The moves a built-in
 * or app board's code makes stay checked, and its code phases keep their kind and cannot be removed.
 */
export function BoardDefinitionFields({
  draft,
  codeBehaviour,
  skills,
  disabled,
  children,
  onChange,
  onRuleProblem,
}: {
  draft: BoardDraft;
  codeBehaviour?: StoredBoardInfo['codeBehaviour'];
  skills: string[];
  disabled: boolean;
  /** Shown beside the board name, such as the key of a new board or the revision of a stored one. */
  children?: ReactNode;
  onChange: (update: (draft: BoardDraft) => BoardDraft) => void;
  /** Reports a phase rule the server would refuse under `phase.field`, or clears it. */
  onRuleProblem: (key: string, problem: string | undefined) => void;
}) {
  const id = useId();
  const setPhases = (update: (phases: StoredPhaseInfo[]) => StoredPhaseInfo[]) =>
    onChange(current => ({ ...current, phases: update(current.phases) }));

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <Field className="min-w-60 flex-1">
          <FieldLabel htmlFor={`${id}-board-name`}>Board name</FieldLabel>
          <Input
            id={`${id}-board-name`}
            value={draft.name}
            disabled={disabled}
            onChange={event => onChange(current => ({ ...current, name: event.target.value }))}
          />
        </Field>
        {children}
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-board-description`}>Board description</FieldLabel>
        <Input
          id={`${id}-board-description`}
          value={draft.description ?? ''}
          disabled={disabled}
          onChange={event => onChange(current => ({ ...current, description: event.target.value || null }))}
        />
      </Field>
      <div className="flex flex-col gap-3">
        {draft.phases.map((phase, index) => (
          <PhaseEditor
            key={phase.key}
            phase={phase}
            phases={draft.phases}
            code={codeBehaviour?.[phase.key]}
            skills={skills}
            disabled={disabled}
            placement={placementOf(index, draft.phases, codeBehaviour)}
            onChange={next => setPhases(phases => phases.map(p => (p.key === next.key ? next : p)))}
            onMove={by =>
              setPhases(phases => {
                const moved = [...phases];
                const [taken] = moved.splice(index, 1);
                moved.splice(index + by, 0, taken);
                return moved;
              })
            }
            onRemove={() => {
              onRuleProblem(`${phase.key}.autoStartWhen`, undefined);
              onRuleProblem(`${phase.key}.autoApproveWhen`, undefined);
              // The other phases stop moving cards to it; an unset list already means "every other phase".
              setPhases(phases =>
                phases
                  .filter(p => p.key !== phase.key)
                  .map(p => (p.nextPhases ? { ...p, nextPhases: p.nextPhases.filter(key => key !== phase.key) } : p)),
              );
            }}
            onRuleProblem={(field, problem) => onRuleProblem(`${phase.key}.${field}`, problem)}
          />
        ))}
      </div>
      {!disabled && (
        <AddPhase
          taken={draft.phases.map(phase => phase.key)}
          onAdd={phase => setPhases(phases => [...phases, phase])}
        />
      )}
    </>
  );
}

/** The rules the form is holding the save back for, keyed `phase.field`. */
export function useRuleProblems() {
  const [problems, setProblems] = useState<Record<string, string>>({});
  const report = (key: string, problem: string | undefined) =>
    setProblems(current => {
      const { [key]: _previous, ...rest } = current;
      return problem ? { ...rest, [key]: problem } : rest;
    });
  return { blocked: Object.keys(problems).length > 0, report, clear: () => setProblems({}) };
}
