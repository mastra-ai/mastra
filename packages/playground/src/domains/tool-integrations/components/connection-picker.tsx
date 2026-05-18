import { Button, Input, Txt, cn } from '@mastra/playground-ui';
import { Trash2, Plus, RefreshCw, AlertCircle, Link2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useAuthorize } from '../hooks/use-authorize';
import { useConnectionFields } from '../hooks/use-connection-fields';
import { useExistingConnections } from '../hooks/use-existing-connections';

type ConnectionField = {
  name: string;
  displayName?: string;
  description?: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  default?: unknown;
};

/**
 * A single saved connection (provider-agnostic). Mirrors the shape that
 * Phase 7 persists to `toolIntegrations[providerId].connections[]`.
 */
export interface PickerConnection {
  connectionId: string;
  toolService: string;
  /**
   * Optional when this is the only connection on `toolService`. Required
   * (non-empty, unique within the service) once a second connection is
   * added — see `validateLabels`.
   */
  label?: string;
}

export interface ConnectionPickerProps {
  integrationId: string;
  toolService: string;
  /** From `useToolIntegrations()[i].capabilities`. */
  multipleAllowed: boolean;
  /** Controlled value. */
  connections: PickerConnection[];
  /** Controlled change. */
  onChange: (next: PickerConnection[]) => void;
  /** Disable inputs while parent form is busy. */
  disabled?: boolean;
}

const LABEL_RE = /^[A-Za-z0-9 _-]+$/;
const MAX_LABEL = 32;

interface LabelError {
  index: number;
  message: string;
}

const validateLabels = (connections: PickerConnection[]): LabelError[] => {
  const errors: LabelError[] = [];
  const seen = new Map<string, number>();
  // Single-connection rows may omit a label — runtime falls back to a
  // generic suffix. Once two or more connections share a `toolService`
  // we *require* a unique, well-formed label on each row to keep tool
  // names disambiguated for the LLM.
  const labelRequired = connections.length >= 2;

  connections.forEach((conn, index) => {
    const raw = conn.label ?? '';
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      if (labelRequired) {
        errors.push({ index, message: 'Label is required when you have multiple connections' });
      }
      return;
    }
    if (trimmed.length > MAX_LABEL) {
      errors.push({ index, message: `Label must be ≤${MAX_LABEL} characters` });
      return;
    }
    if (!LABEL_RE.test(trimmed)) {
      errors.push({ index, message: 'Use letters, numbers, spaces, _ or -' });
      return;
    }
    const key = trimmed.toLowerCase();
    const priorIndex = seen.get(key);
    if (priorIndex !== undefined) {
      errors.push({ index, message: 'Duplicate label' });
    } else {
      seen.set(key, index);
    }
  });

  return errors;
};

