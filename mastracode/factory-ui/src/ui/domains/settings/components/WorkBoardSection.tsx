import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RuleBuilder } from '@mastra/playground-ui/components/RuleBuilder';
import type { RuleBuilderProps } from '@mastra/playground-ui/components/RuleBuilder';
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
import { SettingsSubsection } from './SettingsSubsection';

const WORK_BOARD = 'work';
const MAX_INSTRUCTIONS = 1000;
const NO_SKILL = '__none__';

type CardRule = NonNullable<StoredPhaseInfo['autoStartWhen']>;
type CodeBehaviour = NonNullable<StoredBoardInfo['codeBehaviour']>[string];

/** The card facts a phase rule can test (`CARD_RULE_FIELDS`), as the rule builder's field tree. */
const CARD_FACTS: RuleBuilderProps['schema'] = {
  type: 'object',
  properties: {
    item: {
      type: 'object',
      title: 'Card',
      properties: {
        labels: { type: 'string', title: 'Labels' },
        title: { type: 'string', title: 'Title' },
        author: { type: 'string', title: 'Author' },
      },
    },
    author: { type: 'object', title: 'Author', properties: { trusted: { type: 'boolean', title: 'Trusted' } } },
    source: {
      type: 'object',
      title: 'Source',
      properties: {
        kind: { type: 'string', title: 'Kind' },
        integration: { type: 'string', title: 'Integration' },
      },
    },
  },
};

interface Draft {
  name: string;
  phases: StoredPhaseInfo[];
}

/** Every other phase when `nextPhases` is unset, none from a terminal phase, as the server reads it. */
function nextPhasesOf(phase: StoredPhaseInfo, phases: StoredPhaseInfo[]): string[] {
  if (phase.nextPhases != null) return phase.nextPhases;
  return phase.kind === 'terminal' ? [] : phases.filter(other => other.key !== phase.key).map(other => other.key);
}

type RuleIssue = { path: PropertyKey[]; message: string; code: string; errors?: RuleIssue[][] };

/** Zod issues as `path: message`, following the closest branch of a condition-or-group union. */
function describeIssues(issues: RuleIssue[], prefix: PropertyKey[] = []): string[] {
  return issues.flatMap(issue => {
    const path = [...prefix, ...issue.path];
    if (issue.code === 'invalid_union' && issue.errors?.length) {
      const closest = issue.errors.reduce((best, branch) => (branch.length < best.length ? branch : best));
      return describeIssues(closest, path);
    }
    return [`${path.map(String).join('.') || 'rule'}: ${issue.message}`];
  });
}

/** Why the server would refuse this rule, if it would. */
function validateRule(value: unknown): { rule: CardRule } | { problem: string } {
  const parsed = cardRuleGroupSchema.safeParse(value);
  if (parsed.success) return { rule: parsed.data };
  return { problem: describeIssues(parsed.error.issues).join('; ') };
}

function ruleProblem(rule: CardRule | null | undefined): string | undefined {
  if (rule == null) return undefined;
  const checked = validateRule(rule);
  return 'problem' in checked ? checked.problem : undefined;
}

/**
 * A phase condition, edited with the rule builder or as raw JSON. Unset means "every card".
 * Reports a rule the server would refuse, so the form can hold back the save.
 */
