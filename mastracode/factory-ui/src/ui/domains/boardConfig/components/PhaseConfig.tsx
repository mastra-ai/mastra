import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { BookOpen, Bot, FileText, Flag, Pencil, Play, Route } from 'lucide-react';
import { useId, useState } from 'react';

import type { FactorySkillInfo, StoredPhaseInfo } from '../../../../api/types';
import { FactorySkillEditorDialog } from '../../settings/components/FactorySkillEditorDialog';
import { SettingsSubsection } from '../../settings/components/SettingsSubsection';
import { MAX_INSTRUCTIONS, nextPhasesOf } from '../boardDraft';
import type { CodeBehaviour } from '../boardDraft';
import { PhaseMoves } from './PhaseMoves';
import { PhaseStep, PhaseSteps } from './PhaseSteps';
import { RuleEditor } from './RuleEditor';
import { codeSkillsOf } from '../codeSkills';

const NO_SKILL = '__none__';
/** Side controls share one width, so their left edges line up down the page. */
const CONTROL_WIDTH = 'sm:w-56 sm:shrink-0';
/** The instructions counter only shows once the limit is near. */
const COUNT_FROM = MAX_INSTRUCTIONS - 200;

export type RuleField = 'autoStartWhen' | 'autoApproveWhen';

/** Runner context a phase gets when it names none. */
const DEFAULT_SESSION = 'work';

/** A setting Factory's code owns, shown as text so it can't be mistaken for a field. */
function LockedValue({ value, none = 'None' }: { value: string; none?: string }) {
  return value ? <span className="text-foreground">{value}</span> : <span>{none}</span>;
}

