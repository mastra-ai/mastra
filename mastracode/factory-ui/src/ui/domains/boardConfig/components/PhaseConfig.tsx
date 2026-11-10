import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { BookOpen, Bot, FileText, Flag, Pencil, Play, Route, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { FactorySkillInfo, StoredPhaseInfo } from '../../../../api/types';
import { FactorySkillEditorDialog } from '../../settings/components/FactorySkillEditorDialog';
import { RuleEditor } from '../../settings/components/RuleEditor';
import { SettingsSubsection } from '../../settings/components/SettingsSubsection';
import {
  MAX_GOAL_RUNS,
  MAX_INSTRUCTIONS,
  MAX_OBJECTIVE,
  PHASE_TOOLS,
  goalRunsValid,
  nextPhasesOf,
} from '../boardDraft';
import type { RuleField } from '../boardDraft';
import { PhaseMoves } from './PhaseMoves';
import { PhaseStep, PhaseSteps } from './PhaseSteps';

const NO_SKILL = '__none__';
/** Side controls share one width, so their left edges line up down the page. */
const CONTROL_WIDTH = 'sm:w-56 sm:shrink-0';
/** A counter only shows once its limit is near. */
const countNear = (length: number, max: number) => (length >= max - 200 ? ` ${length}/${max}` : '');

/** Runner context a phase gets when it names none. */
const DEFAULT_SESSION = 'work';

/** A skill's name with the same status badges as the Skills page. */
function SkillName({ name, skill, missing = false }: { name: string; skill?: FactorySkillInfo; missing?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <BookOpen aria-hidden className="text-muted-foreground size-4 shrink-0" />
      {name}
      {missing && <Badge variant="destructive">Not found</Badge>}
      {skill?.error && <Badge variant="destructive">Failed to load</Badge>}
      {skill?.builtIn && skill.origin !== undefined && skill.origin !== 'bundled' && <Badge>Overridden by app</Badge>}
      {skill?.edited && <Badge>Edited</Badge>}
    </span>
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
  /** Unset when the phase can't be removed. */
  onRemove?: () => void;
}) {
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
  const [openSkill, setOpenSkill] = useState<FactorySkillInfo>();

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
      <Button variant="ghost" icon={<Trash2 />} onClick={onRemove}>
        Remove {phase.name}
      </Button>
    </div>
  );

  if (!working) {
    return (
      <div className="flex flex-col gap-8">
        <SettingsSubsection title="Allowed moves">{moves}</SettingsSubsection>
        {remove}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PhaseSteps label={`How ${phase.name} runs`}>
        <PhaseStep icon={<Play />} title="Starts">
          <SettingsContainer>
            <SettingsRow label="Start on its own" disabled={disabled}>
              <Switch
                aria-label={`${phase.name}: start on its own`}
                checked={phase.autoStart ?? false}
                disabled={disabled}
                onCheckedChange={checked => {
                  onChange({ ...phase, autoStart: checked, autoStartWhen: checked ? phase.autoStartWhen : null });
                  if (!checked) onRawRule('autoStartWhen', undefined);
                }}
              />
            </SettingsRow>
            {phase.autoStart && (
              <div className="px-4 py-3">
                <RuleEditor
                  label={`${phase.name}: start only when`}
                  description="Leave empty to start every card on its own."
                  rule={phase.autoStartWhen}
                  schema={cardRuleGroupSchema}
                  disabled={disabled}
                  json={json('autoStartWhen')}
                  onChange={rule => onChange({ ...phase, autoStartWhen: rule })}
                />
              </div>
            )}
          </SettingsContainer>
        </PhaseStep>

        <PhaseStep icon={<Bot />} title="Agent runs">
          <SettingsContainer>
            <SettingsRow
              label="Instructions"
              description={`Added to the agent's prompt when the phase starts.${countNear(instructions.length, MAX_INSTRUCTIONS)}`}
              errorMsg={instructions.length > MAX_INSTRUCTIONS ? 'Too long to save.' : undefined}
              disabled={disabled}
              className="sm:flex-col sm:items-stretch"
            >
              <Textarea
                aria-label={`${phase.name} instructions`}
                value={instructions}
                maxLength={MAX_INSTRUCTIONS}
                rows={4}
                disabled={disabled}
                onChange={event => setRunner({ instructions: event.target.value })}
              />
            </SettingsRow>
            <SettingsRow
              label="Goal"
              description={`The agent keeps working until a judge finds this objective met. Leave empty for a single run.${countNear(objective.length, MAX_OBJECTIVE)}`}
              errorMsg={objective.length > MAX_OBJECTIVE ? 'Too long to save.' : undefined}
              disabled={disabled}
              className="sm:flex-col sm:items-stretch"
            >
              <Textarea
                aria-label={`${phase.name} goal`}
                value={objective}
                maxLength={MAX_OBJECTIVE}
                rows={4}
                disabled={disabled}
                onChange={event => {
                  const text = event.target.value;
                  setRunner({ goal: text.trim() ? { ...goal, objective: text } : undefined });
                }}
              />
            </SettingsRow>
            {goal && (
              <SettingsRow
                label="Goal runs"
                description={`Runs before the goal pauses for a person, from 1 to ${MAX_GOAL_RUNS}. Leave empty for Factory's default.`}
                errorMsg={goalRunsValid(goal.maxRuns) ? undefined : `Use a whole number from 1 to ${MAX_GOAL_RUNS}.`}
                disabled={disabled}
              >
                <Input
                  size="sm"
                  type="number"
                  min={1}
                  max={MAX_GOAL_RUNS}
                  className={CONTROL_WIDTH}
                  aria-label={`${phase.name} goal runs`}
                  value={goal.maxRuns ?? ''}
                  disabled={disabled}
                  onChange={event => {
                    const runs = Number.parseInt(event.target.value, 10);
                    const { maxRuns: _maxRuns, ...rest } = goal;
                    setRunner({ goal: Number.isInteger(runs) ? { ...rest, maxRuns: runs } : rest });
                  }}
                />
              </SettingsRow>
            )}
            <SettingsRow
              label="Session"
              description="Phases with the same session share one agent session per card."
              disabled={disabled}
            >
              <Input
                size="sm"
                className={CONTROL_WIDTH}
                aria-label={`${phase.name} session`}
                value={phase.runner?.context ?? ''}
                placeholder={DEFAULT_SESSION}
                disabled={disabled}
                onChange={event => setRunner({ context: event.target.value })}
              />
            </SettingsRow>
          </SettingsContainer>

          <SettingsSubsection title="Skill">
            <SettingsContainer>
              <SettingsRow
                label={<SkillName name={skillName ?? 'None'} skill={skill} missing={skillMissing} />}
                description={skill?.error ? undefined : skill?.description}
                errorMsg={
                  skill?.error
                    ? `Agents can't load this skill: ${skill.error}`
                    : skillMissing
                      ? `This factory has no ${skillName} skill, so cards entering ${phase.name} fail to start.`
                      : undefined
                }
                disabled={disabled}
              >
                <div className="flex items-center gap-2">
                  <Select
                    value={skillName ?? NO_SKILL}
                    disabled={disabled}
                    onValueChange={value => setRunner({ skill: value === NO_SKILL ? undefined : String(value) })}
                  >
                    <SelectTrigger size="sm" aria-label={`${phase.name} skill`}>
                      Change
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
                  {skill && (
                    <Button
                      size="sm"
                      icon={skillsEditable ? <Pencil /> : <FileText />}
                      aria-label={`${skillsEditable ? 'Edit' : 'View'} ${skill.name}`}
                      onClick={() => setOpenSkill(skill)}
                    >
                      {skillsEditable ? 'Edit' : 'View'}
                    </Button>
                  )}
                </div>
              </SettingsRow>
            </SettingsContainer>
          </SettingsSubsection>

          <SettingsSubsection
            title="Factory tools"
            description="Given to the session that works the card in this phase."
          >
            <SettingsContainer>
              {PHASE_TOOLS.map(tool => (
                <SettingsRow key={tool.id} label={tool.label} disabled={disabled}>
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
                </SettingsRow>
              ))}
            </SettingsContainer>
          </SettingsSubsection>
        </PhaseStep>

        <PhaseStep icon={<Flag />} title="Ends">
          <SettingsContainer>
            <SettingsRow
              label="Exit tool"
              description="Ends the phase when it succeeds. Leave empty for none."
              disabled={disabled}
            >
              <Input
                size="sm"
                className={CONTROL_WIDTH}
                aria-label={`${phase.name} exit tool`}
                value={exitToolId}
                disabled={disabled}
                onChange={event => {
                  const value = event.target.value.trim();
                  onChange({ ...phase, exitTool: value ? { ...phase.exitTool, id: value } : null });
                  if (!value) onRawRule('autoApproveWhen', undefined);
                }}
              />
            </SettingsRow>
            {exitToolId !== '' && (
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
            )}
            {exitToolId !== '' && phase.exitTool?.autoApprove && (
              <div className="px-4 py-3">
                <RuleEditor
                  label={`${phase.name}: approve only when`}
                  description="Leave empty to approve for every card."
                  rule={phase.exitTool.autoApproveWhen}
                  schema={cardRuleGroupSchema}
                  disabled={disabled}
                  json={json('autoApproveWhen')}
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
        </PhaseStep>

        <PhaseStep icon={<Route />} title="Allowed moves">
          {moves}
        </PhaseStep>
      </PhaseSteps>

      {remove}

      {openSkill && (
        <FactorySkillEditorDialog
          skill={openSkill}
          factoryId={factoryId}
          canEdit={skillsEditable}
          onClose={() => setOpenSkill(undefined)}
        />
      )}
    </div>
  );
}
