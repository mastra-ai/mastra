import { useEffect, useState } from 'react';

import { PlusIcon } from './icons';

interface CustomProviderInfo {
  id: string;
  name: string;
  url: string;
  hasApiKey: boolean;
  models: string[];
}

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
export function CustomProvidersSection({ baseUrl = '' }: { baseUrl?: string }) {
  const [providers, setProviders] = useState<CustomProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/web/config/custom-providers`);
      if (!res.ok) throw new Error(`Failed to load custom providers (${res.status})`);
      const data = (await res.json()) as { providers: CustomProviderInfo[] };
      setProviders(data.providers ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [baseUrl]);

  const startAdd = () => setDraft({ ...EMPTY_DRAFT });
  const startEdit = (p: CustomProviderInfo) =>
    setDraft({ editingId: p.id, name: p.name, url: p.url, apiKey: '', models: p.models.join(', ') });

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const url = draft.url.trim();
    if (!name || !url) {
      setError('Name and URL are required.');
      return;
    }
    const models = draft.models
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);
    setBusy(true);
    try {
      const res = await fetch(`${baseUrl}/api/web/config/custom-providers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          apiKey: draft.apiKey.trim() || undefined,
          models,
          previousId: draft.editingId || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed to save provider (${res.status})`);
      }
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`${baseUrl}/api/web/config/custom-providers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed to remove provider (${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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