/** A skill's name with the same status badges as the Skills settings page. */
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
  code,
  skills,
  skillsEditable,
  factoryId,
  boardId,
  disabled,
  onChange,
  onRuleProblem,
}: {
  phase: StoredPhaseInfo;
  phases: StoredPhaseInfo[];
  code: CodeBehaviour | undefined;
  /** The factory's skills; undefined until they load, so a skill is never flagged missing early. */
  skills: FactorySkillInfo[] | undefined;
  /** Whether the user may edit the factory's skills, which is separate from editing the board. */
  skillsEditable: boolean;
  factoryId: string;
  boardId: string;
  disabled: boolean;
  onChange: (phase: StoredPhaseInfo) => void;
  onRuleProblem: (field: RuleField, problem: string | undefined) => void;
}) {
  const working = phase.kind === 'working';
  const byCode = code?.handlers === true;
  const next = nextPhasesOf(phase, phases);
  const required = new Set(code?.requiredNextPhases ?? []);
  const instructions = phase.runner?.instructions ?? '';
  const exitToolId = phase.exitTool?.id ?? '';
  const exitToolLocked = code?.exitToolId != null || byCode;
  const skillName = phase.runner?.skill;
  const skill = skillName ? skills?.find(candidate => candidate.name === skillName) : undefined;
  const skillMissing = skillName !== undefined && skills !== undefined && skill === undefined;
  // Code phases don't store the skill they run; the built-in boards' code picks it per card.
  const codeSkillNames = byCode && skillName === undefined ? codeSkillsOf(boardId, phase.key) : undefined;
  const [openSkill, setOpenSkill] = useState<FactorySkillInfo>();
  const skillsTitleId = useId();
  const skillButton = (target: FactorySkillInfo) => (
    <Button
      key={target.name}
      size="sm"
      icon={skillsEditable ? <Pencil /> : <FileText />}
      aria-label={`${skillsEditable ? 'Edit' : 'View'} ${target.name}`}
      onClick={() => setOpenSkill(target)}
    >
      {skillsEditable ? 'Edit' : 'View'}
    </Button>
  );
  const skillDescription = (target: FactorySkillInfo | undefined) => (target?.error ? undefined : target?.description);
  const skillError = (name: string, target: FactorySkillInfo | undefined) =>
    target?.error
      ? `Agents can't load this skill: ${target.error}`
      : skills !== undefined && target === undefined
        ? working
          ? `This factory has no ${name} skill, so cards entering ${phase.name} fail to start.`
          : `This factory has no ${name} skill, so Factory's code can't run it here.`
        : undefined;
  const codeSkillRows = (names: readonly string[]) =>
    names.map(name => {
      const target = skills?.find(candidate => candidate.name === name);
      return (
        <SettingsRow
          key={name}
          label={<SkillName name={name} skill={target} missing={skills !== undefined && !target} />}
          description={skillDescription(target)}
          errorMsg={skillError(name, target)}
        >
          {target && skillButton(target)}
        </SettingsRow>
      );
    });
  // Resting and terminal phases have no agent, but Factory's code can still run a skill on arrival.
  const arrivalSkillNames = working ? undefined : codeSkillsOf(boardId, phase.key);
  const setRunner = (runner: Partial<NonNullable<StoredPhaseInfo['runner']>>) => {
    const merged = { ...phase.runner, ...runner };
    const cleaned = Object.fromEntries(Object.entries(merged).filter(([, value]) => value != null && value !== ''));
    onChange({ ...phase, runner: Object.keys(cleaned).length > 0 ? cleaned : null });
  };

  const moves = (
    <PhaseMoves
      phase={phase}
      phases={phases}
      next={next}
      required={required}
      boardId={boardId}
      disabled={disabled}
      onChange={nextPhases => onChange({ ...phase, nextPhases })}
    />
  );

  return (
    <div className="flex flex-col gap-8">
      {byCode && (
        <Notice variant="note">
          Factory's code runs {phase.name}, so its locked settings show here but can't change.
        </Notice>
      )}

      {arrivalSkillNames && arrivalSkillNames.length > 0 && (
        <SettingsSubsection
          title="When an issue's card arrives"
          description="Factory's code runs this skill to close the issue."
        >
          <SettingsContainer>{codeSkillRows(arrivalSkillNames)}</SettingsContainer>
        </SettingsSubsection>
      )}

      {!working && <SettingsSubsection title="Allowed moves">{moves}</SettingsSubsection>}

      {working && (
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
                    if (!checked) onRuleProblem('autoStartWhen', undefined);
                  }}
                />
              </SettingsRow>
              {phase.autoStart && (
                <div className="px-4 py-3">
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
                </div>
              )}
            </SettingsContainer>
          </PhaseStep>

          <PhaseStep icon={<Bot />} title="Agent runs">
            <SettingsContainer>
              <SettingsRow
                label="Instructions"
                description={`Added to the agent's prompt when the phase starts.${instructions.length >= COUNT_FROM ? ` ${instructions.length}/${MAX_INSTRUCTIONS}` : ''}`}
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
                label="Session"
                description="Phases with the same session share one agent session per card."
                disabled={disabled}
                viewOnly={byCode}
              >
                {byCode ? (
                  <LockedValue value={phase.runner?.context ?? DEFAULT_SESSION} />
                ) : (
                  <Input
                    size="sm"
                    className={CONTROL_WIDTH}
                    aria-label={`${phase.name} session`}
                    value={phase.runner?.context ?? ''}
                    placeholder={DEFAULT_SESSION}
                    disabled={disabled}
                    onChange={event => setRunner({ context: event.target.value })}
                  />
                )}
              </SettingsRow>
            </SettingsContainer>

            <section aria-labelledby={skillsTitleId} className="flex flex-col gap-2">
              <div className="flex flex-col">
                <Txt as="h3" id={skillsTitleId} variant="label" tone="ink">
                  {(codeSkillNames?.length ?? 0) > 1 ? 'Skills' : 'Skill'}
                </Txt>
                {(codeSkillNames?.length ?? 0) > 1 && (
                  <Txt as="p" variant="caption" tone="muted">
                    Factory's code picks one for each card.
                  </Txt>
                )}
              </div>
              <SettingsContainer>
                {codeSkillNames && codeSkillNames.length > 0 ? (
                  codeSkillRows(codeSkillNames)
                ) : byCode && skillName === undefined ? (
                  <SettingsRow
                    label={<SkillName name="None" />}
                    description={codeSkillNames ? "Factory's code writes the prompt." : "Factory's code picks it."}
                    viewOnly
                  >
                    <span className="sr-only">Set by Factory's code</span>
                  </SettingsRow>
                ) : (
                  <SettingsRow
                    label={<SkillName name={skillName ?? 'None'} skill={skill} missing={skillMissing} />}
                    description={skillDescription(skill)}
                    errorMsg={skillName ? skillError(skillName, skill) : undefined}
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
                      {skill && skillButton(skill)}
                    </div>
                  </SettingsRow>
                )}
              </SettingsContainer>
            </section>
          </PhaseStep>

          <PhaseStep icon={<Flag />} title="Ends">
            <SettingsContainer>
              <SettingsRow
                label="Exit tool"
                description={exitToolLocked ? undefined : 'Ends the phase when it succeeds. Leave empty for none.'}
                disabled={disabled}
                viewOnly={exitToolLocked}
              >
                {exitToolLocked ? (
                  <LockedValue value={exitToolId} />
                ) : (
                  <Input
                    size="sm"
                    className={CONTROL_WIDTH}
                    aria-label={`${phase.name} exit tool`}
                    value={exitToolId}
                    disabled={disabled}
                    onChange={event => {
                      const value = event.target.value.trim();
                      onChange({ ...phase, exitTool: value ? { ...phase.exitTool, id: value } : null });
                      if (!value) onRuleProblem('autoApproveWhen', undefined);
                    }}
                  />
                )}
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
                          id: exitToolId,
                          autoApprove: checked,
                          autoApproveWhen: checked ? phase.exitTool?.autoApproveWhen : undefined,
                        },
                      });
                      if (!checked) onRuleProblem('autoApproveWhen', undefined);
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
                    disabled={disabled}
                    onChange={(rule, problem) => {
                      onChange({
                        ...phase,
                        exitTool: { id: exitToolId, autoApprove: true, autoApproveWhen: rule ?? undefined },
                      });
                      onRuleProblem('autoApproveWhen', problem);
                    }}
                  />
                </div>
              )}
            </SettingsContainer>
          </PhaseStep>

          <PhaseStep icon={<Route />} title="Allowed moves">
            {moves}
          </PhaseStep>
        </PhaseSteps>
      )}

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
