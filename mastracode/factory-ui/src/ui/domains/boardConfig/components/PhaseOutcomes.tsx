import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import type { StoredPhaseInfo } from '../../../../api/types';
import {
  MAX_OUTCOMES,
  defaultOutcomes,
  exitToolOutcome,
  newOutcome,
  nextPhasesOf,
  outcomeProblems,
} from '../boardDraft';
import type { PhaseOutcome } from '../boardDraft';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

const KEY_INFO =
  'What the agent passes to factory_report_outcome. Letters, digits, hyphens and underscores; unique in this phase.';
const DESCRIPTION_INFO =
  "Tells the agent when this outcome applies, and shows in the card's history when Factory moves the card.";
const TARGET_INFO = 'Where Factory moves the card once the run that reported this outcome ends. Only allowed moves.';

/**
 * The outcomes the session working a card in this phase may report; Factory moves the card to the outcome's phase
 * when the run ends. A phase that lists none offers one per allowed move, shown until a person customizes them.
 */
export function PhaseOutcomes({
  phase,
  phases,
  disabled,
  onChange,
}: {
  phase: StoredPhaseInfo;
  phases: StoredPhaseInfo[];
  disabled: boolean;
  onChange: (outcomes: PhaseOutcome[] | null) => void;
}) {
  const own = phase.outcomes?.length ? phase.outcomes : null;
  const next = nextPhasesOf(phase, phases);
  const nameOf = (key: string) => phases.find(other => other.key === key)?.name ?? key;

  if (next.length === 0) {
    return (
      <Txt as="p" variant="caption" tone="muted">
        Allow a move first; each outcome goes to one of them.
      </Txt>
    );
  }

  const exitTool = phase.exitTool?.id;
  const exitNote = (outcomes: readonly PhaseOutcome[]) => {
    if (!exitTool) return null;
    const picked = exitToolOutcome(outcomes, phases);
    return picked ? (
      <Txt as="p" variant="caption" tone="muted">
        When <code>{exitTool}</code> succeeds, it reports <code>{picked.key}</code>, moving the card to{' '}
        {nameOf(picked.to)}.
      </Txt>
    ) : (
      <Notice variant="warning">
        <Notice.Message>
          When <code>{exitTool}</code> succeeds, no outcome is picked, so the card waits for the agent to report one.
          Key an outcome <code>advance</code> to choose where its success moves the card.
        </Notice.Message>
      </Notice>
    );
  };

  if (!own) {
    const defaults = defaultOutcomes(phase, phases);
    return (
      <div className="flex flex-col gap-3">
        <ul aria-label={`${phase.name} outcomes`} className="flex flex-col gap-1">
          {defaults.map(outcome => (
            <li key={outcome.key}>
              <Txt as="span" variant="caption" tone="muted">
                <code>{outcome.key}</code> moves the card to {nameOf(outcome.to)}
              </Txt>
            </li>
          ))}
        </ul>
        {exitNote(defaults)}
        <Txt as="p" variant="caption" tone="muted">
          This phase lists no outcomes, so the agent may report any allowed move by the key of the phase it goes to.
          Customize them to give each a description the agent reads, or to offer fewer moves than people have.
        </Txt>
        {!disabled && (
          <div>
            <Button size="sm" variant="ghost" onClick={() => onChange(defaults.slice(0, MAX_OUTCOMES))}>
              Customize outcomes
            </Button>
          </div>
        )}
      </div>
    );
  }

  const problems = outcomeProblems(own);
  const set = (index: number, patch: Partial<PhaseOutcome>) =>
    onChange(own.map((outcome, other) => (other === index ? { ...outcome, ...patch } : outcome)));
  const remove = (index: number) => {
    const rest = own.filter((_, other) => other !== index);
    onChange(rest.length > 0 ? rest : null);
  };
  const added = newOutcome(phase, phases, own);

  return (
    <div className="flex flex-col gap-3">
      <SettingsContainer>
        <div className="flex gap-3 px-4 pt-3">
          <Field className="w-36">
            <FieldLabel size="smaller" info={KEY_INFO}>
              Key
            </FieldLabel>
          </Field>
          <Field className="min-w-48 flex-1">
            <FieldLabel size="smaller" info={DESCRIPTION_INFO}>
              Description
            </FieldLabel>
          </Field>
          <Field className="w-44">
            <FieldLabel size="smaller" info={TARGET_INFO}>
              Moves the card to
            </FieldLabel>
          </Field>
          {!disabled && <div aria-hidden className="w-8" />}
        </div>
        <ul aria-label={`${phase.name} outcomes`} className="flex flex-col">
          {own.map((outcome, index) => {
            const problem = problems[index] ?? {};
            const name = `outcome ${outcome.key || index + 1}`;
            return (
              <li key={index} className="flex items-start gap-3 px-4 py-2">
                <Field invalid={Boolean(problem.key)} disabled={disabled} className="w-36">
                  <Input
                    aria-label={`${phase.name} outcome ${index + 1} key`}
                    value={outcome.key}
                    placeholder="e.g. review"
                    disabled={disabled}
                    onChange={event => set(index, { key: event.target.value.trim() })}
                  />
                  {problem.key && <FieldError>{problem.key}</FieldError>}
                </Field>
                <Field invalid={Boolean(problem.label)} disabled={disabled} className="min-w-48 flex-1">
                  <Input
                    aria-label={`${phase.name} outcome ${index + 1} label`}
                    value={outcome.label}
                    placeholder="e.g. Change request opened for review"
                    disabled={disabled}
                    onChange={event => set(index, { label: event.target.value })}
                  />
                  {problem.label && <FieldError>{problem.label}</FieldError>}
                </Field>
                <Field disabled={disabled} className="w-44">
                  <Select
                    value={outcome.to}
                    disabled={disabled}
                    onValueChange={value => set(index, { to: String(value) })}
                  >
                    <SelectTrigger size="sm" aria-label={`${phase.name} ${name} goes to`} className="w-full">
                      <span className="truncate">{nameOf(outcome.to)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {next.map(key => (
                        <SelectItem key={key} value={key}>
                          {nameOf(key)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {!disabled && (
                  <Button size="icon-sm" variant="ghost" tooltip={`Remove ${name}`} onClick={() => remove(index)}>
                    <TrashIcon />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </SettingsContainer>
      {exitNote(own)}
      {!disabled && (
        <div className="flex gap-2">
          {added && own.length < MAX_OUTCOMES && (
            <Button size="sm" variant="ghost" icon={<IconPlusMedium />} onClick={() => onChange([...own, added])}>
              Add outcome
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            Use one per move
          </Button>
        </div>
      )}
    </div>
  );
}
