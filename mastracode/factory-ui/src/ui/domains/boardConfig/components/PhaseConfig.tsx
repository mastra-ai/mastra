import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { InputGroupAddon, InputGroupText } from '@mastra/playground-ui/components/InputGroup';
import {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
} from '@mastra/playground-ui/components/InputNumber';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Link } from 'react-router';

import type { FactorySkillInfo, StoredPhaseInfo } from '../../../../api/types';
import { useSourceSuggestions } from '../../../../hooks/useSourceSuggestions';
import { boardSkillPath } from '../boardConfigPaths';
import { RuleEditor } from '../../settings/components/RuleEditor';
import {
  DEFAULT_SESSION,
  MAX_GOAL_RUNS,
  MAX_INSTRUCTIONS,
  MAX_OBJECTIVE,
  PHASE_TOOLS,
  goalRunsValid,
  nextPhasesOf,
  withAutoStart,
} from '../boardDraft';
import type { RuleField } from '../boardDraft';
import { RestingPhaseLayout, WorkingPhaseLayout } from './PhaseConfigLayout';
import { PhaseMoves } from './PhaseMoves';
import { SkillBadges } from './skills/SkillBadges';
import { IconBook } from '@mastra/playground-ui/icons/central/IconBook';
import { IconFileText } from '@mastra/playground-ui/icons/central/IconFileText';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

const NO_SKILL = '__none__';
/** A counter only shows once its limit is near. */
const countNear = (length: number, max: number) => (length >= max - 200 ? ` ${length}/${max}` : '');

/** Markdown written straight into a card, with room to click into while empty. */
function MarkdownEditor({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <CodeEditor
      aria-label={label}
      value={value}
      placeholder={placeholder}
      editable={!disabled}
      onChange={onChange}
      language="markdown"
      font="body"
      variant="inline"
      lineNumbers={false}
      showCopyButton={false}
    />
  );
}