function RuleEditor({
  label,
  description,
  rule,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  rule: CardRule | null | undefined;
  disabled: boolean;
  onChange: (rule: CardRule | null, problem: string | undefined) => void;
}) {
  const [raw, setRaw] = useState<string | undefined>(undefined);
  const [rawProblem, setRawProblem] = useState<string | undefined>(undefined);
  const id = useId();
  const problem = raw === undefined ? ruleProblem(rule) : rawProblem;

  const editRaw = (text: string) => {
    setRaw(text);
    if (text.trim() === '') {
      setRawProblem(undefined);
      onChange(null, undefined);
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      setRawProblem('Not valid JSON.');
      onChange(rule ?? null, 'Not valid JSON.');
      return;
    }
    const checked = validateRule(value);
    if ('problem' in checked) {
      setRawProblem(checked.problem);
      onChange(rule ?? null, checked.problem);
      return;
    }
    setRawProblem(undefined);
    onChange(checked.rule, undefined);
  };

  return (
    <Field invalid={problem !== undefined}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => {
            setRawProblem(undefined);
            if (raw === undefined) {
              setRaw(rule ? JSON.stringify(rule, null, 2) : '');
              return;
            }
            setRaw(undefined);
            // The builder edits the last valid rule, so JSON that never parsed no longer holds the save.
            onChange(rule ?? null, ruleProblem(rule));
          }}
        >
          {raw === undefined ? 'Edit as JSON' : 'Use rule builder'}
        </Button>
      </div>
      <FieldDescription>{description}</FieldDescription>
      {raw !== undefined ? (
        <Textarea
          id={id}
          aria-label={`${label} JSON`}
          value={raw}
          disabled={disabled}
          rows={6}
          onChange={event => editRaw(event.target.value)}
        />
      ) : disabled ? (
        <Txt id={id} as="p" variant="caption" tone="muted">
          {rule ? JSON.stringify(rule) : 'Every card.'}
        </Txt>
      ) : (
        <div id={id}>
          <RuleBuilder
            schema={CARD_FACTS}
            // Factory's rule groups have the builder's shape; the server validates the depth.
            ruleGroup={(rule ?? undefined) as RuleBuilderProps['ruleGroup']}
            onChange={next => {
              const value = (next ?? null) as CardRule | null;
              onChange(value, ruleProblem(value));
            }}
          />
        </div>
      )}
      {problem && <FieldError>{problem}</FieldError>}
    </Field>
  );
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
          {code?.handlers && <Badge>Code behaviour</Badge>}
        </div>
        {code?.handlers && (
          <Txt as="p" variant="caption" tone="muted">
            Factory runs this phase&apos;s work in code, so its runner context, skill and exit tool are fixed, and so
            are the moves code makes from it. Its instructions, automation and other next phases are yours to change.
          </Txt>
        )}
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
                  disabled={disabled || code?.handlers}
                  onValueChange={value => setRunner({ skill: value === NO_SKILL ? undefined : String(value) })}
                >
                  <SelectTrigger id={`${id}-skill`} size="sm" aria-label={`${phase.name} skill`}>
                    {phase.runner?.skill ?? (code?.handlers ? 'Chosen by code' : 'None')}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SKILL}>None</SelectItem>
                    {skills.map(skill => (
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
                  disabled={disabled || code?.handlers}
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
              <FieldDescription>
                {code?.exitToolId
                  ? 'Factory waits for this tool in code, so it stays.'
                  : code?.handlers
                    ? 'Factory moves cards on from this phase in code, without an exit tool.'
                    : 'The tool whose success ends the phase. Leave empty for none.'}
              </FieldDescription>
              <Input
                id={`${id}-exit-tool`}
                value={exitToolId}
                disabled={disabled || code?.exitToolId != null || code?.handlers}
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
                label={`${phase.name}: approve only when`}
                description="Leave empty to approve for every card."
                rule={phase.exitTool.autoApproveWhen}
                disabled={disabled}
                onChange={(rule, problem) => {
                  onChange({
                    ...phase,
                    exitTool: { id: exitToolId, autoApprove: true, autoApproveWhen: rule ?? undefined },
                  });
                  onRuleProblem('autoApproveWhen', problem);
                }}
              />
            )}
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
  return draft.phases.some(phase => (phase.runner?.instructions?.length ?? 0) > MAX_INSTRUCTIONS);
}

/**
 * The project's Work board as stored: its phases' names, automation, runner instructions
 * and next phases. Organization admins edit it or reset it to Factory's default; what the
 * board's code behaviour depends on stays read-only.
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
