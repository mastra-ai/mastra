import type { HarnessAvailableModel } from '@mastra/client-js';
import { useEffect, useState } from 'react';

import { CheckIcon, PlusIcon } from './icons';

interface ModelPackInfo {
  id: string;
  name: string;
  description: string;
  models: { build: string; plan: string; fast: string };
  custom: boolean;
  active: boolean;
}

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
  baseUrl = '',
  resourceId,
  models,
}: {
  baseUrl?: string;
  resourceId?: string;
  models: HarnessAvailableModel[];
}) {
  const [packs, setPacks] = useState<ModelPackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftPack | null>(null);

  const load = async () => {
    try {
      const qs = resourceId ? `?resourceId=${encodeURIComponent(resourceId)}` : '';
      const res = await fetch(`${baseUrl}/api/web/config/model-packs${qs}`);
      if (!res.ok) throw new Error(`Failed to load model packs (${res.status})`);
      const data = (await res.json()) as { packs: ModelPackInfo[] };
      setPacks(data.packs ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [baseUrl, resourceId]);

  const activate = async (id: string) => {
    if (!resourceId) {
      setError('Open a project first to activate a pack.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${baseUrl}/api/web/config/model-packs/${encodeURIComponent(id)}/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed to activate pack (${res.status})`);
      }
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
      const res = await fetch(`${baseUrl}/api/web/config/model-packs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed to remove pack (${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name || !draft.build || !draft.plan || !draft.fast) {
      setError('Name and a model for each of build, plan and fast are required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${baseUrl}/api/web/config/model-packs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, models: { build: draft.build, plan: draft.plan, fast: draft.fast } }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed to save pack (${res.status})`);
      }
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
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
          <button className="btn btn-sm" onClick={() => setDraft({ ...EMPTY_DRAFT })} disabled={busy}>
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
              Add
            </button>
            <button className="btn btn-sm" disabled={busy} onClick={() => setDraft(null)}>
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
