import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

import type { StoredPhaseInfo } from '../../../../../api/types';
import {
  MAX_OUTCOMES,
  defaultOutcomes,
  exitToolOutcome,
  newOutcome,
  nextPhasesOf,
  outcomeProblems,
} from '../../../boardConfig/boardDraft';
import type { PhaseOutcome } from '../../../boardConfig/boardDraft';

/**
 * The outcomes the session working a card in this phase may report; Factory moves the card to the outcome's phase
 * when the run ends. A phase that lists none offers one per allowed move, shown until a person customizes them.
 */
export function PhaseOutcomesList({
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
  const own = phase.outcomes?.length ? phase.outcomes : undefined;
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

  if (!own) {
    const defaults = defaultOutcomes(phase, phases);
    return (
      <div className="flex flex-col gap-2">
        <ul aria-label={`${phase.name} outcomes`} className="flex flex-col gap-1">
          {defaults.map(outcome => (
            <li key={outcome.key}>
              <Txt as="span" variant="caption" tone="muted">
                <code>{outcome.key}</code> moves the card to {nameOf(outcome.to)}
              </Txt>
            </li>
          ))}
        </ul>
        {exitTool && <ExitToolNote exitTool={exitTool} outcomes={defaults} phases={phases} />}
        <Txt as="p" variant="caption" tone="muted">
          The agent may report any allowed move by the key of the phase it goes to. Customize them to describe each one,
          or to offer fewer moves than people have.
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
  const added = newOutcome(phase, phases, own);

  return (
    <div className="flex flex-col gap-2">
      <Txt as="p" variant="caption" tone="muted">
        The agent reports one by its key when its work is done; the description tells it when, and shows in the
        card&apos;s history.
      </Txt>
      <ul aria-label={`${phase.name} outcomes`} className="flex flex-col gap-1.5">
        {own.map((outcome, index) => {
          const problem = problems[index] ?? {};
          const name = `outcome ${outcome.key || index + 1}`;
          return (
            <li key={index} className="bg-fill-subtle flex flex-col gap-1.5 rounded-2xl p-2">
              <div className="flex items-start gap-1.5">
                <Field invalid={Boolean(problem.key)} disabled={disabled} className="min-w-0 flex-1">
                  <Input
                    size="sm"
                    aria-label={`${phase.name} outcome ${index + 1} key`}
                    value={outcome.key}
                    placeholder="Key, e.g. review"
                    disabled={disabled}
                    onChange={event => set(index, { key: event.target.value.trim() })}
                  />
                  {problem.key && <FieldError>{problem.key}</FieldError>}
                </Field>
                <IconArrowRight aria-hidden className="text-muted-foreground size-icon-xs mt-2 shrink-0" />
                <Select
                  value={outcome.to}
                  disabled={disabled}
                  onValueChange={value => set(index, { to: String(value) })}
                >
                  <SelectTrigger size="sm" aria-label={`${phase.name} ${name} goes to`} className="w-24 shrink-0">
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
                {!disabled && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    tooltip={`Remove ${name}`}
                    onClick={() => {
                      const rest = own.filter((_, other) => other !== index);
                      onChange(rest.length > 0 ? rest : null);
                    }}
                  >
                    <TrashIcon />
                  </Button>
                )}
              </div>
              <Field invalid={Boolean(problem.label)} disabled={disabled}>
                <Input
                  size="sm"
                  aria-label={`${phase.name} outcome ${index + 1} label`}
                  value={outcome.label}
                  placeholder="Description, e.g. Change request opened"
                  disabled={disabled}
                  onChange={event => set(index, { label: event.target.value })}
                />
                {problem.label && <FieldError>{problem.label}</FieldError>}
              </Field>
            </li>
          );
        })}
      </ul>
      {exitTool && <ExitToolNote exitTool={exitTool} outcomes={own} phases={phases} />}
      {!disabled && (
        <div className="flex flex-wrap gap-1">
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

/** What the phase's exit tool reports when it succeeds, or a warning that it picks no outcome. */
function ExitToolNote({
  exitTool,
  outcomes,
  phases,
}: {
  exitTool: string;
  outcomes: readonly PhaseOutcome[];
  phases: StoredPhaseInfo[];
}) {
  const picked = exitToolOutcome(outcomes, phases);
  if (!picked) {
    return (
      <Notice variant="warning">
        <Notice.Message>
          When <code>{exitTool}</code> succeeds, no outcome is picked, so the card waits for the agent to report one.
          Key an outcome <code>advance</code> to choose where its success moves the card.
        </Notice.Message>
      </Notice>
    );
  }
  const to = phases.find(other => other.key === picked.to)?.name ?? picked.to;
  return (
    <Txt as="p" variant="caption" tone="muted">
      When <code>{exitTool}</code> succeeds, it reports <code>{picked.key}</code>, moving the card to {to}.
    </Txt>
  );
}
