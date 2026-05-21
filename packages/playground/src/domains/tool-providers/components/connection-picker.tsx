import { AlertDialog, Badge, Button, DropdownMenu, Input, Txt, cn } from '@mastra/playground-ui';
import { AlertCircle, Link2, MoreVertical, Plus, RefreshCw, Trash2, Unlink2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuthorize } from '../hooks/use-authorize';
import { useConnectionFields } from '../hooks/use-connection-fields';
import { useConnectionUsage } from '../hooks/use-connection-usage';
import { useDisconnectConnection } from '../hooks/use-disconnect-connection';
import { useInfiniteConnections } from '../hooks/use-infinite-connections';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

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
 * Phase 7 persists to `toolProviders[providerId].connections[]`.
 */
export interface PickerConnection {
  connectionId: string;
  toolkit: string;
  /**
   * Optional when this is the only connection on `toolkit`. Required
   * (non-empty, unique within the service) once a second connection is
   * added — see `validateLabels`.
   */
  label?: string;
  /**
   * Ownership scope of the OAuth bucket. `'per-author'` (default) buckets
   * under the caller's authorId; `'shared'` buckets under `SHARED_BUCKET_ID`
   * so other editors on the same Mastra can resolve the same account.
   * `'caller-supplied'` defers bucketing to `MASTRA_RESOURCE_ID_KEY` on the
   * request context at runtime (multi-tenant SaaS).
   * Absent on legacy rows; runtime treats undefined as `'per-author'`.
   */
  scope?: 'per-author' | 'shared' | 'caller-supplied';
}