/** One phase's settings, in the order a card meets them: how it starts, what the agent runs, how it ends and where it goes. */
export function PhaseConfig({
  phase,
  phases,
  requiredNextPhases,
  skills,
  skillsEditable,
  factoryId,
  boardId,
  disabled,
  rawRules,
  onChange,
  onRawRule,
  onUnfinished,
  onRemove,
}: {
  phase: StoredPhaseInfo;
  phases: StoredPhaseInfo[];
  /** Moves Factory's code makes from this phase, which stay allowed. */
  requiredNextPhases: readonly string[];
  /** The factory's skills; undefined until they load, so a skill is never flagged missing early. */
  skills: FactorySkillInfo[] | undefined;
  /** Whether the user may edit the factory's skills, which is separate from editing the board. */
  skillsEditable: boolean;
  factoryId: string;
  boardId: string;
  disabled: boolean;
  /** JSON typed for this phase's rules, by field. */
  rawRules: Partial<Record<RuleField, string>>;
  onChange: (phase: StoredPhaseInfo) => void;
  onRawRule: (field: RuleField, text: string | undefined) => void;
  /** A rule editor has a half-filled condition row, which holds the save. */
  onUnfinished: (field: RuleField, unfinished: boolean) => void;
  /** Unset when the phase can't be removed. */
  onRemove?: () => void;
}) {
  const sources = useSourceSuggestions(factoryId);
  const working = phase.kind === 'working';
  const next = nextPhasesOf(phase, phases);
  const instructions = phase.runner?.instructions ?? '';
  const goal = phase.runner?.goal;
  const objective = goal?.objective ?? '';
  const tools = phase.tools ?? [];
  const exitToolId = phase.exitTool?.id ?? '';
  const skillName = phase.runner?.skill;
  const skill = skillName ? skills?.find(candidate => candidate.name === skillName) : undefined;
  const skillMissing = skillName !== undefined && skills !== undefined && skill === undefined;

  const setRunner = (runner: Partial<NonNullable<StoredPhaseInfo['runner']>>) => {
    const merged = { ...phase.runner, ...runner };
    const cleaned = Object.fromEntries(Object.entries(merged).filter(([, value]) => value != null && value !== ''));
    onChange({ ...phase, runner: Object.keys(cleaned).length > 0 ? cleaned : null });
  };
  const json = (field: RuleField) => ({
    text: rawRules[field],
    onChange: (text: string | undefined) => onRawRule(field, text),
  });

  const moves = (
    <PhaseMoves
      phase={phase}
      phases={phases}
      next={next}
      required={new Set(requiredNextPhases)}
      boardId={boardId}
      disabled={disabled}
      onChange={nextPhases => onChange({ ...phase, nextPhases })}
    />
  );
  const remove = onRemove && (
    <div>
      <Button variant="ghost" icon={<TrashIcon />} onClick={onRemove}>
        Remove {phase.name}
      </Button>
    </div>
  );

  if (!working) return <RestingPhaseLayout moves={moves} remove={remove} />;

  return (
    <WorkingPhaseLayout
      label={`How ${phase.name} runs`}
      disabled={disabled}
      autoStart={
        <Switch
          aria-label={`${phase.name}: start on its own`}
          checked={phase.autoStart ?? false}
          disabled={disabled}
          onCheckedChange={checked => {
            onChange(withAutoStart(phase, checked));
            if (!checked) onRawRule('autoStartWhen', undefined);
          }}
        />
      }
      autoStartRule={
        phase.autoStart && (
          <div className="px-4 py-3">
            <RuleEditor
              label={`${phase.name}: start only when`}
              description="Leave empty to start every card on its own."
              rule={phase.autoStartWhen}
              schema={cardRuleGroupSchema}
              options={{ 'source.repository': sources }}
              disabled={disabled}
              json={json('autoStartWhen')}
              onUnfinished={unfinished => onUnfinished('autoStartWhen', unfinished)}
              onChange={rule => onChange({ ...phase, autoStartWhen: rule })}
            />
          </div>
        )
      }
      instructions={
        <MarkdownEditor
          label={`${phase.name} instructions`}
          value={instructions}
          placeholder="Tell the agent what to do, in Markdown"
          disabled={disabled}
          onChange={text => setRunner({ instructions: text })}
        />
      }
      instructionsCount={countNear(instructions.length, MAX_INSTRUCTIONS)}
      instructionsError={instructions.length > MAX_INSTRUCTIONS ? 'Too long to save.' : undefined}
      goal={
        <MarkdownEditor
          label={`${phase.name} goal`}
          value={objective}
          placeholder="Describe what done looks like"
          disabled={disabled}
          onChange={text => setRunner({ goal: text.trim() ? { ...goal, objective: text } : undefined })}
        />
      }
      goalCount={countNear(objective.length, MAX_OBJECTIVE)}
      goalError={objective.length > MAX_OBJECTIVE ? 'Too long to save.' : undefined}
      goalRuns={
        goal && (
          <Field invalid={!goalRunsValid(goal.maxRuns)} disabled={disabled}>
            <div className="flex items-center gap-3">
              <FieldLabel
                info={`After this many runs without meeting the goal, the card waits for a person. From 1 to ${MAX_GOAL_RUNS}; leave empty for Factory's default.`}
              >
                Pause goal after
              </FieldLabel>
              <InputNumber
                className="w-36"
                min={1}
                max={MAX_GOAL_RUNS}
                allowOutOfRange
                value={goal.maxRuns ?? null}
                disabled={disabled}
                onValueChange={runs => {
                  const { maxRuns: _maxRuns, ...rest } = goal;
                  setRunner({ goal: runs === null ? rest : { ...rest, maxRuns: runs } });
                }}
              >
                <InputNumberGroup size="sm">
                  <InputNumberInput placeholder="Default" />
                  <InputGroupAddon align="inline-end" variant="flush">
                    <InputGroupText className="mr-1">runs</InputGroupText>
                    <InputNumberDecrement />
                    <InputNumberIncrement />
                  </InputGroupAddon>
                </InputNumberGroup>
              </InputNumber>
            </div>
            {!goalRunsValid(goal.maxRuns) && <FieldError>Use a whole number from 1 to {MAX_GOAL_RUNS}.</FieldError>}
          </Field>
        )
      }
      session={
        <Input
          aria-label={`${phase.name} session`}
          value={phase.runner?.context ?? ''}
          placeholder={DEFAULT_SESSION}
          disabled={disabled}
          onChange={event => setRunner({ context: event.target.value })}
        />
      }
      skill={
        <>
          <div className="flex min-w-0 items-center gap-2">
            <Select
              value={skillName ?? NO_SKILL}
              disabled={disabled}
              onValueChange={value => setRunner({ skill: value === NO_SKILL ? undefined : String(value) })}
            >
              <SelectTrigger variant="ghost" size="sm" aria-label={`${phase.name} skill`} className="-ml-2 w-fit">
                <span className="flex min-w-0 items-center gap-2">
                  <IconBook aria-hidden className="text-muted-foreground size-icon-md shrink-0" />
                  <span className="truncate">{skillName ?? 'No skill'}</span>
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SKILL}>None</SelectItem>
                {(skills ?? []).map(candidate => (
                  <SelectItem key={candidate.name} value={candidate.name}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {skillMissing && <Badge variant="destructive">Not found</Badge>}
            {skill?.error && <Badge variant="destructive">Failed to load</Badge>}
            {skill && <SkillBadges skill={skill} />}
            {skill && (
              <Button
                size="sm"
                variant="ghost"
                icon={skillsEditable ? <IconPencil /> : <IconFileText />}
                aria-label={`${skillsEditable ? 'Edit' : 'View'} ${skill.name}`}
                className="ml-auto"
                render={<Link to={boardSkillPath(factoryId, boardId, skill.name)} />}
              >
                {skillsEditable ? 'Edit' : 'View'}
              </Button>
            )}
          </div>
          {skill?.error ? (
            <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
              Agents can't load this skill: {skill.error}
            </Txt>
          ) : skillMissing ? (
            <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
              This factory has no {skillName} skill, so cards entering {phase.name} fail to start.
            </Txt>
          ) : (
            skill?.description && (
              <Txt as="p" variant="caption" tone="muted">
                {skill.description}
              </Txt>
            )
          )}
        </>
      }
      toolSwitch={tool => (
        <Switch
          aria-label={`${phase.name}: ${tool.label}`}
          checked={tools.includes(tool.id)}
          disabled={disabled}
          onCheckedChange={checked => {
            const chosen = PHASE_TOOLS.map(({ id }) => id).filter(id =>
              id === tool.id ? checked : tools.includes(id),
            );
            onChange({ ...phase, tools: chosen.length > 0 ? chosen : null });
          }}
        />
      )}
      exitTool={
        <Input
          aria-label={`${phase.name} exit tool`}
          value={exitToolId}
          disabled={disabled}
          onChange={event => {
            const value = event.target.value.trim();
            onChange({ ...phase, exitTool: value ? { ...phase.exitTool, id: value } : null });
            if (!value) onRawRule('autoApproveWhen', undefined);
          }}
        />
      }
      exitApproval={
        exitToolId !== '' && (
          <SettingsContainer>
            <SettingsRow label="Approve on its own" disabled={disabled}>
              <Switch
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
                  if (!checked) onRawRule('autoApproveWhen', undefined);
                }}
              />
            </SettingsRow>
            {phase.exitTool?.autoApprove && (
              <div className="px-4 py-3">
                <RuleEditor
                  label={`${phase.name}: approve only when`}
                  description="Leave empty to approve for every card."
                  rule={phase.exitTool.autoApproveWhen}
                  schema={cardRuleGroupSchema}
                  options={{ 'source.repository': sources }}
                  disabled={disabled}
                  json={json('autoApproveWhen')}
                  onUnfinished={unfinished => onUnfinished('autoApproveWhen', unfinished)}
                  onChange={rule =>
                    onChange({
                      ...phase,
                      exitTool: {
                        ...phase.exitTool,
                        id: exitToolId,
                        autoApprove: true,
                        autoApproveWhen: rule ?? undefined,
                      },
                    })
                  }
                />
              </div>
            )}
          </SettingsContainer>
        )
      }
      moves={moves}
      remove={remove}
    />
  );
}
