import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BoardPhaseKind } from '../../board/board-icons';
import { MAX_PHASE_INSTRUCTIONS, MAX_PHASE_OBJECTIVE, phaseGoalRunsValid } from '../../board/phase-run-fields';
import { SidePanel } from '../canvas-frame';
import { LimitCount, PanelRow, PanelSection } from '../panel-parts';
import { PhaseHeader } from './phase-header';
import { PhaseMovesPicker } from './phase-moves-picker';
import { PhaseOutcomesList } from './phase-outcomes-list';
import type { PhaseOutcomesInfo } from './phase-outcomes-list';
import { PhaseRunsPanel } from './phase-runs-panel';
import type { PhaseToolOption } from './phase-runs-panel';
import { PhaseSkill } from './phase-skill';
import type {
  PanelPhase,
  PanelPhaseOutcome,
  PanelPhaseRunner,
  PanelRuleGroup,
  PanelSkill,
  PhaseRuleField,
} from './types';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Switch } from '@/ds/components/Switch';
import { Txt } from '@/ds/components/Txt';
import { IconChevronRightMedium } from '@/ds/icons/central/IconChevronRightMedium';
import { IconDirection1 } from '@/ds/icons/central/IconDirection1';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';
import { IconFlag2 } from '@/ds/icons/central/IconFlag2';
import { IconPlay } from '@/ds/icons/central/IconPlay';
import { IconRobot } from '@/ds/icons/central/IconRobot';
import { IconTarget } from '@/ds/icons/central/IconTarget';
import { TrashIcon } from '@/ds/icons/TrashIcon';
import type { LinkComponent } from '@/ds/types/link-component';

export interface PhaseSettingsPanelProps<Tool extends string> {
  phase: PanelPhase;
  phases: readonly PanelPhase[];
  /** Where cards in this phase may go now. */
  nextPhases: readonly string[];
  /** Moves Factory's code makes from this phase, which stay allowed. */
  requiredNextPhases: readonly string[];
  /** The first phase, or one Factory's code declares: it keeps its kind. */
  kindLocked: boolean;
  /** The factory's skills; undefined until they load, so a skill is never flagged missing early. */
  skills: readonly PanelSkill[] | undefined;
  /** Whether the user may edit the factory's skills, which is separate from editing the board. */
  skillsEditable: boolean;
  /** Where the phase's skill opens. */
  skillHref: string | undefined;
  /** Where the factory's skills are listed. */
  skillsHref: string;
  /** Where a new skill is written; offered only when the user may edit skills. */
  newSkillHref: string;
  /** Where the phase's skill comes from and whether someone changed it. */
  skillBadges: readonly string[];
  /** What the board's rules work out about the phase's outcomes. */
  outcomes: PhaseOutcomesInfo;
  /** The session a phase that names none works in. */
  defaultSession: string;
  /** The Factory tools a phase can grant. */
  phaseTools: readonly PhaseToolOption<Tool>[];
  boardId: string;
  disabled: boolean;
  /** Cards in the phase now; undefined while loading. */
  total: number | undefined;
  /** The condition cells limiting which cards the phase starts on its own. */
  autoStartConditions: ReactNode;
  /** Why Factory would refuse the auto-start conditions; unset while they're fine or a row is half filled. */
  autoStartProblem: string | undefined;
  /** The condition cells limiting which cards the exit tool is approved for. */
  autoApproveConditions: ReactNode;
  /** Why Factory would refuse the auto-approve conditions; unset while they're fine or a row is half filled. */
  autoApproveProblem: string | undefined;
  LinkComponent: LinkComponent;
  onName: (name: string) => void;
  onDescription: (description: string | null) => void;
  onKind: (kind: BoardPhaseKind) => void;
  onAutoStart: (on: boolean) => void;
  /** Merges into the phase's runner. */
  onRunner: (runner: Partial<PanelPhaseRunner>) => void;
  onTools: (tools: Tool[] | null) => void;
  /** The exit tool's id, trimmed; empty takes the exit tool away. */
  onExitTool: (id: string) => void;
  onAutoApprove: (on: boolean) => void;
  onNextPhases: (nextPhases: string[]) => void;
  onOutcomes: (outcomes: PanelPhaseOutcome[] | null) => void;
  /** A rule editor has a half-filled condition row, which holds the save. */
  onUnfinished: (field: PhaseRuleField, unfinished: boolean) => void;
  /** Unset when the phase can't be removed. */
  onRemove?: () => void;
  onClose: () => void;
}

/**
 * One phase's settings in the canvas's side panel, in the order a card meets them: how it starts, what the agent
 * runs, how it ends and where it goes. Instructions, goal, session and tools open in a panel of their own.
 */
