import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';

import {
  useDeleteIntakeBindingMutation,
  useIntakeBindingsQuery,
  useSaveIntakeBindingMutation,
} from '../../../../hooks/useIntakeConfig';
import { IntakeBindingConflictError } from '../../factory/services/intake';
import type { IntakeSourceBinding } from '../../factory/services/intake';
import { SourcePicker } from './IntakeSourcePicker';
import type { SourcePickerProps } from './IntakeSourcePicker';
import { BoardPicker } from './IntakeSourceRouting';

const ALL_ISSUES = 'all';
const LABELLED = 'labelled';

type Factory = { id: string; name: string };

/** Comma-separated labels as typed, trimmed and without blanks. */
function splitLabels(value: string): string[] {
  return value
    .split(',')
    .map(label => label.trim())
    .filter(Boolean);
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

/**
 * Selected Jira projects with their routing. Unlike other providers, one Jira
 * project can feed several factories: each takes either all issues or only the
 * issues carrying its labels. Label filters beat "all issues", and an issue
 * carrying two factories' labels goes to the factory that was added first.
 */
export function JiraRoutedSourcePicker({ factories, ...picker }: SourcePickerProps & { factories: Factory[] }) {
  const bindingsQuery = useIntakeBindingsQuery();
  const bindings = bindingsQuery.data;
  const bindingsFor = (sourceId: string) =>
    (bindings ?? []).filter(binding => binding.integrationId === 'jira' && binding.sourceId === sourceId);

  return (
    <>
      <SourcePicker
        {...picker}
        itemDescription={sourceId => {
          if (!bindings) return undefined;
          const routes = bindingsFor(sourceId);
          if (routes.length === 0) return "Not routed — this project's issues won't be picked up.";
          if (routes.length > 1)
            return 'Label filters take precedence over "All issues". An issue matching two filters goes to the factory added first.';
          return undefined;
        }}
        itemDetails={item =>
          bindings && (
            <JiraSourceRoutes
              sourceId={item.id}
              name={item.label}
              bindings={bindingsFor(item.id)}
              factories={factories}
            />
          )
        }
      />
      {bindingsQuery.isError && (
        <SettingsRow label="Routing is unavailable" description="Your source routes could not be loaded.">
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void bindingsQuery.refetch()}>
            Retry
          </Button>
        </SettingsRow>
      )}
    </>
  );
}

function JiraSourceRoutes({
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
    <ul aria-label={`Factories for ${name}`} className="border-border mt-1 flex flex-col gap-2 border-l pl-3">
      {bindings.map(binding => (
        <JiraBindingRow
          key={binding.factoryProjectId}
          name={name}
          binding={binding}
          factory={factoryName(factories, binding.factoryProjectId)}
          others={bindings
            .filter(other => other.factoryProjectId !== binding.factoryProjectId)
            .map(other => ({ labels: other.labels ?? null, board: other.board }))}
          error={errors[binding.factoryProjectId]}
          disabled={busy}
          onBoardChange={board => route(binding.factoryProjectId, { board })}
          onLabelsChange={labels => route(binding.factoryProjectId, { labels })}
          onRemove={() => unroute(binding.factoryProjectId)}
        />
      ))}
      {unbound.length > 0 && (
        <AddJiraFactory
          name={name}
          factories={factories}
          unbound={unbound}
          takesAllIssues={bindings.some(binding => (binding.labels ?? null) === null)}
          errors={errors}
          disabled={busy}
          onAdd={(factoryProjectId, labels, onDone) => route(factoryProjectId, { board: null, labels }, onDone)}
        />
      )}
    </ul>
  );
}

function AddJiraFactory({
  name,
  factories,
  unbound,
  takesAllIssues,
  errors,
  disabled,
  onAdd,
}: {
  name: string;
  factories: Factory[];
  unbound: Factory[];
  takesAllIssues: boolean;
  errors: Record<string, string>;
  disabled: boolean;
  onAdd: (factoryProjectId: string, labels: string[] | null, onDone: () => void) => void;
}) {
  const [factory, setFactory] = useState<string | null>(null);
  const [labels, setLabels] = useState('');
  const parsed = splitLabels(labels);
  const error = factory ? errors[factory] : undefined;
  const hint = takesAllIssues
    ? 'Another factory takes all issues, so name the labels this factory should take.'
    : 'Leave labels empty to take all issues.';

  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={factory ?? ''} disabled={disabled} onValueChange={setFactory}>
          <SelectTrigger size="sm" aria-label={`Factory to add for ${name}`} className="w-auto max-w-full min-w-0">
            <Txt as="span" variant="caption">
              {factory ? factoryName(factories, factory) : 'Add a factory'}
            </Txt>
          </SelectTrigger>
          <SelectContent>
            {unbound.map(candidate => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {factory && (
          <>
            <Input
              size="sm"
              aria-label={`Labels for the new ${name} factory`}
              placeholder="Labels, e.g. payments, billing"
              value={labels}
              disabled={disabled}
              onChange={event => setLabels(event.target.value)}
              className="w-56 max-w-full"
            />
            <Button
              size="sm"
              icon={<Plus />}
              disabled={disabled || (takesAllIssues && parsed.length === 0)}
              onClick={() =>
                onAdd(factory, parsed.length > 0 ? parsed : null, () => {
                  setFactory(null);
                  setLabels('');
                })
              }
            >
              Add
            </Button>
          </>
        )}
      </div>
      {factory && (
        <Txt as="p" variant="meta" tone="muted" role={error ? 'alert' : undefined}>
          {error ?? hint}
        </Txt>
      )}
    </li>
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
  others: Array<{ labels: string[] | null; board: string | null }>;
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

  // Label filters beat "all issues", so the all-issues factory gives up every label routed to a
  // factory with a board. A factory without one doesn't poll, so it takes nothing yet.
  const excepted =
    saved === null && !filtered ? others.filter(other => other.board).flatMap(other => other.labels ?? []) : [];
  const description =
    error ??
    (binding.board === null
      ? "Choose a board — this factory won't pick up issues until one is set."
      : filtered && labels.length === 0
        ? 'Add a label — this factory takes no issues until it has one.'
        : excepted.length > 0
          ? `Takes all issues except those labelled ${excepted.join(', ')}.`
          : undefined);

  return (
    <li aria-label={factory} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Txt as="span" variant="caption" className="min-w-24 wrap-anywhere">
          {factory}
        </Txt>
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
          <SelectTrigger
            size="sm"
            aria-label={`Issues from ${name} for ${factory}`}
            className="w-auto max-w-full min-w-0"
          >
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
          icon={<X />}
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Stop routing ${name} to ${factory}`}
          className="ml-auto"
        >
          Unroute
        </Button>
      </div>
      {filtered && (
        <div className="flex flex-wrap items-center gap-1">
          {labels.map(label => (
            <Badge key={label} size="sm" variant="neutral">
              <span className="flex items-center gap-1">
                {label}
                <button
                  type="button"
                  aria-label={`Remove label ${label}`}
                  disabled={disabled || labels.length === 1}
                  onClick={() => onLabelsChange(labels.filter(existing => existing !== label))}
                  className="disabled:opacity-40"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            </Badge>
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
            className="w-28"
          />
        </div>
      )}
      {description && (
        <Txt as="p" variant="meta" tone="muted" role={error ? 'alert' : undefined} className="wrap-anywhere">
          {description}
        </Txt>
      )}
    </li>
  );
}
