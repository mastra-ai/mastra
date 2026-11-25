import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { PhaseField, PhaseRunFields } from '@mastra/playground-ui/domains/factory';
import { Link } from 'react-router';

import type { FactorySkillInfo, StoredPhaseInfo } from '../../../../api/types';
import { useSourceSuggestions } from '../../../../hooks/useSourceSuggestions';
import { boardSkillPath } from '../boardConfigPaths';
import { RuleEditor } from '../../settings/components/RuleEditor';
import { SettingsSubsection } from '../../settings/components/SettingsSubsection';
import {
  DEFAULT_SESSION,
  PHASE_TOOLS,
  nextPhasesOf,
  withAutoStart,
} from '../boardDraft';
import type { RuleField } from '../boardDraft';
import { PhaseMoves } from './PhaseMoves';
import { PhaseStep, PhaseSteps } from './PhaseSteps';
import { SkillBadges } from './skills/SkillBadges';
import { IconBook } from '@mastra/playground-ui/icons/central/IconBook';
import { IconDirection1 } from '@mastra/playground-ui/icons/central/IconDirection1';
import { IconFileText } from '@mastra/playground-ui/icons/central/IconFileText';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { IconPlay } from '@mastra/playground-ui/icons/central/IconPlay';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { IconFlag2 } from '@mastra/playground-ui/icons/central/IconFlag2';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

const NO_SKILL = '__none__';
/** Free-text fields share one width, so short values don't stretch across the page. */
const FIELD_WIDTH = 'sm:max-w-xs';
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
        <PhaseStep icon={<IconPlay />} title="Starts">
          <SettingsContainer>
            <SettingsRow label="Start on its own" disabled={disabled}>
              <Switch
                aria-label={`${phase.name}: start on its own`}
                checked={phase.autoStart ?? false}
                disabled={disabled}
                onCheckedChange={checked => {
                  onChange(withAutoStart(phase, checked));
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
                  options={{ 'source.repository': sources }}
                  disabled={disabled}
                  json={json('autoStartWhen')}
                  onUnfinished={unfinished => onUnfinished('autoStartWhen', unfinished)}
                  onChange={rule => onChange({ ...phase, autoStartWhen: rule })}
                />
              </div>
            )}
          </SettingsContainer>
        </PhaseStep>

        <PhaseStep icon={<IconRobot />} title="Agent runs">
          <PhaseRunFields
            phaseName={phase.name}
            instructions={instructions}
            goal={goal}
            disabled={disabled}
            onInstructionsChange={text => setRunner({ instructions: text })}
            onGoalChange={next => setRunner({ goal: next })}
          />

          <PhaseField
            title="Session"
            description="Phases with the same session share one agent session per card."
            disabled={disabled}
          >
            <Input
              className={FIELD_WIDTH}
              aria-label={`${phase.name} session`}
              value={phase.runner?.context ?? ''}
              placeholder={DEFAULT_SESSION}
              disabled={disabled}
              onChange={event => setRunner({ context: event.target.value })}
            />
          </PhaseField>

          <SettingsSubsection title="Skill">
            <SettingsContainer>
              <div className="flex flex-col gap-1 px-4 py-3">
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
              </div>
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

        <PhaseStep icon={<IconFlag2 />} title="Ends">
          <PhaseField
            title="Exit tool"
            description="Ends the phase when it succeeds. Leave empty for none."
            disabled={disabled}
          >
            <Input
              className={FIELD_WIDTH}
              aria-label={`${phase.name} exit tool`}
              value={exitToolId}
              disabled={disabled}
              onChange={event => {
                const value = event.target.value.trim();
                onChange({ ...phase, exitTool: value ? { ...phase.exitTool, id: value } : null });
                if (!value) onRawRule('autoApproveWhen', undefined);
              }}
            />
          </PhaseField>
          {exitToolId !== '' && (
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
          )}
        </PhaseStep>

        <PhaseStep icon={<IconDirection1 />} title="Allowed moves">
          {moves}
        </PhaseStep>
      </PhaseSteps>

      {remove}
    </div>
  );
}
