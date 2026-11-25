import type { ReactNode } from 'react';

import { CodeEditor } from '@/ds/components/CodeEditor';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/ds/components/Field';
import { InputGroupAddon, InputGroupText } from '@/ds/components/InputGroup';
import {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
} from '@/ds/components/InputNumber';
import { SettingsContainer, SettingsGroup, SettingsTitle } from '@/ds/new/settings';

export const MAX_PHASE_INSTRUCTIONS = 1000;
export const MAX_PHASE_OBJECTIVE = 2000;
export const MAX_PHASE_GOAL_RUNS = 50;

export interface PhaseGoal {
  objective: string;
  maxRuns?: number;
}

// eslint-disable-next-line react-refresh/only-export-components -- helper intentionally co-located with the components that use it
export function phaseGoalRunsValid(maxRuns: number | undefined): boolean {
  return maxRuns === undefined || (Number.isInteger(maxRuns) && maxRuns >= 1 && maxRuns <= MAX_PHASE_GOAL_RUNS);
}

/** Whether a phase's instructions and goal fit what Factory saves. */
// eslint-disable-next-line react-refresh/only-export-components -- helper intentionally co-located with the components that use it
export function phaseRunFieldsValid(instructions: string, goal: PhaseGoal | undefined): boolean {
  return (
    instructions.length <= MAX_PHASE_INSTRUCTIONS &&
    (goal?.objective.length ?? 0) <= MAX_PHASE_OBJECTIVE &&
    phaseGoalRunsValid(goal?.maxRuns)
  );
}

/** A counter only shows once its limit is near. */
const countNear = (length: number, max: number) => (length >= max - 200 ? ` ${length}/${max}` : '');

/**
 * A setting whose heading and help sit above its control, so the control stands alone as the place to type.
 * `after` follows the field in the same section, for a setting that tunes this one (a goal's run limit).
 */
export function PhaseField({
  title,
  description,
  error,
  disabled,
  children,
  after,
}: {
  title: string;
  description: string;
  error?: string;
  disabled?: boolean;
  children: ReactNode;
  after?: ReactNode;
}) {
  return (
    <SettingsGroup>
      <Field invalid={Boolean(error)} disabled={disabled}>
        <SettingsTitle>{title}</SettingsTitle>
        <FieldDescription>{description}</FieldDescription>
        {children}
        {error && <FieldError>{error}</FieldError>}
      </Field>
      {after}
    </SettingsGroup>
  );
}

/** Markdown written straight into a card, with room to click into while empty. */
export function MarkdownCard({
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
    <SettingsContainer>
      <div className="px-4 py-3">
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
      </div>
    </SettingsContainer>
  );
}

/** What the agent is told when a phase starts: its instructions, and the goal it works toward. */
export function PhaseRunFields({
  phaseName,
  instructions,
  goal,
  disabled,
  onInstructionsChange,
  onGoalChange,
}: {
  phaseName: string;
  instructions: string;
  goal: PhaseGoal | undefined;
  disabled?: boolean;
  onInstructionsChange: (instructions: string) => void;
  /** Unset goal means a single run. */
  onGoalChange: (goal: PhaseGoal | undefined) => void;
}) {
  const objective = goal?.objective ?? '';
  return (
    <>
      <PhaseField
        title="Instructions"
        description={`Added to the agent's prompt when the phase starts.${countNear(instructions.length, MAX_PHASE_INSTRUCTIONS)}`}
        error={instructions.length > MAX_PHASE_INSTRUCTIONS ? 'Too long to save.' : undefined}
        disabled={disabled}
      >
        <MarkdownCard
          label={`${phaseName} instructions`}
          value={instructions}
          placeholder="Tell the agent what to do, in Markdown"
          disabled={disabled}
          onChange={onInstructionsChange}
        />
      </PhaseField>

      <PhaseField
        title="Goal"
        description={`The agent keeps working until a judge finds this objective met. Leave empty for a single run.${countNear(objective.length, MAX_PHASE_OBJECTIVE)}`}
        error={objective.length > MAX_PHASE_OBJECTIVE ? 'Too long to save.' : undefined}
        disabled={disabled}
        after={
          goal && (
            <Field invalid={!phaseGoalRunsValid(goal.maxRuns)} disabled={disabled}>
              <div className="flex items-center gap-3">
                <FieldLabel
                  info={`After this many runs without meeting the goal, the card waits for a person. From 1 to ${MAX_PHASE_GOAL_RUNS}; leave empty for Factory's default.`}
                >
                  Pause goal after
                </FieldLabel>
                <InputNumber
                  className="w-36"
                  min={1}
                  max={MAX_PHASE_GOAL_RUNS}
                  allowOutOfRange
                  value={goal.maxRuns ?? null}
                  disabled={disabled}
                  onValueChange={runs => {
                    const { maxRuns: _maxRuns, ...rest } = goal;
                    onGoalChange(runs === null ? rest : { ...rest, maxRuns: runs });
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
              {!phaseGoalRunsValid(goal.maxRuns) && (
                <FieldError>Use a whole number from 1 to {MAX_PHASE_GOAL_RUNS}.</FieldError>
              )}
            </Field>
          )
        }
      >
        <MarkdownCard
          label={`${phaseName} goal`}
          value={objective}
          placeholder="Describe what done looks like"
          disabled={disabled}
          onChange={text => onGoalChange(text.trim() ? { ...goal, objective: text } : undefined)}
        />
      </PhaseField>
    </>
  );
}
