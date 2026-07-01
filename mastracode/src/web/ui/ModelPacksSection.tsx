import type { AgentControllerAvailableModel } from '@mastra/client-js';
import { useState } from 'react';

import {
  useActivateModelPack,
  useModelPacksQuery,
  useRemoveModelPack,
  useSaveModelPack,
} from '../../shared/hooks/use-model-packs';
import { CheckIcon, EditIcon, PlusIcon } from './icons';

interface DraftPack {
  name: string;
  build: string;
  plan: string;
  fast: string;
}

const EMPTY_DRAFT: DraftPack = { name: '', build: '', plan: '', fast: '' };

/**
 * Model packs. Mirrors the TUI's `/models-pack` command: a pack assigns a model
 * to each mode (build / plan / fast). Built-in packs are gated by provider
 * access; custom packs are user-defined. Activating a pack seeds the current
 * session's per-mode models — so it needs the active project's resourceId.
 */
export function ModelPacksSection({
  resourceId,
  models,
}: {
  resourceId?: string;
  models: AgentControllerAvailableModel[];
}) {
  const packsQuery = useModelPacksQuery(resourceId);
  const activateMutation = useActivateModelPack(resourceId);
  const removeMutation = useRemoveModelPack();
  const saveMutation = useSaveModelPack();

  const [draftError, setDraftError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPack | null>(null);
  /** When editing an existing custom pack, holds the original pack id so we can remove it on rename. */
  const [editingPackId, setEditingPackId] = useState<string | null>(null);

  const packs = packsQuery.data?.packs ?? [];
  const loading = packsQuery.isPending;
  const busy = activateMutation.isPending || removeMutation.isPending || saveMutation.isPending;
  const queryError = packsQuery.error instanceof Error ? packsQuery.error.message : null;
  const error = draftError ?? queryError;

  const activate = async (id: string) => {
    if (!resourceId) {
      setDraftError('Open a project first to activate a pack.');
      return;
    }
    setDraftError(null);
    try {
      await activateMutation.mutateAsync({ id });
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (id: string) => {
    setDraftError(null);
    try {
      await removeMutation.mutateAsync({ id });
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name || !draft.build || !draft.plan || !draft.fast) {
      setDraftError('Name and a model for each of build, plan and fast are required.');
      return;
    }
    setDraftError(null);
    try {
      const renamed = editingPackId && `custom:${name}` !== editingPackId;
      await saveMutation.mutateAsync({ name, models: { build: draft.build, plan: draft.plan, fast: draft.fast } });
      // Remove the old pack only after the new one is safely saved.
      if (renamed) {
        await removeMutation.mutateAsync({ id: editingPackId });
      }
      setDraft(null);
      setEditingPackId(null);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    }
  };

  const startEditing = (p: { id: string; name: string; models: { build: string; plan: string; fast: string } }) => {
    setDraftError(null);
    setEditingPackId(p.id);
    setDraft({ name: p.name, build: p.models.build, plan: p.models.plan, fast: p.models.fast });
  };

  const modelOptions = models.map(m => m.id);

  const modelSelect = (value: string, onChange: (v: string) => void) => (
    <select className="pack-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select model…</option>
      {value && !modelOptions.includes(value) && <option value={value}>{value}</option>}
      {modelOptions.map(id => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </select>
  );

  return (
    <div className="providers-pane">
      <div className="cprov-head">
        <p className="provider-caption">
          A pack sets a model for each mode (build / plan / fast). Mirrors the TUI <code>/models-pack</code> command.
        </p>
        {!draft && (
          <button
            className="btn btn-sm"
            onClick={() => {
              setEditingPackId(null);
              setDraft({ ...EMPTY_DRAFT });
            }}
            disabled={busy}
          >
            <PlusIcon size={13} /> New pack
          </button>
        )}
      </div>

      {!resourceId && <div className="provider-caption">Open a project to activate a pack on its session.</div>}
      {error && <div className="provider-error">{error}</div>}

      {draft && (
        <div className="cprov-form">
          <label className="cprov-field">
            <span>Name</span>
            <input
              className="provider-search-input"
              placeholder="e.g. my-pack"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              autoFocus
            />
          </label>
          <label className="cprov-field">
            <span>Build model</span>
            {modelSelect(draft.build, v => setDraft({ ...draft, build: v }))}
          </label>
          <label className="cprov-field">
            <span>Plan model</span>
            {modelSelect(draft.plan, v => setDraft({ ...draft, plan: v }))}
          </label>
          <label className="cprov-field">
            <span>Fast model</span>
            {modelSelect(draft.fast, v => setDraft({ ...draft, fast: v }))}
          </label>
          <div className="cprov-form-actions">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveDraft()}>
              {editingPackId ? 'Save' : 'Add'}
            </button>
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setEditingPackId(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="provider-loading">Loading model packs…</div>
      ) : packs.length === 0 && !draft ? (
        <div className="provider-empty">No model packs available. Configure provider keys or add a custom pack.</div>
      ) : (
        <div className="provider-list">
          {packs.map(p => (
            <div key={p.id} className={`provider-row pack-row ${p.active ? 'active' : ''}`}>
              <div className="cprov-info">
                <div className="cprov-title">
                  {p.active && <CheckIcon size={13} className="provider-tick stored" />}
                  <span className="provider-name">{p.name}</span>
                  {p.custom && <span className="provider-pill none">Custom</span>}
                  {p.active && <span className="provider-pill stored">Active</span>}
                </div>
                <span className="pack-models">
                  build: {p.models.build || '—'} · plan: {p.models.plan || '—'} · fast: {p.models.fast || '—'}
                </span>
              </div>
              <div className="provider-actions">
                {!p.active && (
                  <button className="btn btn-sm" disabled={busy || !resourceId} onClick={() => void activate(p.id)}>
                    Activate
                  </button>
                )}
                {p.custom && (
                  <button className="btn btn-sm" disabled={busy} onClick={() => startEditing(p)}>
                    <EditIcon size={13} /> Edit
                  </button>
                )}
                {p.custom && (
                  <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void remove(p.id)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
