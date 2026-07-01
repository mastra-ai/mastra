import { useState } from 'react';

import type { CustomProviderInfo } from '../../shared/api/types';
import {
  useCustomProvidersQuery,
  useRemoveCustomProvider,
  useSaveCustomProvider,
} from '../../shared/hooks/use-custom-providers';
import { PlusIcon } from './icons';

interface DraftState {
  /** id of the provider being edited, or '' for a brand-new one. */
  editingId: string;
  name: string;
  url: string;
  apiKey: string;
  models: string;
}

const EMPTY_DRAFT: DraftState = { editingId: '', name: '', url: '', apiKey: '', models: '' };

/**
 * Custom OpenAI-compatible providers. Mirrors the TUI's `/custom-providers`
 * command. Backed by global settings (settings.json) on the server, not session
 * state — these are user-global endpoint definitions (name + base URL + optional
 * key + model list). Keys are write-only; the server reports only their presence.
 */
export function CustomProvidersSection() {
  const providersQuery = useCustomProvidersQuery();
  const saveMutation = useSaveCustomProvider();
  const removeMutation = useRemoveCustomProvider();

  const [draftError, setDraftError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);

  const providers = providersQuery.data ?? [];
  const loading = providersQuery.isPending;
  const busy = saveMutation.isPending || removeMutation.isPending;
  const queryError = providersQuery.error instanceof Error ? providersQuery.error.message : null;
  const error = draftError ?? queryError;

  const startAdd = () => {
    setDraftError(null);
    setDraft({ ...EMPTY_DRAFT });
  };
  const startEdit = (p: CustomProviderInfo) =>
    setDraft({ editingId: p.id, name: p.name, url: p.url, apiKey: '', models: p.models.join(', ') });

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const url = draft.url.trim();
    if (!name || !url) {
      setDraftError('Name and URL are required.');
      return;
    }
    const models = draft.models
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);
    const apiKey = draft.apiKey.trim();
    setDraftError(null);
    try {
      await saveMutation.mutateAsync({
        name,
        url,
        models,
        ...(apiKey ? { apiKey } : {}),
        ...(draft.editingId ? { previousId: draft.editingId } : {}),
      });
      setDraft(null);
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

  return (
    <div className="providers-pane">
      <div className="cprov-head">
        <p className="provider-caption">
          OpenAI-compatible endpoints. Mirrors the TUI <code>/custom-providers</code> command.
        </p>
        {!draft && (
          <button className="btn btn-sm" onClick={startAdd} disabled={busy}>
            <PlusIcon size={13} /> Add provider
          </button>
        )}
      </div>

      {error && <div className="provider-error">{error}</div>}

      {draft && (
        <div className="cprov-form">
          <label className="cprov-field">
            <span>Name</span>
            <input
              className="provider-search-input"
              placeholder="e.g. my-llm"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              autoFocus
            />
          </label>
          <label className="cprov-field">
            <span>Base URL</span>
            <input
              className="provider-search-input"
              placeholder="https://api.example.com/v1"
              value={draft.url}
              onChange={e => setDraft({ ...draft, url: e.target.value })}
            />
          </label>
          <label className="cprov-field">
            <span>API key {draft.editingId ? '(leave blank to keep)' : '(optional)'}</span>
            <input
              type="password"
              className="provider-key-input cprov-key"
              placeholder="Paste API key"
              value={draft.apiKey}
              onChange={e => setDraft({ ...draft, apiKey: e.target.value })}
            />
          </label>
          <label className="cprov-field">
            <span>Models (comma-separated)</span>
            <input
              className="provider-search-input"
              placeholder="model-a, model-b"
              value={draft.models}
              onChange={e => setDraft({ ...draft, models: e.target.value })}
            />
          </label>
          <div className="cprov-form-actions">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()}>
              {draft.editingId ? 'Save' : 'Add'}
            </button>
            <button className="btn btn-sm" disabled={busy} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="provider-loading">Loading custom providers…</div>
      ) : providers.length === 0 && !draft ? (
        <div className="provider-empty">No custom providers yet. Add one above.</div>
      ) : (
        <div className="provider-list">
          {providers.map(p => (
            <div key={p.id} className="provider-row cprov-row">
              <div className="cprov-info">
                <div className="cprov-title">
                  <span className="provider-name">{p.name}</span>
                  {p.hasApiKey && <span className="provider-pill stored">Key saved</span>}
                </div>
                <span className="cprov-url">{p.url}</span>
                {p.models.length > 0 && (
                  <span className="cprov-models">
                    {p.models.length} model{p.models.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="provider-actions">
                <button className="btn btn-sm" disabled={busy} onClick={() => startEdit(p)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void remove(p.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
