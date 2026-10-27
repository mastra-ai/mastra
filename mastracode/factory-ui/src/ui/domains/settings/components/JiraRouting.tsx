import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsFieldsetRow, SettingsRow } from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import {
  useDeleteIntakeBindingMutation,
  useIntakeBindingsQuery,
  useSaveIntakeBindingMutation,
} from '../../../../hooks/useIntakeConfig';
import { IntakeBindingConflictError } from '../../factory/services/intake';
import type { IntakeSourceBinding } from '../../factory/services/intake';
import { BoardPicker } from './LinearRouting';

const ALL_ISSUES = 'all';
const LABELLED = 'labelled';

/** Comma-separated labels as typed, trimmed and without blanks. */
function splitLabels(value: string): string[] {
  return value
    .split(',')
    .map(label => label.trim())
    .filter(Boolean);
}

type Factory = { id: string; name: string };

/**
 * Routing for selected Jira projects. Unlike other providers, one Jira project
 * can feed several factories: each takes either all issues or only the issues
 * carrying its labels. Label filters beat "all issues", and an issue carrying
 * two factories' labels goes to the factory that was added first.
 */
export function JiraRouting({
  sourceIds,
  sources,
  factories,
}: {
  sourceIds: string[];
  sources: { id: string; name: string }[];
  factories: Factory[];
}) {
  const bindingsQuery = useIntakeBindingsQuery();
  const bindings = (bindingsQuery.data ?? []).filter(binding => binding.integrationId === 'jira');
  return (
    <div role="group" aria-label="Jira routing" className="flex flex-col">
      {sourceIds.map(sourceId => (
        <JiraProjectRouting
          key={sourceId}
          sourceId={sourceId}
          name={sources.find(source => source.id === sourceId)?.name ?? sourceId}
          bindings={bindings.filter(binding => binding.sourceId === sourceId)}
          factories={factories}
        />
      ))}
    </div>
  );
}

function factoryName(factories: Factory[], id: string): string {
  return factories.find(factory => factory.id === id)?.name ?? 'another factory';
}

function conflictMessage(error: unknown, factories: Factory[]): string {
  if (!(error instanceof IntakeBindingConflictError)) {
    return error instanceof Error ? error.message : 'Failed to save Jira routing';
  }
  return error.conflicts
    .map(conflict =>
      conflict.labels
        ? `${conflict.labels.map(label => `"${label}"`).join(', ')} already routed to ${factoryName(factories, conflict.factoryProjectId)}`
        : `${factoryName(factories, conflict.factoryProjectId)} already takes all issues`,
    )
    .join('; ');
}

