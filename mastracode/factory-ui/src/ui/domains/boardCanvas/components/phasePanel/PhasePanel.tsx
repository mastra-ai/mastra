import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import { Button } from '@mastra/playground-ui/components/Button';
import type { FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import { Input } from '@mastra/playground-ui/components/Input';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MAX_PHASE_INSTRUCTIONS, MAX_PHASE_OBJECTIVE, phaseGoalRunsValid } from '@mastra/playground-ui/domains/factory';
import { IconChevronRightMedium } from '@mastra/playground-ui/icons/central/IconChevronRightMedium';
import { IconDirection1 } from '@mastra/playground-ui/icons/central/IconDirection1';
import { IconExclamationTriangle } from '@mastra/playground-ui/icons/central/IconExclamationTriangle';
import { IconFlag2 } from '@mastra/playground-ui/icons/central/IconFlag2';
import { IconPlay } from '@mastra/playground-ui/icons/central/IconPlay';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { IconTarget } from '@mastra/playground-ui/icons/central/IconTarget';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { useState } from 'react';

import type { FactorySkillInfo, StoredPhaseInfo } from '../../../../../api/types';
import { useSourceSuggestions } from '../../../../../hooks/useSourceSuggestions';
import { withAutoStart, withKind, withNextPhases } from '../../../boardConfig/boardDraft';
import type { RuleField } from '../../../boardConfig/boardDraft';
import { CARD_FACTS } from '../../../settings/components/conditionFields';
import { ConditionCells } from '../conditions/ConditionCells';
import { SidePanel } from '../CanvasChrome';
import { LimitCount, PanelRow, PanelSection } from './panelParts';
import { PhaseHeader } from './PhaseHeader';
import { PhaseMovesPicker } from './PhaseMovesPicker';
import { PhaseOutcomesList } from './PhaseOutcomesList';
import { PhaseRunsPanel } from './PhaseRunsPanel';
import { PhaseSkill } from './PhaseSkill';

type Runner = NonNullable<StoredPhaseInfo['runner']>;

