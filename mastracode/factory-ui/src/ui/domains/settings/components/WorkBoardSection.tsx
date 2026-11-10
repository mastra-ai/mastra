import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { useId, useState } from 'react';

import type { StoredBoardInfo, StoredPhaseInfo } from '../../../../api/types';
import { useBoardQuery, useResetBoardMutation, useSaveBoardMutation } from '../../../../hooks/useBoardEditor';
import type { BoardRequestError } from '../../../../hooks/useBoardEditor';
import { useFactorySkillsQuery } from '../../../../hooks/useFactorySkills';
import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';
import { RuleEditor } from './RuleEditor';
import { SettingsSubsection } from './SettingsSubsection';

const WORK_BOARD = DEFAULT_BOARD_ID;
const MAX_INSTRUCTIONS = 1000;
const MAX_OBJECTIVE = 2000;
const MAX_GOAL_RUNS = 50;
const NO_SKILL = '__none__';

type CodeBehaviour = NonNullable<StoredBoardInfo['codeBehaviour']>[string];
type PhaseTool = NonNullable<StoredPhaseInfo['tools']>[number];

/** The Factory tools a phase can grant the session working its cards. */
const PHASE_TOOLS: { id: PhaseTool; label: string }[] = [
  { id: 'factory_record_review_verdict', label: 'Record a review verdict' },
  { id: 'factory_review_source', label: 'Review the source of a change request' },
];

interface Draft {
  name: string;
  phases: StoredPhaseInfo[];
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
  onChange,
  onRuleProblem,
}: {
  phase: StoredPhaseInfo;
  phases: StoredPhaseInfo[];
  code: CodeBehaviour | undefined;
  skills: string[];
  disabled: boolean;
  onChange: (phase: StoredPhaseInfo) => void;
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
          <Badge>{phase.kind}</Badge>
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

function errorText(error: BoardRequestError): string {
  return error.conflicts.length > 0 ? error.conflicts.join('\n') : error.message;
}

function BoardEditor({
  factoryId,
  board,
  canEdit,
  onReload,
}: {
  factoryId: string;
  board: StoredBoardInfo;
  canEdit: boolean;
  onReload: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({ name: board.name, phases: board.phases });
  const [ruleProblems, setRuleProblems] = useState<Record<string, string>>({});
  const save = useSaveBoardMutation(factoryId, WORK_BOARD);
  const reset = useResetBoardMutation(factoryId, WORK_BOARD);
  const skills = (useFactorySkillsQuery(factoryId).data?.skills ?? []).map(skill => skill.name);
  const id = useId();
  const readOnly = !canEdit || !board.editable;
  const changed = JSON.stringify(draft) !== JSON.stringify({ name: board.name, phases: board.phases });
  const blocked = Object.keys(ruleProblems).length > 0;
  const error = save.error ?? reset.error;
  const stale = error?.code === 'revision_mismatch';
  const pending = save.isPending || reset.isPending;
  // Only the read-only Review board has no revision, and it can't be saved or reset.
  const revision = board.revision ?? 0;

  const setPhase = (phase: StoredPhaseInfo) =>
    setDraft(current => ({ ...current, phases: current.phases.map(p => (p.key === phase.key ? phase : p)) }));
  const setRuleProblem = (key: string, field: string, problem: string | undefined) =>
    setRuleProblems(current => {
      const { [`${key}.${field}`]: _previous, ...rest } = current;
      return problem ? { ...rest, [`${key}.${field}`]: problem } : rest;
    });

  return (
    <div className="flex flex-col gap-4">
      {readOnly && (
        <Notice variant="info">
          {board.editable
            ? 'Only organization admins can edit the Work board.'
            : 'This board is defined in code and is read-only.'}
        </Notice>
      )}
      {board.problems.map(problem => (
        <Notice key={problem} variant="warning">
          {problem}
        </Notice>
      ))}
      <div className="flex flex-wrap items-end gap-4">
        <Field className="min-w-60 flex-1">
          <FieldLabel htmlFor={`${id}-board-name`}>Board name</FieldLabel>
          <Input
            id={`${id}-board-name`}
            value={draft.name}
            disabled={readOnly}
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
          />
        </Field>
        <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
          Revision {board.revision}
        </Txt>
      </div>
      <div className="flex flex-col gap-3">
        {draft.phases.map(phase => (
          <PhaseEditor
            key={phase.key}
            phase={phase}
            phases={draft.phases}
            code={board.codeBehaviour?.[phase.key]}
            skills={skills}
            disabled={readOnly || pending}
            onChange={setPhase}
            onRuleProblem={(field, problem) => setRuleProblem(phase.key, field, problem)}
          />
        ))}
      </div>
      {stale && (
        <Notice
          variant="warning"
          title="Someone else changed this board"
          action={
            <Button size="sm" onClick={onReload}>
              Reload
            </Button>
          }
        >
          It changed since you opened it, so your edit was not saved. Reload to see the latest version, then edit it
          again.
        </Notice>
      )}
      {error && !stale && (
        <Notice variant="destructive" role="alert" title="The board was not saved">
          <span className="whitespace-pre-wrap">{errorText(error)}</span>
        </Notice>
      )}
      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button
            disabled={pending}
            onClick={() => {
              save.reset();
              reset.mutate(revision);
            }}
          >
            Reset to default
          </Button>
          <Button
            variant="primary"
            disabled={!changed || blocked || pending || instructionsTooLong(draft)}
            onClick={() => {
              reset.reset();
              save.mutate({ name: draft.name, phases: draft.phases, expectedRevision: revision });
            }}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function instructionsTooLong(draft: Draft): boolean {
  return draft.phases.some(
    phase =>
      (phase.runner?.instructions?.length ?? 0) > MAX_INSTRUCTIONS ||
      (phase.runner?.goal?.objective.length ?? 0) > MAX_OBJECTIVE,
  );
}

/**
 * The project's Work board as stored: each phase's name, runner (skill, context, instructions,
 * goal), automation, exit tool, Factory tools and next phases. Organization admins edit it or reset it to Factory's default; the moves the
 * board's code makes stay checked.
 */
export function WorkBoardSection({ factoryId }: { factoryId?: string }) {
  const query = useBoardQuery(factoryId, WORK_BOARD);
  const data = query.data;

  return (
    <SettingsSubsection
      scope="factory"
      title="Work board"
      description="How cards move through this Factory's Work board: when each phase starts on its own, what its agent is told, when its plan is approved without a person, and where cards go next. Changes apply to this Factory only."
    >
      {query.isPending && factoryId && (
        <Txt tone="muted" as="p" variant="caption" role="status">
          Loading the Work board…
        </Txt>
      )}
      {!factoryId && <Notice variant="info">Open a Factory to edit its Work board.</Notice>}
      {query.error && <Notice variant="destructive">{query.error.message}</Notice>}
      {factoryId && data && (
        <BoardEditor
          // A new revision (saved, reset or reloaded) starts a fresh draft.
          key={data.board.revision ?? 'code'}
          factoryId={factoryId}
          board={data.board}
          canEdit={data.canEdit ?? false}
          onReload={() => void query.refetch()}
        />
      )}
    </SettingsSubsection>
  );
}
