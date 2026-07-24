import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { CustomProviderInfo } from '../../../../../shared/api/types';
import {
  useCustomProvidersQuery,
  useRemoveCustomProvider,
  useSaveCustomProvider,
} from '../../../../../shared/hooks/use-custom-providers';
import { SkeletonRows } from '../../../ui/SkeletonRows';

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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Txt as="p" variant="ui-sm" className="text-icon3">
          OpenAI-compatible endpoints. Mirrors the TUI <code>/custom-providers</code> command.
        </Txt>
        {!draft && (
          <Button size="sm" onClick={startAdd} disabled={busy}>
            <Plus size={13} /> Add provider
          </Button>
        )}
      </div>

      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}

      {draft && (
        <div className="flex flex-col gap-3 rounded-lg border border-border1 p-3">
          <label className="flex flex-col gap-1">
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Name
            </Txt>
            <Input
              size="sm"
              placeholder="e.g. my-llm"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Base URL
            </Txt>
            <Input
              size="sm"
              placeholder="https://api.example.com/v1"
              value={draft.url}
              onChange={e => setDraft({ ...draft, url: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Txt as="span" variant="ui-sm" className="text-icon5">
              API key {draft.editingId ? '(leave blank to keep)' : '(optional)'}
            </Txt>
            <Input
              type="password"
              size="sm"
              placeholder="Paste API key"
              value={draft.apiKey}
              onChange={e => setDraft({ ...draft, apiKey: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Models (comma-separated)
            </Txt>
            <Input
              size="sm"
              placeholder="model-a, model-b"
              value={draft.models}
              onChange={e => setDraft({ ...draft, models: e.target.value })}
            />
          </label>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void save()}>
              {draft.editingId ? 'Save' : 'Add'}
            </Button>
            <Button size="sm" disabled={busy} onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonRows label="Loading custom providers" rows={3} rowClassName="h-9 w-full" />
      ) : providers.length === 0 && !draft ? (
        <Txt as="p" variant="ui-sm" className="text-icon3">
          No custom providers yet. Add one above.
        </Txt>
      ) : (
        <ul role="list" className="flex flex-col divide-y divide-border1">
          {providers.map(p => (
            <li key={p.id} role="listitem" className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Txt as="span" variant="ui-md" className="truncate text-icon6">
                    {p.name}
                  </Txt>
                  {p.hasApiKey && (
                    <Badge size="sm" variant="success">
                      Key saved
                    </Badge>
                  )}
                </div>
                <Txt as="span" variant="ui-xs" className="truncate text-icon3">
                  {p.url}
                </Txt>
                {p.models.length > 0 && (
                  <Txt as="span" variant="ui-xs" className="text-icon3">
                    {p.models.length} model{p.models.length === 1 ? '' : 's'}
                  </Txt>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={busy} onClick={() => startEdit(p)}>
                  Edit
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void remove(p.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