export interface ConnectionPickerProps {
  providerId: string;
  toolkit: string;
  /** From `useToolProviders()[i].capabilities`. */
  multipleAllowed: boolean;
  /** From `integration.capabilities.supportsRevoke`. Gates the Disconnect menu item. */
  supportsRevoke?: boolean;
  /** Controlled value. */
  connections: PickerConnection[];
  /** Controlled change. */
  onChange: (next: PickerConnection[]) => void;
  /** Disable inputs while parent form is busy. */
  disabled?: boolean;
  /**
   * Whitelist of scopes the host exposes in the Visibility toggle. Users
   * must explicitly pick one before they can connect — there is no default.
   *
   * - Omit (or pass `[]`) → no toggle, pins land without a `scope` field
   *   (legacy behavior; runtime treats absent as `per-author`).
   * - Provide a subset (e.g. `['per-author', 'shared']` for builder) → only
   *   those radios render, and existing pinned/listed rows whose stored
   *   scope is outside the whitelist are filtered out so the picker stays
   *   internally consistent.
   */
  allowedScopes?: readonly ('per-author' | 'shared' | 'caller-supplied')[];
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
  // generic suffix. Once two or more connections share a `toolkit`
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
  providerId,
  toolkit,
  multipleAllowed,
  supportsRevoke = false,
  connections,
  onChange,
  disabled,
  allowedScopes,
}: ConnectionPickerProps) => {
  // When the host opts in to scope (by providing a non-empty `allowedScopes`),
  // expose a Visibility toggle on the add-connection form. The user must
  // explicitly pick a scope before "Connect" enables — there is no default.
  // Hosts that omit it see no toggle and never produce a `scope` field on
  // the pin.
  const scopeToggleEnabled = Boolean(allowedScopes && allowedScopes.length > 0);
  const allowedScopeSet = useMemo(() => new Set(allowedScopes ?? []), [allowedScopes]);
  // When the host locks the surface to a single scope (e.g. builder → per-author,
  // editor → caller-supplied), there's nothing to pick — auto-select it and
  // hide the radios. Multi-scope hosts still force the user to choose.
  const lockedScope = useMemo<'per-author' | 'shared' | 'caller-supplied' | null>(() => {
    if (allowedScopes && allowedScopes.length === 1) return allowedScopes[0]!;
    return null;
  }, [allowedScopes]);
  const authorize = useAuthorize();
  const disconnect = useDisconnectConnection();
  const { data: currentUser } = useCurrentUser();
  const callerId = currentUser?.id;

  const existing = useInfiniteConnections(providerId, toolkit, {
    // When the surface is locked to a single scope, push that filter to the
    // server so cross-scope rows never come back in the first place.
    ...(lockedScope ? { scope: lockedScope } : {}),
  });
  const existingItems = useMemo(
    () => (existing.data?.pages ?? []).flatMap(page => page.items ?? []),
    [existing.data?.pages],
  );
  const fieldsQuery = useConnectionFields(providerId, toolkit);
  const fields = useMemo<ConnectionField[]>(
    () => (fieldsQuery.data?.fields ?? []) as ConnectionField[],
    [fieldsQuery.data?.fields],
  );
  const requiresFields = fields.length > 0;

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showFieldForm, setShowFieldForm] = useState(false);
  // Label draft for a fresh OAuth-created connection. We collect it before
  // launching the popup so the server can upsert `tool_integration_connections` with the
  // user's chosen name in the same round-trip.
  const [newLabelDraft, setNewLabelDraft] = useState('');
  // Scope draft for the next fresh connection. Only meaningful when the host
  // opts in via `allowedScopes`. Starts `null` so the user is forced to pick
  // a scope before connecting; reset back to `null` after every successful
  // authorize so the next add starts unselected too.
  const [newScopeDraft, setNewScopeDraft] = useState<'per-author' | 'shared' | 'caller-supplied' | null>(lockedScope);

  // Keep the draft in sync if `allowedScopes` changes at runtime (e.g. host
  // narrows scopes after mount). When locked, force the draft to the locked
  // value; when unlocked, only seed if the user hasn't picked yet.
  useEffect(() => {
    if (lockedScope) {
      setNewScopeDraft(prev => (prev === lockedScope ? prev : lockedScope));
    }
  }, [lockedScope]);

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
  // for this toolkit. Driven by the picker UI's "Use existing connection"
  // affordance — pinning one reuses the persisted account label by default
  // but the user can override it for this agent. When the host whitelists
  // scopes (e.g. builder hides `caller-supplied`), rows whose stored scope
  // is outside the whitelist are filtered out so they can't be pinned into
  // a surface that doesn't model them.
  const unpinnedExisting = useMemo(
    () =>
      existingItems
        .filter(item => !pinnedIds.has(item.connectionId))
        .filter(item => {
          if (!scopeToggleEnabled) return true;
          const itemScope = (item.scope as 'per-author' | 'shared' | 'caller-supplied' | undefined) ?? 'per-author';
          return allowedScopeSet.has(itemScope);
        }),
    [existingItems, pinnedIds, scopeToggleEnabled, allowedScopeSet],
  );

  const errorsByIndex = useMemo(() => {
    const map = new Map<number, string>();
    for (const err of validateLabels(connections)) {
      if (!map.has(err.index)) map.set(err.index, err.message);
    }
    return map;
  }, [connections]);

  // Labels become *required* once we'd cross into multi-connection territory
  // for this `toolkit` (i.e. pinning would result in ≥2 connections).
  const labelWouldBeRequired = connections.length >= 1;

  const handlePinExisting = (connectionId: string) => {
    // Per-agent label override has been removed. Always inherit the persisted
    // account label from `tool_integration_connections`. The picker only allows pinning
    // when this label doesn't collide with an already-pinned row (see the
    // disabled-state check on the Pin button).
    const item = existingItems.find(c => c.connectionId === connectionId);
    const label = item?.label ?? undefined;
    // Inherit the persisted scope so a row stored under SHARED_BUCKET_ID
    // keeps resolving from the shared bucket once pinned. Absent on legacy
    // rows; falls through and runtime treats as per-author.
    const scope = (item?.scope as 'per-author' | 'shared' | 'caller-supplied' | undefined) ?? undefined;
    if (!label && labelWouldBeRequired) return;
    if (label) {
      const key = label.trim().toLowerCase();
      if (connections.some(c => (c.label ?? '').trim().toLowerCase() === key)) return;
    }
    onChange([
      ...connections,
      {
        connectionId,
        toolkit,
        ...(label ? { label } : {}),
        ...(scope ? { scope } : {}),
      },
    ]);
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

  const renderScopeToggle = () => {
    if (!scopeToggleEnabled) return null;
    // Single-scope surfaces lock the value — there's nothing to pick. The
    // draft is auto-seeded to the locked scope so "Connect" enables without
    // user interaction.
    if (lockedScope) return null;
    const baseId = `connection-scope-${toolkit}`;
    const options: Array<{
      value: 'per-author' | 'shared' | 'caller-supplied';
      label: string;
    }> = [
      { value: 'per-author', label: 'Only me' },
      { value: 'shared', label: 'Shared with editors' },
      { value: 'caller-supplied', label: 'Caller-supplied (multi-tenant)' },
    ];
    return (
      <div
        role="radiogroup"
        aria-label="Connection visibility"
        className="flex items-center gap-3 text-ui-xs text-icon3"
        data-testid={baseId}
      >
        <span className="font-medium">Visibility:</span>
        {options
          .filter(opt => allowedScopeSet.has(opt.value))
          .map(opt => (
            <label key={opt.value} className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name={baseId}
                value={opt.value}
                checked={newScopeDraft === opt.value}
                disabled={disabled || authorize.isPending}
                onChange={() => setNewScopeDraft(opt.value)}
                data-testid={`${baseId}-${opt.value}`}
              />
              <span>{opt.label}</span>
            </label>
          ))}
      </div>
    );
  };

  const handleAdd = async () => {
    // If the provider declares additional fields (e.g. Confluence subdomain),
    // surface an inline form first instead of jumping straight to OAuth.
    if (requiresFields && !showFieldForm) {
      setShowFieldForm(true);
      return;
    }
    if (fieldFormError) return;
    if (newDraftError) return;
    // When the host opts in to the scope toggle, the user must pick a scope
    // before "Connect" enables. The button's disabled state already enforces
    // this; the early-return is a defensive backstop.
    if (scopeToggleEnabled && newScopeDraft === null) return;
    const config = requiresFields ? coerceFieldValues() : undefined;
    const label = newLabelDraft.trim();
    // Only forward scope when the host opts in. Omitting scope on hosts that
    // don't render the toggle keeps stored agents from accidentally pinning
    // shared connections under a per-author bucket.
    const scope = scopeToggleEnabled ? (newScopeDraft ?? undefined) : undefined;
    const result = await authorize.mutateAsync({
      providerId,
      toolkit,
      ...(config ? { config } : {}),
      ...(label ? { label } : {}),
      ...(scope ? { scope } : {}),
    });
    if (result.status !== 'completed') return;
    // Carry the label onto the pin so the LLM-facing suffix matches the
    // persisted account name out of the gate. Empty labels are fine in
    // single-connection territory and `validateLabels` will surface the
    // required-label error once a second connection appears.
    onChange([
      ...connections,
      {
        connectionId: result.connectionId,
        toolkit,
        ...(label ? { label } : {}),
        ...(scope ? { scope } : {}),
      },
    ]);
    setShowFieldForm(false);
    setFieldValues({});
    setNewLabelDraft('');
    // Reset the scope draft so the next add forces the user to pick again.
    if (scopeToggleEnabled) setNewScopeDraft(null);
  };

  const handleReauthorize = async (index: number) => {
    const existing = connections[index];
    if (!existing) return;
    const result = await authorize.mutateAsync({
      providerId,
      toolkit,
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

  // Sentinel `connectionId` for caller-supplied pins. No OAuth happens
  // in the editor — the actual Composio connected account is created
  // at runtime under `ctx[MASTRA_RESOURCE_ID_KEY]` when an end-user
  // exercises the tool through the host app.
  const CALLER_SUPPLIED_SENTINEL = 'caller-supplied';

  const handleAddCallerSupplied = () => {
    // Caller-supplied pins are markers — they declare "this toolkit
    // resolves via request-context resourceId". Label is intentionally
    // omitted; the host app owns end-user identity.
    if (connections.some(c => c.scope === 'caller-supplied')) return;
    onChange([
      ...connections,
      {
        connectionId: CALLER_SUPPLIED_SENTINEL,
        toolkit,
        scope: 'caller-supplied',
      },
    ]);
  };

  const handleLabelChange = (index: number, label: string) => {
    const next = [...connections];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, label };
    onChange(next);
  };

  // Disconnect confirm flow. We don't pre-check usage server-side here;
  // instead the dialog renders the count from `useConnectionUsage` so
  // the user knows how many *other* agents will lose this account.
  const [disconnectTargetId, setDisconnectTargetId] = useState<string | null>(null);
  const usageQuery = useConnectionUsage(providerId, disconnectTargetId, !!disconnectTargetId);
  const otherAgentCount = useMemo(() => {
    if (!disconnectTargetId) return 0;
    // The current agent isn't saved yet (it's just a form pin), so the
    // server-side scan only sees *other* agents that already pin this
    // connection. No subtraction needed.
    return usageQuery.data?.agents?.length ?? 0;
  }, [usageQuery.data?.agents, disconnectTargetId]);
  // When disconnecting a connection owned by another author, surface the
  // owner id in the confirm dialog so admin actions aren't silent.
  const disconnectTargetOwnerId = useMemo(() => {
    if (!disconnectTargetId) return undefined;
    const owner = existingItems.find(item => item.connectionId === disconnectTargetId)?.authorId;
    if (!owner) return undefined;
    if (callerId && owner === callerId) return undefined;
    return owner;
  }, [disconnectTargetId, existingItems, callerId]);

  const confirmDisconnect = async () => {
    if (!disconnectTargetId) return;
    await disconnect.mutateAsync({ providerId, connectionId: disconnectTargetId, force: true });
    onChange(connections.filter(c => c.connectionId !== disconnectTargetId));
    setDisconnectTargetId(null);
  };

  const canAddMore = multipleAllowed || connections.length === 0;
  const showAddButton = multipleAllowed;

  const renderExistingSection = () => {
    if (!multipleAllowed && connections.length > 0) return null;
    // Caller-supplied pins are markers — pinning an existing connection
    // makes no sense because end-user accounts are created at runtime
    // by the host app, not pre-listed in the editor.
    if (newScopeDraft === 'caller-supplied') return null;
    if (unpinnedExisting.length === 0) return null;

    return (
      <div
        className="flex flex-col gap-2 rounded-md border border-border-default/60 bg-surface-2/30 px-3 py-2"
        data-testid={`connection-picker-${toolkit}-existing`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link2 className="size-3 text-icon-muted" />
            <Txt as="span" variant="ui-xs" className="text-text-muted">
              Pin an existing connection to this agent.
            </Txt>
          </div>
        </div>
        {unpinnedExisting.map(item => {
          const persistedLabel = item.label ?? undefined;
          // No per-agent override: we always inherit the persisted account
          // label. The only blocker is a label collision with an already
          // pinned row, which the user can resolve by unpinning the other row.
          const duplicate =
            persistedLabel !== undefined &&
            connections.some(c => (c.label ?? '').trim().toLowerCase() === persistedLabel.trim().toLowerCase());
          const error = duplicate
            ? 'Already pinned under this label'
            : !persistedLabel && labelWouldBeRequired
              ? 'Label is required when you have multiple connections'
              : undefined;
          const inactive = item.status !== 'active';
          const displayName = persistedLabel ?? `${item.connectionId.slice(0, 12)}…`;
          // Show an owner badge only on rows whose authorId differs from
          // the caller. The inline picker never surfaces cross-author rows
          // today (the admin filter has been removed), but the server-side
          // admin author filter can still hand them to a future global page.
          const isCrossAuthor = Boolean(item.authorId && callerId && item.authorId !== callerId);
          return (
            <div
              key={item.connectionId}
              className="flex items-center gap-2"
              data-testid={`connection-existing-${toolkit}-${item.connectionId}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Txt
                    as="span"
                    variant="ui-sm"
                    className="text-text-default"
                    data-testid={`connection-existing-label-${toolkit}-${item.connectionId}`}
                  >
                    {displayName}
                  </Txt>
                  {isCrossAuthor && item.authorId && (
                    <Badge variant="default" data-testid={`connection-existing-owner-${toolkit}-${item.connectionId}`}>
                      {item.authorId}
                    </Badge>
                  )}
                  {item.scope === 'shared' && (
                    <Badge variant="info" data-testid={`connection-existing-shared-${toolkit}-${item.connectionId}`}>
                      Shared
                    </Badge>
                  )}
                </div>
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
                disabled={disabled || inactive || Boolean(error)}
                data-testid={`connection-existing-pin-${toolkit}-${item.connectionId}`}
              >
                Pin
              </Button>
            </div>
          );
        })}
        {existing.hasNextPage && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => existing.fetchNextPage()}
            disabled={existing.isFetchingNextPage}
            data-testid={`connection-existing-load-more-${toolkit}`}
          >
            {existing.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        )}
      </div>
    );
  };

  const renderFieldForm = () => {
    if (!requiresFields || !showFieldForm) return null;
    return (
      <div
        className="flex flex-col gap-2 rounded-md border border-border-default/60 bg-surface-2/30 px-3 py-2"
        data-testid={`connection-picker-${toolkit}-fields`}
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
              data-testid={`connection-field-${toolkit}-${f.name}`}
            />
            {f.description && <p className="text-text-muted text-ui-xs">{f.description}</p>}
          </div>
        ))}
        {fieldFormError && <p className="text-error text-ui-xs">{fieldFormError}</p>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" data-testid={`connection-picker-${toolkit}`}>
      {renderExistingSection()}
      {renderFieldForm()}
      {connections.length === 0 ? (
        <div
          className="flex flex-col gap-2 rounded-md border border-dashed border-warning/40 bg-warning/5 px-3 py-2"
          data-testid={`connection-picker-${toolkit}-empty`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-warning" />
            <Txt as="span" variant="ui-sm" className="text-warning">
              {scopeToggleEnabled && newScopeDraft === null
                ? 'Pick a visibility to start a new connection.'
                : newScopeDraft === 'caller-supplied'
                  ? 'No marker yet — mark this toolkit as caller-supplied so the host app resolves end-user connections at runtime.'
                  : 'No connections yet — name your account and connect to enable these tools.'}
            </Txt>
          </div>
          {canAddMore && (
            <div className="flex flex-col gap-2">
              {renderScopeToggle()}
              {scopeToggleEnabled && newScopeDraft === null ? null : newScopeDraft === 'caller-supplied' ? (
                <div className="flex flex-col gap-2" data-testid={`connection-caller-supplied-${toolkit}`}>
                  <Txt as="span" variant="ui-xs" className="text-text-muted">
                    Tools resolve via <code>requestContext.set(MASTRA_RESOURCE_ID_KEY, &lt;userId&gt;)</code>. Each
                    end-user gets their own OAuth flow on first use through your host app.
                  </Txt>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddCallerSupplied}
                    disabled={disabled}
                    data-testid={`connection-mark-caller-supplied-${toolkit}`}
                  >
                    <Plus className="size-3" />
                    Mark caller-supplied
                  </Button>
                </div>
              ) : (
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
                      data-testid={`connection-new-label-${toolkit}`}
                    />
                    {newDraftError && newLabelDraft.length > 0 && (
                      <p className="text-error text-ui-xs mt-1 block">{newDraftError}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAdd}
                    disabled={
                      disabled ||
                      authorize.isPending ||
                      Boolean(newDraftError) ||
                      (scopeToggleEnabled && newScopeDraft === null)
                    }
                    data-testid={`connection-connect-${toolkit}`}
                  >
                    <Plus className="size-3" />
                    Connect
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        connections.map((conn, index) => {
          const error = errorsByIndex.get(index);
          const isCallerSupplied = conn.scope === 'caller-supplied';
          // Hide the label input entirely when there's a single, valid,
          // unlabeled connection. Adding a second row will flip
          // `connections.length >= 2` and bring the inputs back so the user
          // can label both. Caller-supplied pins never show a label.
          const showLabelInput =
            !isCallerSupplied && (connections.length >= 2 || Boolean(conn.label) || Boolean(error));
          return (
            <div
              key={conn.connectionId}
              className="flex items-center gap-2"
              data-testid={`connection-row-${toolkit}-${index}`}
            >
              <div className="flex-1">
                {isCallerSupplied ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="info" data-testid={`connection-caller-supplied-badge-${toolkit}-${index}`}>
                      Caller-supplied
                    </Badge>
                    <Txt as="span" variant="ui-xs" className="text-text-muted">
                      Resolved at runtime from request context.
                    </Txt>
                  </div>
                ) : showLabelInput ? (
                  <>
                    <Input
                      size="sm"
                      value={conn.label ?? ''}
                      placeholder={multipleAllowed ? 'Label (e.g. Work, Personal)' : 'Label'}
                      onChange={e => handleLabelChange(index, e.target.value)}
                      disabled={disabled}
                      error={Boolean(error)}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `connection-row-${toolkit}-${index}-error` : undefined}
                      data-testid={`connection-label-${toolkit}-${index}`}
                    />
                    {error && (
                      <p id={`connection-row-${toolkit}-${index}-error`} className="text-error text-ui-xs mt-1 block">
                        {error}
                      </p>
                    )}
                  </>
                ) : (
                  <Txt
                    as="span"
                    variant="ui-sm"
                    className="text-text-muted"
                    data-testid={`connection-summary-${toolkit}-${index}`}
                  >
                    Connected
                  </Txt>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    aria-label="Connection actions"
                    data-testid={`connection-actions-${toolkit}-${index}`}
                  >
                    <MoreVertical className="size-3" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  {!isCallerSupplied && (
                    <DropdownMenu.Item
                      onSelect={() => handleReauthorize(index)}
                      disabled={disabled || authorize.isPending}
                      data-testid={`connection-reauthorize-${toolkit}-${index}`}
                    >
                      <RefreshCw />
                      Reauthorize
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item
                    onSelect={() => handleRemove(index)}
                    disabled={disabled}
                    data-testid={`connection-unpin-${toolkit}-${index}`}
                  >
                    <Unlink2 />
                    Unpin from this agent
                  </DropdownMenu.Item>
                  {supportsRevoke && !isCallerSupplied && (
                    <>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        onSelect={() => setDisconnectTargetId(conn.connectionId)}
                        disabled={disabled}
                        className="text-error"
                        data-testid={`connection-disconnect-${toolkit}-${index}`}
                      >
                        <Trash2 />
                        Disconnect everywhere
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          );
        })
      )}

      <AlertDialog open={!!disconnectTargetId} onOpenChange={open => !open && setDisconnectTargetId(null)}>
        <AlertDialog.Content data-testid={`connection-disconnect-dialog-${toolkit}`}>
          <AlertDialog.Header>
            <AlertDialog.Title>Disconnect this account?</AlertDialog.Title>
            <AlertDialog.Description>
              This revokes the connection at the provider and removes the saved row. The connection is currently pinned
              by <strong data-testid={`connection-disconnect-usage-${toolkit}`}>{otherAgentCount}</strong> other agent
              {otherAgentCount === 1 ? '' : 's'}. Those agents will lose access to this account&apos;s tools.
              {disconnectTargetOwnerId && (
                <>
                  {' '}
                  <span data-testid={`connection-disconnect-owner-${toolkit}`}>
                    Owned by <strong>{disconnectTargetOwnerId}</strong>.
                  </span>
                </>
              )}
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel data-testid={`connection-disconnect-cancel-${toolkit}`}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={confirmDisconnect}
              disabled={disconnect.isPending}
              data-testid={`connection-disconnect-confirm-${toolkit}`}
            >
              Disconnect
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>

      {showAddButton && connections.length > 0 && newScopeDraft !== 'caller-supplied' && (
        <div className="flex flex-col gap-2">
          {renderScopeToggle()}
          {scopeToggleEnabled && newScopeDraft === null ? (
            <Txt as="span" variant="ui-xs" className="text-text-muted">
              Pick a visibility to add another connection.
            </Txt>
          ) : (
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
                  data-testid={`connection-new-label-${toolkit}`}
                />
                {newDraftError && newLabelDraft.length > 0 && (
                  <p className="text-error text-ui-xs mt-1 block">{newDraftError}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAdd}
                disabled={
                  disabled ||
                  authorize.isPending ||
                  Boolean(newDraftError) ||
                  (scopeToggleEnabled && newScopeDraft === null)
                }
                className={cn('self-start')}
                data-testid={`connection-add-${toolkit}`}
              >
                <Plus className="size-3" />
                Add connection
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