/**
 * One phase's settings in the canvas's side panel, in the order a card meets them: how it starts, what the agent
 * runs, how it ends and where it goes. Instructions, goal, session and tools open in a panel of their own.
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
  skills: FactorySkillInfo[] | undefined;
  /** Whether the user may edit the factory's skills, which is separate from editing the board. */
  skillsEditable: boolean;
  factoryId: string;
  boardId: string;
  disabled: boolean;
  /** Cards in the phase now; undefined while loading. */
  total: number | undefined;
  onChange: (phase: StoredPhaseInfo) => void;
  /** A rule editor has a half-filled condition row, which holds the save. */
  onUnfinished: (field: RuleField, unfinished: boolean) => void;
  /** Unset when the phase can't be removed. */
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [runsOpen, setRunsOpen] = useState(false);
  const sources = useSourceSuggestions(factoryId);
  const working = phase.kind === 'working';
  const exitToolId = phase.exitTool?.id ?? '';
  const instructions = phase.runner?.instructions ?? '';
  const goal = phase.runner?.goal;

  const setRunner = (runner: Partial<Runner>) => {
    const merged = { ...phase.runner, ...runner };
    const cleaned = Object.fromEntries(Object.entries(merged).filter(([, value]) => value != null && value !== ''));
    onChange({ ...phase, runner: Object.keys(cleaned).length > 0 ? cleaned : null });
  };
  const ruleOptions = { 'source.repository': sources };

  if (working && runsOpen) {
    return (
      <SidePanel label={`${phase.name} agent runs`}>
        <PhaseRunsPanel
          phase={phase}
          phases={phases}
          boardId={boardId}
          disabled={disabled}
          onRunner={setRunner}
          onTools={tools => onChange({ ...phase, tools })}
          onBack={() => setRunsOpen(false)}
        />
      </SidePanel>
    );
  }

  const runProblems = [
    instructions.length > MAX_PHASE_INSTRUCTIONS && (
      <PanelRow key="instructions" label="Instructions">
        <LimitCount length={instructions.length} max={MAX_PHASE_INSTRUCTIONS} />
      </PanelRow>
    ),
    (goal?.objective.length ?? 0) > MAX_PHASE_OBJECTIVE && (
      <PanelRow key="goal" label="Goal">
        <LimitCount length={goal?.objective.length ?? 0} max={MAX_PHASE_OBJECTIVE} />
      </PanelRow>
    ),
    !phaseGoalRunsValid(goal?.maxRuns) && (
      <PanelRow key="runs" label="Pause goal after">
        <Txt as="span" variant="caption" className="text-warning-foreground">
          {goal?.maxRuns} runs
        </Txt>
      </PanelRow>
    ),
  ].filter(Boolean);

  return (
    <SidePanel label={phase.name}>
      <PhaseHeader
        phase={phase}
        boardId={boardId}
        total={total}
        readOnly={disabled}
        kindLocked={kindLocked}
        onName={name => onChange({ ...phase, name })}
        onDescription={description => onChange({ ...phase, description })}
        onKind={kind => {
          // The rules belong to the old kind, so their half-filled conditions go too.
          onUnfinished('autoStartWhen', false);
          onUnfinished('autoApproveWhen', false);
          onChange(withKind(phase, kind, phases));
        }}
        onClose={onClose}
      />

      {working && (
        <>
          <PanelSection icon={<IconPlay />} title="Starts">
            <PanelRow label="Start on its own">
              <Switch
                aria-label={`${phase.name}: start on its own`}
                checked={phase.autoStart ?? false}
                disabled={disabled}
                onCheckedChange={checked => {
                  onChange(withAutoStart(phase, checked));
                  if (!checked) onUnfinished('autoStartWhen', false);
                }}
              />
            </PanelRow>
            {phase.autoStart && (
              <OnlyWhen
                key={`${phase.key}.autoStartWhen`}
                rule={phase.autoStartWhen}
                emptyHint="Leave empty to start every card on its own."
                options={ruleOptions}
                disabled={disabled}
                onUnfinished={unfinished => onUnfinished('autoStartWhen', unfinished)}
                onSave={rule => onChange({ ...phase, autoStartWhen: rule })}
              />
            )}
          </PanelSection>

          <PanelSection icon={<IconRobot />} title="Agent runs">
            <PhaseSkill
              phaseName={phase.name}
              skillName={phase.runner?.skill}
              skills={skills}
              skillsEditable={skillsEditable}
              factoryId={factoryId}
              boardId={boardId}
              disabled={disabled}
              onChange={skill => setRunner({ skill })}
            />
            <button
              type="button"
              onClick={() => setRunsOpen(true)}
              className="text-muted-foreground hover:text-foreground flex min-h-6 items-center justify-between gap-1.5 text-left"
            >
              <Txt as="span" variant="caption">
                Instructions, goal, session, tools
              </Txt>
              {runProblems.length > 0 && (
                <>
                  <IconExclamationTriangle aria-hidden className="text-warning-foreground size-icon-xs ml-auto" />
                  <span className="sr-only">(can&apos;t save)</span>
                </>
              )}
              <IconChevronRightMedium aria-hidden className="size-icon-xs shrink-0" />
            </button>
            {runProblems}
          </PanelSection>

          <PanelSection icon={<IconFlag2 />} title="Ends">
            <PanelRow label="Exit tool">
              <Input
                size="sm"
                className="w-32"
                aria-label={`${phase.name} exit tool`}
                value={exitToolId}
                placeholder="None"
                disabled={disabled}
                onChange={event => {
                  const value = event.target.value.trim();
                  onChange({ ...phase, exitTool: value ? { ...phase.exitTool, id: value } : null });
                  if (!value) onUnfinished('autoApproveWhen', false);
                }}
              />
            </PanelRow>
            {exitToolId !== '' && (
              <>
                <PanelRow label="Approve on its own">
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
                      if (!checked) onUnfinished('autoApproveWhen', false);
                    }}
                  />
                </PanelRow>
                {phase.exitTool?.autoApprove && (
                  <OnlyWhen
                    key={`${phase.key}.autoApproveWhen`}
                    rule={phase.exitTool.autoApproveWhen}
                    emptyHint="Leave empty to approve for every card."
                    options={ruleOptions}
                    disabled={disabled}
                    onUnfinished={unfinished => onUnfinished('autoApproveWhen', unfinished)}
                    onSave={rule =>
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
                )}
              </>
            )}
          </PanelSection>
        </>
      )}

      <PanelSection icon={<IconDirection1 />} title="Allowed moves">
        <PhaseMovesPicker
          phase={phase}
          phases={phases}
          required={requiredNextPhases}
          boardId={boardId}
          disabled={disabled}
          onChange={nextPhases => onChange(withNextPhases(phase, nextPhases))}
        />
      </PanelSection>

      {working && (
        <PanelSection icon={<IconTarget />} title="Outcomes">
          <PhaseOutcomesList
            phase={phase}
            phases={phases}
            disabled={disabled}
            onChange={outcomes => onChange({ ...phase, outcomes })}
          />
        </PanelSection>
      )}

      {onRemove && (
        <div>
          <Button size="sm" variant="ghost" icon={<TrashIcon />} onClick={onRemove}>
            Remove {phase.name}
          </Button>
        </div>
      )}
    </SidePanel>
  );
}

/** "Only when" and a rule's condition cells; view-only it shows only a rule that has conditions. */
function OnlyWhen({
  rule,
  emptyHint,
  options,
  disabled,
  onUnfinished,
  onSave,
}: {
  rule: RuleGroup | null | undefined;
  emptyHint: string;
  options: Record<string, FilterBarOption[]>;
  disabled: boolean;
  /** A half-filled condition row, which holds the board's save. */
  onUnfinished: (unfinished: boolean) => void;
  onSave: (rule: RuleGroup | null) => void;
}) {
  if (disabled && !rule?.conditions.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Txt as="span" variant="caption" tone="muted">
        Only when
      </Txt>
      <ConditionCells
        label="Only when"
        rule={rule}
        facts={CARD_FACTS}
        options={options}
        disabled={disabled}
        emptyHint={emptyHint}
        onChange={(next, unfinished) => {
          onUnfinished(unfinished);
          // A half-filled row keeps the last whole rule, so saving never quietly drops a condition.
          if (!unfinished) onSave(next);
        }}
      />
    </div>
  );
}
