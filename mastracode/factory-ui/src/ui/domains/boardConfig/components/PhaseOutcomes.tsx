import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import type { StoredPhaseInfo } from '../../../../api/types';
import { MAX_OUTCOMES, defaultOutcomes, newOutcome, nextPhasesOf, outcomeProblems } from '../boardDraft';
import type { PhaseOutcome } from '../boardDraft';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

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

  if (!own) {
    const defaults = defaultOutcomes(phase, phases);
    return (
      <div className="flex flex-col gap-3">
        <ul aria-label={`${phase.name} outcomes`} className="flex flex-col gap-1">
          {defaults.map(outcome => (
            <li key={outcome.key}>
              <Txt as="span" variant="caption" tone="muted">
                {outcome.label} → {nameOf(outcome.to)}
              </Txt>
            </li>
          ))}
        </ul>
        <Txt as="p" variant="caption" tone="muted">
          One outcome per allowed move, named after it.
        </Txt>
        {!disabled && (
          <div>
            <Button size="sm" variant="ghost" onClick={() => onChange(defaults)}>
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
        <ul aria-label={`${phase.name} outcomes`} className="flex flex-col">
          {own.map((outcome, index) => {
            const problem = problems[index] ?? {};
            const name = `outcome ${outcome.key || index + 1}`;
            return (
              <li key={index} className="flex flex-wrap items-start gap-2 px-4 py-3">
                <Field invalid={Boolean(problem.key)} disabled={disabled} className="w-36">
                  <Input
                    aria-label={`${phase.name} outcome ${index + 1} key`}
                    value={outcome.key}
                    disabled={disabled}
                    onChange={event => set(index, { key: event.target.value.trim() })}
                  />
                  {problem.key && <FieldError>{problem.key}</FieldError>}
                </Field>
                <Field invalid={Boolean(problem.label)} disabled={disabled} className="min-w-40 flex-1">
                  <Input
                    aria-label={`${phase.name} outcome ${index + 1} label`}
                    value={outcome.label}
                    disabled={disabled}
                    onChange={event => set(index, { label: event.target.value })}
                  />
                  {problem.label && <FieldError>{problem.label}</FieldError>}
                </Field>
                <Select
                  value={outcome.to}
                  disabled={disabled}
                  onValueChange={value => set(index, { to: String(value) })}
                >
                  <SelectTrigger size="sm" aria-label={`${phase.name} ${name} goes to`} className="w-40">
                    <span className="truncate">→ {nameOf(outcome.to)}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {next.map(key => (
                      <SelectItem key={key} value={key}>
                        {nameOf(key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