export const ConnectionPicker = ({
  integrationId,
  toolService,
  multipleAllowed,
  connections,
  onChange,
  disabled,
}: ConnectionPickerProps) => {
  const authorize = useAuthorize();
  const existing = useExistingConnections(integrationId, toolService);
  const fieldsQuery = useConnectionFields(integrationId, toolService);
  const fields = useMemo<ConnectionField[]>(
    () => (fieldsQuery.data?.fields ?? []) as ConnectionField[],
    [fieldsQuery.data?.fields],
  );
  const requiresFields = fields.length > 0;

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showFieldForm, setShowFieldForm] = useState(false);
  // Label draft for a fresh OAuth-created connection. We collect it before
  // launching the popup so the server can upsert `tool_connections` with the
  // user's chosen name in the same round-trip.
  const [newLabelDraft, setNewLabelDraft] = useState('');

  const fieldFormError = useMemo(() => {
    if (!requiresFields) return undefined;
    for (const f of fields) {
      if (f.required && !(fieldValues[f.name] ?? '').trim()) {
        return `${f.displayName || f.name} is required`;
      }
    }
    return undefined;
  }, [requiresFields, fields, fieldValues]);

  const coerceFieldValues = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = fieldValues[f.name];
      if (raw === undefined || raw === '') continue;
      if (f.type === 'number') {
        const n = Number(raw);
        if (!Number.isNaN(n)) out[f.name] = n;
      } else if (f.type === 'boolean') {
        out[f.name] = raw === 'true';
      } else {
        out[f.name] = raw;
      }
    }
    return out;
  };

  const pinnedIds = useMemo(() => new Set(connections.map(c => c.connectionId)), [connections]);

  // Existing provider connections that are not yet pinned to this agent
  // for this toolService. Driven by the picker UI's "Use existing connection"
  // affordance — pinning one reuses the persisted account label by default
  // but the user can override it for this agent.
  const unpinnedExisting = useMemo(() => {
    const items = existing.data?.items ?? [];
    return items.filter(item => !pinnedIds.has(item.connectionId));
  }, [existing.data?.items, pinnedIds]);

  // Per-row label drafts for the unpinned existing list. Kept in local state
  // so typing doesn't churn parent form state until the user clicks "Pin".
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const errorsByIndex = useMemo(() => {
    const map = new Map<number, string>();
    for (const err of validateLabels(connections)) {
      if (!map.has(err.index)) map.set(err.index, err.message);
    }
    return map;
  }, [connections]);

  // Labels become *required* once we'd cross into multi-connection territory
  // for this `toolService` (i.e. pinning would result in ≥2 connections).
  const labelWouldBeRequired = connections.length >= 1;

  const validateDraft = (label: string): string | undefined => {
    const trimmed = label.trim();
    if (trimmed.length === 0) {
      return labelWouldBeRequired ? 'Label is required when you have multiple connections' : undefined;
    }
    if (trimmed.length > MAX_LABEL) return `Label must be ≤${MAX_LABEL} characters`;
    if (!LABEL_RE.test(trimmed)) return 'Use letters, numbers, spaces, _ or -';
    const key = trimmed.toLowerCase();
    if (connections.some(c => (c.label ?? '').trim().toLowerCase() === key)) {
      return 'Duplicate label';
    }
    return undefined;
  };

  const handlePinExisting = (connectionId: string) => {
    const override = (drafts[connectionId] ?? '').trim();
    if (validateDraft(override)) return;
    // Inherit the persisted account label from `tool_connections` when the
    // user did not type a per-agent override. Without this, the second agent
    // pinning the same account would lose the name we stored under #1.
    const persisted = (existing.data?.items ?? []).find(c => c.connectionId === connectionId)?.label ?? undefined;
    const label = override || persisted || undefined;
    onChange([...connections, { connectionId, toolService, ...(label ? { label } : {}) }]);
    setDrafts(prev => {
      const next = { ...prev };
      delete next[connectionId];
      return next;
    });
  };

  const newDraftError = useMemo(() => {
    const trimmed = newLabelDraft.trim();
    if (trimmed.length === 0) {
      return labelWouldBeRequired ? 'Label is required when you have multiple connections' : undefined;
    }
    if (trimmed.length > MAX_LABEL) return `Label must be ≤${MAX_LABEL} characters`;
    if (!LABEL_RE.test(trimmed)) return 'Use letters, numbers, spaces, _ or -';
    const key = trimmed.toLowerCase();
    if (connections.some(c => (c.label ?? '').trim().toLowerCase() === key)) {
      return 'Duplicate label';
    }
    return undefined;
  }, [newLabelDraft, labelWouldBeRequired, connections]);

  const handleAdd = async () => {
    // If the provider declares additional fields (e.g. Confluence subdomain),
    // surface an inline form first instead of jumping straight to OAuth.
    if (requiresFields && !showFieldForm) {
      setShowFieldForm(true);
      return;
    }
    if (fieldFormError) return;
    if (newDraftError) return;
    const config = requiresFields ? coerceFieldValues() : undefined;
    const label = newLabelDraft.trim();
    const result = await authorize.mutateAsync({
      integrationId,
      toolService,
      ...(config ? { config } : {}),
      ...(label ? { label } : {}),
    });
    if (result.status !== 'completed') return;
    // Carry the label onto the pin so the LLM-facing suffix matches the
    // persisted account name out of the gate. Empty labels are fine in
    // single-connection territory and `validateLabels` will surface the
    // required-label error once a second connection appears.
    onChange([...connections, { connectionId: result.connectionId, toolService, ...(label ? { label } : {}) }]);
    setShowFieldForm(false);
    setFieldValues({});
    setNewLabelDraft('');
  };

  const handleReauthorize = async (index: number) => {
    const existing = connections[index];
    if (!existing) return;
    const result = await authorize.mutateAsync({
      integrationId,
      toolService,
      connectionId: existing.connectionId,
    });
    if (result.status !== 'completed') return;
    const next = [...connections];
    next[index] = { ...existing, connectionId: result.connectionId };
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(connections.filter((_, i) => i !== index));
  };

  const handleLabelChange = (index: number, label: string) => {
    const next = [...connections];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, label };
    onChange(next);
  };

  const canAddMore = multipleAllowed || connections.length === 0;
  const showAddButton = multipleAllowed;

  const renderExistingSection = () => {
    if (!multipleAllowed && connections.length > 0) return null;
    if (unpinnedExisting.length === 0) return null;

    return (
      <div
        className="flex flex-col gap-2 rounded-md border border-border-default/60 bg-surface-2/30 px-3 py-2"
        data-testid={`connection-picker-${toolService}-existing`}
      >
        <div className="flex items-center gap-2">
          <Link2 className="size-3 text-icon-muted" />
          <Txt as="span" variant="ui-xs" className="text-text-muted">
            {labelWouldBeRequired
              ? 'Use an existing connection — give it a label for this agent.'
              : 'Use an existing connection — optionally label it for this agent.'}
          </Txt>
        </div>
        {unpinnedExisting.map(item => {
          const draft = drafts[item.connectionId] ?? '';
          const error = draft.length === 0 ? undefined : validateDraft(draft);
          const inactive = item.status !== 'active';
          const persistedLabel = item.label ?? undefined;
          const placeholder = persistedLabel
            ? `${persistedLabel} (inherits account name)`
            : `Label for ${item.connectionId.slice(0, 12)}…`;
          return (
            <div
              key={item.connectionId}
              className="flex items-center gap-2"
              data-testid={`connection-existing-${toolService}-${item.connectionId}`}
            >
              <div className="flex-1">
                <Input
                  size="sm"
                  value={draft}
                  placeholder={placeholder}
                  onChange={e => setDrafts(prev => ({ ...prev, [item.connectionId]: e.target.value }))}
                  disabled={disabled || inactive}
                  error={Boolean(error)}
                  aria-invalid={Boolean(error)}
                  data-testid={`connection-existing-label-${toolService}-${item.connectionId}`}
                />
                {error && <p className="text-error text-ui-xs mt-1 block">{error}</p>}
                {inactive && (
                  <p className="text-text-muted text-ui-xs mt-1 block">
                    Status: {item.status} — reconnect before pinning.
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePinExisting(item.connectionId)}
                disabled={disabled || inactive || Boolean(error) || (labelWouldBeRequired && draft.trim().length === 0)}
                data-testid={`connection-existing-pin-${toolService}-${item.connectionId}`}
              >
                Pin
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFieldForm = () => {
    if (!requiresFields || !showFieldForm) return null;
    return (
      <div
        className="flex flex-col gap-2 rounded-md border border-border-default/60 bg-surface-2/30 px-3 py-2"
        data-testid={`connection-picker-${toolService}-fields`}
      >
        <Txt as="span" variant="ui-xs" className="text-text-muted">
          This connection needs a few extra details before we can start OAuth.
        </Txt>
        {fields.map(f => (
          <div key={f.name} className="flex flex-col gap-1">
            <label className="text-text-muted text-ui-xs">
              {f.displayName || f.name}
              {f.required && <span className="text-error"> *</span>}
            </label>
            <Input
              size="sm"
              value={fieldValues[f.name] ?? ''}
              placeholder={f.description ?? f.displayName ?? f.name}
              onChange={e => setFieldValues(prev => ({ ...prev, [f.name]: e.target.value }))}
              disabled={disabled || authorize.isPending}
              data-testid={`connection-field-${toolService}-${f.name}`}
            />
            {f.description && <p className="text-text-muted text-ui-xs">{f.description}</p>}
          </div>
        ))}
        {fieldFormError && <p className="text-error text-ui-xs">{fieldFormError}</p>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" data-testid={`connection-picker-${toolService}`}>
      {renderExistingSection()}
      {renderFieldForm()}
      {connections.length === 0 ? (
        <div
          className="flex flex-col gap-2 rounded-md border border-dashed border-warning/40 bg-warning/5 px-3 py-2"
          data-testid={`connection-picker-${toolService}-empty`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-warning" />
            <Txt as="span" variant="ui-sm" className="text-warning">
              No connections yet — name your account and connect to enable these tools.
            </Txt>
          </div>
          {canAddMore && (
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  size="sm"
                  value={newLabelDraft}
                  placeholder="Account name (e.g. Work, Personal)"
                  onChange={e => setNewLabelDraft(e.target.value)}
                  disabled={disabled || authorize.isPending}
                  error={Boolean(newDraftError) && newLabelDraft.length > 0}
                  aria-invalid={Boolean(newDraftError) && newLabelDraft.length > 0}
                  data-testid={`connection-new-label-${toolService}`}
                />
                {newDraftError && newLabelDraft.length > 0 && (
                  <p className="text-error text-ui-xs mt-1 block">{newDraftError}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAdd}
                disabled={disabled || authorize.isPending || Boolean(newDraftError)}
              >
                <Plus className="size-3" />
                Connect
              </Button>
            </div>
          )}
        </div>
      ) : (
        connections.map((conn, index) => {
          const error = errorsByIndex.get(index);
          // Hide the label input entirely when there's a single, valid,
          // unlabeled connection. Adding a second row will flip
          // `connections.length >= 2` and bring the inputs back so the user
          // can label both.
          const showLabelInput = connections.length >= 2 || Boolean(conn.label) || Boolean(error);
          return (
            <div
              key={conn.connectionId}
              className="flex items-center gap-2"
              data-testid={`connection-row-${toolService}-${index}`}
            >
              <div className="flex-1">
                {showLabelInput ? (
                  <>
                    <Input
                      size="sm"
                      value={conn.label ?? ''}
                      placeholder={multipleAllowed ? 'Label (e.g. Work, Personal)' : 'Label'}
                      onChange={e => handleLabelChange(index, e.target.value)}
                      disabled={disabled}
                      error={Boolean(error)}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `connection-row-${toolService}-${index}-error` : undefined}
                      data-testid={`connection-label-${toolService}-${index}`}
                    />
                    {error && (
                      <p
                        id={`connection-row-${toolService}-${index}-error`}
                        className="text-error text-ui-xs mt-1 block"
                      >
                        {error}
                      </p>
                    )}
                  </>
                ) : (
                  <Txt
                    as="span"
                    variant="ui-sm"
                    className="text-text-muted"
                    data-testid={`connection-summary-${toolService}-${index}`}
                  >
                    Connected
                  </Txt>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleReauthorize(index)}
                disabled={disabled || authorize.isPending}
                aria-label="Reauthorize"
                data-testid={`connection-reauthorize-${toolService}-${index}`}
              >
                <RefreshCw className="size-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                aria-label="Remove connection"
                data-testid={`connection-remove-${toolService}-${index}`}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          );
        })
      )}

      {showAddButton && connections.length > 0 && (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <Input
              size="sm"
              value={newLabelDraft}
              placeholder="Account name for the new connection"
              onChange={e => setNewLabelDraft(e.target.value)}
              disabled={disabled || authorize.isPending}
              error={Boolean(newDraftError) && newLabelDraft.length > 0}
              aria-invalid={Boolean(newDraftError) && newLabelDraft.length > 0}
              data-testid={`connection-new-label-${toolService}`}
            />
            {newDraftError && newLabelDraft.length > 0 && (
              <p className="text-error text-ui-xs mt-1 block">{newDraftError}</p>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAdd}
            disabled={disabled || authorize.isPending || Boolean(newDraftError)}
            className={cn('self-start')}
            data-testid={`connection-add-${toolService}`}
          >
            <Plus className="size-3" />
            Add connection
          </Button>
        </div>
      )}
    </div>
  );
};