function JiraProjectRouting({
  sourceId,
  name,
  bindings,
  factories,
}: {
  sourceId: string;
  name: string;
  bindings: IntakeSourceBinding[];
  factories: Factory[];
}) {
  const save = useSaveIntakeBindingMutation();
  const remove = useDeleteIntakeBindingMutation();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = save.isPending || remove.isPending;
  const unbound = factories.filter(factory => !bindings.some(binding => binding.factoryProjectId === factory.id));
  const takesAllIssues = bindings.some(binding => (binding.labels ?? null) === null);
  const [draftFactory, setDraftFactory] = useState<string | null>(null);
  const [draftLabels, setDraftLabels] = useState('');
  const parsedDraftLabels = splitLabels(draftLabels);
  const addError = draftFactory ? errors[draftFactory] : undefined;

  const setError = (factoryProjectId: string, message: string | null) =>
    setErrors(current => {
      const { [factoryProjectId]: _, ...rest } = current;
      return message ? { ...rest, [factoryProjectId]: message } : rest;
    });

  const route = (
    factoryProjectId: string,
    change: { board?: string | null; labels?: string[] | null },
    onDone?: () => void,
  ) => {
    const current = bindings.find(binding => binding.factoryProjectId === factoryProjectId);
    save.mutate(
      { integrationId: 'jira', sourceId, factoryProjectId, board: current?.board ?? null, ...change },
      {
        onSuccess: () => {
          setError(factoryProjectId, null);
          toast.success('Jira routing updated');
          onDone?.();
        },
        onError: err => setError(factoryProjectId, conflictMessage(err, factories)),
      },
    );
  };

  const unroute = (factoryProjectId: string) =>
    remove.mutate(
      { integrationId: 'jira', sourceId, factoryProjectId },
      {
        onSuccess: () => {
          setError(factoryProjectId, null);
          toast.success('Jira routing updated');
        },
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save Jira routing'),
      },
    );

  return (
    <div className="flex flex-col">
      <SettingsRow
        label={name}
        description={
          bindings.length === 0
            ? "Not routed — this project's issues won't be picked up."
            : bindings.length > 1
              ? 'Label filters take precedence over "All issues". An issue matching two filters goes to the factory added first.'
              : undefined
        }
      />
      {unbound.length > 0 && (
        <SettingsFieldsetRow
          label={`Add a factory for ${name}`}
          description={
            takesAllIssues
              ? 'Another factory takes all issues, so name the labels this factory should take.'
              : 'Leave labels empty to take all issues.'
          }
        >
          <div className="flex items-center gap-2">
            <Select value={draftFactory ?? ''} disabled={busy} onValueChange={setDraftFactory}>
              <SelectTrigger size="sm" aria-label={`Factory to add for ${name}`} className="w-auto">
                <Txt as="span" variant="caption">
                  {draftFactory ? factoryName(factories, draftFactory) : 'Choose a factory'}
                </Txt>
              </SelectTrigger>
              <SelectContent>
                {unbound.map(factory => (
                  <SelectItem key={factory.id} value={factory.id}>
                    {factory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              size="sm"
              aria-label={`Labels for the new ${name} factory`}
              placeholder="payments, billing"
              value={draftLabels}
              disabled={busy}
              onChange={event => setDraftLabels(event.target.value)}
            />
            <Button
              size="sm"
              disabled={busy || !draftFactory || (takesAllIssues && parsedDraftLabels.length === 0)}
              onClick={() => {
                if (!draftFactory) return;
                route(
                  draftFactory,
                  { board: null, labels: parsedDraftLabels.length > 0 ? parsedDraftLabels : null },
                  () => {
                    setDraftFactory(null);
                    setDraftLabels('');
                  },
                );
              }}
            >
              Add
            </Button>
          </div>
          {addError && (
            <Txt tone="muted" as="p" variant="caption">
              {addError}
            </Txt>
          )}
        </SettingsFieldsetRow>
      )}
      {bindings.map(binding => (
        <JiraBindingRow
          key={binding.factoryProjectId}
          name={name}
          binding={binding}
          factory={factoryName(factories, binding.factoryProjectId)}
          others={bindings
            .filter(other => other.factoryProjectId !== binding.factoryProjectId)
            .map(other => ({ factory: factoryName(factories, other.factoryProjectId), labels: other.labels ?? null }))}
          error={errors[binding.factoryProjectId]}
          disabled={busy}
          onBoardChange={board => route(binding.factoryProjectId, { board })}
          onLabelsChange={labels => route(binding.factoryProjectId, { labels })}
          onRemove={() => unroute(binding.factoryProjectId)}
        />
      ))}
    </div>
  );
}

function JiraBindingRow({
  name,
  binding,
  factory,
  others,
  error,
  disabled,
  onBoardChange,
  onLabelsChange,
  onRemove,
}: {
  name: string;
  binding: IntakeSourceBinding;
  factory: string;
  others: Array<{ factory: string; labels: string[] | null }>;
  error: string | undefined;
  disabled: boolean;
  onBoardChange: (board: string | null) => void;
  onLabelsChange: (labels: string[] | null) => void;
  onRemove: () => void;
}) {
  // "Only labelled" is a local choice until the first label saves: an empty filter is not a binding.
  const saved = binding.labels ?? null;
  const [labelled, setLabelled] = useState(saved !== null);
  const [draft, setDraft] = useState('');
  const labels = saved ?? [];
  const filtered = labelled || saved !== null;

  const addDraft = () => {
    const added = splitLabels(draft).filter(
      label => !labels.some(existing => existing.toLowerCase() === label.toLowerCase()),
    );
    setDraft('');
    if (added.length > 0) onLabelsChange([...labels, ...added]);
  };

  const elsewhere = others
    .map(other => (other.labels ? `${other.factory} (${other.labels.join(', ')})` : `${other.factory} (all issues)`))
    .join(', ');
  const description =
    error ??
    (binding.board === null
      ? "Choose a board — this factory won't pick up issues until one is set."
      : filtered && labels.length === 0
        ? 'Add a label — this factory takes no issues until it has one.'
        : elsewhere
          ? `Also routed to ${elsewhere}.`
          : undefined);

  return (
    <SettingsFieldsetRow label={factory} description={description}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <BoardPicker
            name={`${name} in ${factory}`}
            factoryProjectId={binding.factoryProjectId}
            board={binding.board}
            disabled={disabled}
            onChange={onBoardChange}
          />
          <Select
            value={filtered ? LABELLED : ALL_ISSUES}
            disabled={disabled}
            onValueChange={value => {
              if (value === ALL_ISSUES) {
                setLabelled(false);
                if (saved !== null) onLabelsChange(null);
              } else {
                setLabelled(true);
              }
            }}
          >
            <SelectTrigger size="sm" aria-label={`Issues from ${name} for ${factory}`} className="w-auto">
              <Txt as="span" variant="caption">
                {filtered ? 'Only issues labelled…' : 'All issues'}
              </Txt>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ISSUES}>All issues</SelectItem>
              <SelectItem value={LABELLED}>Only issues labelled…</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={onRemove}
            aria-label={`Stop routing ${name} to ${factory}`}
          >
            Remove
          </Button>
        </div>
        {filtered && (
          <div className="flex flex-wrap items-center gap-2">
            {labels.map(label => (
              <span key={label} className="flex items-center gap-1">
                <Badge size="sm" variant="neutral">
                  {label}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || labels.length === 1}
                  aria-label={`Remove label ${label}`}
                  onClick={() => onLabelsChange(labels.filter(existing => existing !== label))}
                >
                  ×
                </Button>
              </span>
            ))}
            <Input
              size="sm"
              aria-label={`Add label for ${factory}`}
              placeholder="Add label"
              value={draft}
              disabled={disabled}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  addDraft();
                }
              }}
              onBlur={addDraft}
            />
          </div>
        )}
      </div>
    </SettingsFieldsetRow>
  );
}
