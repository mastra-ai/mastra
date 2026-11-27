import type { ReactNode } from 'react';
import { BoardStageIcon, phaseIconKind } from '../../board/board-icons';
import {
  MAX_PHASE_GOAL_RUNS,
  MAX_PHASE_INSTRUCTIONS,
  MAX_PHASE_OBJECTIVE,
  phaseGoalRunsValid,
} from '../../board/phase-run-fields';
import { LimitCount, PanelRow } from '../panel-parts';
import type { PanelPhase, PanelPhaseRunner } from './types';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Field, FieldError, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { InputGroupAddon, InputGroupText } from '@/ds/components/InputGroup';
import {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
} from '@/ds/components/InputNumber';
import { Switch } from '@/ds/components/Switch';
import { Txt } from '@/ds/components/Txt';
import { IconChainLink3 } from '@/ds/icons/central/IconChainLink3';
import { IconChevronLeftMedium } from '@/ds/icons/central/IconChevronLeftMedium';
import { fieldErrorRimWithin, inputSurfaceAndFocusWithinStyle } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

/** A Factory tool a phase can grant the session working a card there. */
export interface PhaseToolOption<Tool extends string = string> {
  id: Tool;
  label: string;
}

/** The session a phase's agent works in: its own context, else the default every phase shares. */
const sessionOf = (phase: PanelPhase, defaultSession: string) => phase.runner?.context || defaultSession;

/** What the agent is told and given when the phase starts: instructions, goal, session and Factory tools. */
export function PhaseRunsPanel<Tool extends string>({
  phase,
  phases,
  boardId,
  defaultSession,
  phaseTools,
  disabled,
  onRunner,
  onTools,
  onBack,
}: {
  phase: PanelPhase;
  phases: readonly PanelPhase[];
  boardId: string;
  /** The session a phase that names none works in. */
  defaultSession: string;
  /** The Factory tools a phase can grant. */
  phaseTools: readonly PhaseToolOption<Tool>[];
  disabled: boolean;
  onRunner: (runner: Partial<PanelPhaseRunner>) => void;
  onTools: (tools: Tool[] | null) => void;
  onBack: () => void;
}) {
  const instructions = phase.runner?.instructions ?? '';
  const goal = phase.runner?.goal;
  const objective = goal?.objective ?? '';
  const tools = phase.tools ?? [];
  const session = sessionOf(phase, defaultSession);
  const sharing = phases
    .filter(
      other => other.key !== phase.key && other.kind === 'working' && sessionOf(other, defaultSession) === session,
    )
    .map(other => other.name);

  return (
    <>
      <div className="flex min-h-7 min-w-0 items-center gap-2">
        <Button size="icon-sm" variant="ghost" tooltip={`Back to ${phase.name}`} onClick={onBack}>
          <IconChevronLeftMedium />
        </Button>
        <BoardStageIcon stage={phase.key} kind={phaseIconKind(boardId, phase.kind)} decorative />
        <Txt as="h2" variant="card-title-strong" className="min-w-0 truncate">
          {phase.name}
        </Txt>
        <Txt as="span" variant="caption" tone="muted" className="shrink-0">
          Agent runs
        </Txt>
      </div>

      <LimitedText
        title="Instructions"
        label={`${phase.name} instructions`}
        value={instructions}
        max={MAX_PHASE_INSTRUCTIONS}
        placeholder="Added to the agent's prompt when the phase starts."
        disabled={disabled}
        onChange={text => onRunner({ instructions: text })}
      />

      <LimitedText
        title="Goal"
        label={`${phase.name} goal`}
        value={objective}
        max={MAX_PHASE_OBJECTIVE}
        placeholder="The agent keeps working until a judge finds this met. Leave empty for a single run."
        disabled={disabled}
        onChange={text => onRunner({ goal: text.trim() ? { ...goal, objective: text } : undefined })}
      >
        {goal && (
          <Field invalid={!phaseGoalRunsValid(goal.maxRuns)} disabled={disabled}>
            <div className="flex items-center justify-between gap-1.5">
              <FieldLabel
                size="smaller"
                info={`After this many runs without meeting the goal, the card waits for a person. From 1 to ${MAX_PHASE_GOAL_RUNS}; leave empty for Factory's default.`}
              >
                Pause goal after
              </FieldLabel>
              <InputNumber
                className="w-32"
                min={1}
                max={MAX_PHASE_GOAL_RUNS}
                allowOutOfRange
                value={goal.maxRuns ?? null}
                disabled={disabled}
                onValueChange={runs => {
                  const { maxRuns: _maxRuns, ...rest } = goal;
                  onRunner({ goal: runs === null ? rest : { ...rest, maxRuns: runs } });
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
        )}
      </LimitedText>

      <div className="flex flex-col gap-2 px-1">
        <PanelRow label="Session">
          <Input
            size="sm"
            className="w-28"
            aria-label={`${phase.name} session`}
            value={phase.runner?.context ?? ''}
            placeholder={defaultSession}
            disabled={disabled}
            onChange={event => onRunner({ context: event.target.value })}
          />
        </PanelRow>
        <Txt as="p" variant="caption" tone="muted" className="flex items-center gap-1.5">
          <IconChainLink3 aria-hidden className="size-icon-xs shrink-0" />
          {sharing.length > 0 ? `Shared with ${sharing.join(', ')}, one per card` : 'One per card'}
        </Txt>
      </div>

      <div role="group" aria-label="Factory tools" className="flex flex-col gap-2.5 px-1">
        <Txt as="span" variant="caption" tone="muted">
          Factory tools
        </Txt>
        {phaseTools.map(tool => (
          <div key={tool.id} className="flex items-center justify-between gap-1.5">
            <Txt as="span" variant="caption">
              {tool.label}
            </Txt>
            <Switch
              aria-label={`${phase.name}: ${tool.label}`}
              checked={tools.includes(tool.id)}
              disabled={disabled}
              onCheckedChange={checked => {
                const chosen = phaseTools
                  .map(({ id }) => id)
                  .filter(id => (id === tool.id ? checked : tools.includes(id)));
                onTools(chosen.length > 0 ? chosen : null);
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

/** A Markdown field with its limit counted beside its label, refused once it runs over. */
function LimitedText({
  title,
  label,
  value,
  max,
  placeholder,
  disabled,
  onChange,
  children,
}: {
  title: string;
  label: string;
  value: string;
  max: number;
  placeholder: string;
  disabled: boolean;
  onChange: (text: string) => void;
  children?: ReactNode;
}) {
  const over = value.length > max;
  return (
    <div className="flex flex-col gap-2 px-1">
      <Field invalid={over} disabled={disabled}>
        <div className="flex items-center justify-between gap-1.5">
          <FieldLabel size="smaller">{title}</FieldLabel>
          <LimitCount length={value.length} max={max} />
        </div>
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
          className={cn(
            inputSurfaceAndFocusWithinStyle,
            fieldErrorRimWithin,
            'rounded-xl px-2 py-1.5',
            disabled && 'bg-field-disabled',
          )}
          data-base-ui-swipe-ignore=""
        />
        {over && <FieldError>Too long to save.</FieldError>}
      </Field>
      {children}
    </div>
  );
}
