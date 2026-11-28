import {
  PhaseSettingsPanel,
  DEFAULT_SESSION,
  MAX_OUTCOMES,
  PHASE_TOOLS,
  cardRuleProblem,
  defaultOutcomes,
  exitToolOutcome,
  newOutcome,
  nextPhasesOf,
  outcomeProblems,
  withAutoStart,
  withKind,
  withNextPhases,
  CARD_FACTS,
} from '..';

import type { StoredPhaseInfo, RuleField } from '..';
import type { BoardSettingsSkill } from './board-settings-host';
import { useBoardSettingsHost } from './board-settings-host';
import { ConditionCells } from './condition-cells';
import { skillBadges } from './skill-badge-labels';

type Runner = NonNullable<StoredPhaseInfo['runner']>;

/**
 * One phase's settings in the canvas's side panel: works out the phase's moves, outcomes, skill and condition cells
 * from the board's rules and turns each edit into the phase's next stored shape.
 */
export function PhasePanel({
  phase,
  phases,
  requiredNextPhases,
  kindLocked,
  skills,
  skillsEditable,
  factoryId,
  boardId,
  disabled,
  total,
  unfinished,
  onChange,
  onUnfinished,
  onRemove,
  onClose,
}: {
  phase: StoredPhaseInfo;
  phases: StoredPhaseInfo[];
  /** Moves Factory's code makes from this phase, which stay allowed. */
  requiredNextPhases: readonly string[];
  /** The first phase, or one Factory's code declares: it keeps its kind. */
  kindLocked: boolean;
  /** The factory's skills; undefined until they load, so a skill is never flagged missing early. */
  skills: BoardSettingsSkill[] | undefined;
  /** Whether the user may edit the factory's skills, which is separate from editing the board. */
  skillsEditable: boolean;
  factoryId: string;
  boardId: string;
  disabled: boolean;
  /** Cards in the phase now; undefined while loading. */
  total: number | undefined;
  /** The rule fields with a half-filled condition row, whose last whole rule isn't judged yet. */
  unfinished: readonly RuleField[];
  onChange: (phase: StoredPhaseInfo) => void;
  /** A rule editor has a half-filled condition row, which holds the save. */
  onUnfinished: (field: RuleField, unfinished: boolean) => void;
  /** Unset when the phase can't be removed. */
  onRemove?: () => void;
  onClose: () => void;
}) {
  const host = useBoardSettingsHost();
  const sources = host.sourceSuggestions;
  const exitToolId = phase.exitTool?.id ?? '';
  const skillName = phase.runner?.skill;
  const skill = skillName ? skills?.find(candidate => candidate.name === skillName) : undefined;
  const own = phase.outcomes?.length ? phase.outcomes : undefined;
  const defaults = defaultOutcomes(phase, phases);

  const setRunner = (runner: Partial<Runner>) => {
    const merged = { ...phase.runner, ...runner };
    const cleaned = Object.fromEntries(Object.entries(merged).filter(([, value]) => value != null && value !== ''));
    onChange({ ...phase, runner: Object.keys(cleaned).length > 0 ? cleaned : null });
  };
  const ruleOptions = { 'source.repository': sources };

  return (
    <PhaseSettingsPanel
      phase={phase}
      phases={phases}
      nextPhases={nextPhasesOf(phase, phases)}
      requiredNextPhases={requiredNextPhases}
      kindLocked={kindLocked}
      skills={skills}
      skillsEditable={skillsEditable}
      skillHref={skillName ? host.skillHref(skillName) : undefined}
      skillsHref={host.skillsHref()}
      newSkillHref={host.newSkillHref()}
      skillBadges={skill ? skillBadges(skill) : []}
      outcomes={{
        defaults,
        problems: own ? outcomeProblems(own) : [],
        added: own ? newOutcome(phase, phases, own) : undefined,
        exitToolPick: exitToolOutcome(own ?? defaults, phases),
        max: MAX_OUTCOMES,
      }}
      defaultSession={DEFAULT_SESSION}
      phaseTools={PHASE_TOOLS}
      boardId={boardId}
      disabled={disabled}
      total={total}
      autoStartConditions={
        <ConditionCells
          label="Only when"
          rule={phase.autoStartWhen}
          facts={CARD_FACTS}
          options={ruleOptions}
          disabled={disabled}
          emptyHint="Leave empty to start every card on its own."
          onChange={(next, unfinished) => {
            onUnfinished('autoStartWhen', unfinished);
            // A half-filled row keeps the last whole rule, so saving never quietly drops a condition.
            if (!unfinished) onChange({ ...phase, autoStartWhen: next });
          }}
        />
      }
      autoStartProblem={unfinished.includes('autoStartWhen') ? undefined : cardRuleProblem(phase.autoStartWhen)}
      autoApproveConditions={
        <ConditionCells
          label="Only when"
          rule={phase.exitTool?.autoApproveWhen}
          facts={CARD_FACTS}
          options={ruleOptions}
          disabled={disabled}
          emptyHint="Leave empty to approve for every card."
          onChange={(next, unfinished) => {
            onUnfinished('autoApproveWhen', unfinished);
            // A half-filled row keeps the last whole rule, so saving never quietly drops a condition.
            if (!unfinished) {
              onChange({
                ...phase,
                exitTool: { ...phase.exitTool, id: exitToolId, autoApprove: true, autoApproveWhen: next ?? undefined },
              });
            }
          }}
        />
      }
      autoApproveProblem={
        unfinished.includes('autoApproveWhen') ? undefined : cardRuleProblem(phase.exitTool?.autoApproveWhen)
      }
      LinkComponent={host.SettingsLinkComponent ?? host.LinkComponent}
      onName={name => onChange({ ...phase, name })}
      onDescription={description => onChange({ ...phase, description })}
      onKind={kind => onChange(withKind(phase, kind, phases))}
      onAutoStart={checked => onChange(withAutoStart(phase, checked))}
      onRunner={setRunner}
      onTools={tools => onChange({ ...phase, tools })}
      onExitTool={value => onChange({ ...phase, exitTool: value ? { ...phase.exitTool, id: value } : null })}
      onAutoApprove={checked =>
        onChange({
          ...phase,
          exitTool: {
            ...phase.exitTool,
            id: exitToolId,
            autoApprove: checked,
            autoApproveWhen: checked ? phase.exitTool?.autoApproveWhen : undefined,
          },
        })
      }
      onNextPhases={nextPhases => onChange(withNextPhases(phase, nextPhases))}
      onOutcomes={outcomes => onChange({ ...phase, outcomes })}
      onUnfinished={onUnfinished}
      onRemove={onRemove}
      onClose={onClose}
    />
  );
}