export function PhaseSettingsPanel<Tool extends string>({
  phase,
  phases,
  nextPhases,
  requiredNextPhases,
  kindLocked,
  skills,
  skillsEditable,
  skillHref,
  skillsHref,
  newSkillHref,
  skillBadges,
  outcomes,
  defaultSession,
  phaseTools,
  boardId,
  disabled,
  total,
  autoStartConditions,
  autoStartProblem,
  autoApproveConditions,
  autoApproveProblem,
  LinkComponent,
  onName,
  onDescription,
  onKind,
  onAutoStart,
  onRunner,
  onTools,
  onExitTool,
  onAutoApprove,
  onNextPhases,
  onOutcomes,
  onUnfinished,
  onRemove,
  onClose,
}: PhaseSettingsPanelProps<Tool>) {
  const [runsOpen, setRunsOpen] = useState(false);
  const working = phase.kind === 'working';
  const exitToolId = phase.exitTool?.id ?? '';
  const instructions = phase.runner?.instructions ?? '';
  const goal = phase.runner?.goal;

  if (working && runsOpen) {
    return (
      <SidePanel label={`${phase.name} agent runs`}>
        <PhaseRunsPanel
          phase={phase}
          phases={phases}
          boardId={boardId}
          defaultSession={defaultSession}
          phaseTools={phaseTools}
          disabled={disabled}
          onRunner={onRunner}
          onTools={onTools}
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
        onName={onName}
        onDescription={onDescription}
        onKind={kind => {
          // The rules belong to the old kind, so their half-filled conditions go too.
          onUnfinished('autoStartWhen', false);
          onUnfinished('autoApproveWhen', false);
          onKind(kind);
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
                  onAutoStart(checked);
                  if (!checked) onUnfinished('autoStartWhen', false);
                }}
              />
            </PanelRow>
            {phase.autoStart && (
              <OnlyWhen
                key={`${phase.key}.autoStartWhen`}
                rule={phase.autoStartWhen}
                problem={autoStartProblem}
                disabled={disabled}
              >
                {autoStartConditions}
              </OnlyWhen>
            )}
          </PanelSection>

          <PanelSection icon={<IconRobot />} title="Agent runs">
            <PhaseSkill
              phaseName={phase.name}
              skillName={phase.runner?.skill}
              skills={skills}
              skillsEditable={skillsEditable}
              skillHref={skillHref}
              skillsHref={skillsHref}
              newSkillHref={newSkillHref}
              badges={skillBadges}
              disabled={disabled}
              LinkComponent={LinkComponent}
              onChange={skill => onRunner({ skill })}
            />
            <button
              type="button"
              onClick={() => setRunsOpen(true)}
              className="flex min-h-6 items-center justify-between gap-1.5 text-left text-muted-foreground hover:text-foreground"
            >
              <Txt as="span" variant="caption">
                Instructions, goal, session, tools
              </Txt>
              {runProblems.length > 0 && (
                <>
                  <IconExclamationTriangle aria-hidden className="ml-auto size-icon-xs text-warning-foreground" />
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
                  onExitTool(value);
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
                      onAutoApprove(checked);
                      if (!checked) onUnfinished('autoApproveWhen', false);
                    }}
                  />
                </PanelRow>
                {phase.exitTool?.autoApprove && (
                  <OnlyWhen
                    key={`${phase.key}.autoApproveWhen`}
                    rule={phase.exitTool.autoApproveWhen}
                    problem={autoApproveProblem}
                    disabled={disabled}
                  >
                    {autoApproveConditions}
                  </OnlyWhen>
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
          next={nextPhases}
          required={requiredNextPhases}
          boardId={boardId}
          disabled={disabled}
          onChange={onNextPhases}
        />
      </PanelSection>

      {working && (
        <PanelSection icon={<IconTarget />} title="Outcomes">
          <PhaseOutcomesList
            phase={phase}
            phases={phases}
            next={nextPhases}
            info={outcomes}
            disabled={disabled}
            onChange={onOutcomes}
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

/**
 * "Only when", a rule's condition cells and why Factory would refuse them. View-only it shows only a rule that has
 * conditions.
 */
function OnlyWhen({
  rule,
  problem,
  disabled,
  children,
}: {
  rule: PanelRuleGroup | null | undefined;
  problem: string | undefined;
  disabled: boolean;
  /** The rule's condition cells. */
  children: ReactNode;
}) {
  if (disabled && !rule?.conditions.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Txt as="span" variant="caption" tone="muted">
        Only when
      </Txt>
      {children}
      {problem && (
        <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
          {problem}
        </Txt>
      )}
    </div>
  );
}
