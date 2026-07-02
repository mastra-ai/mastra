import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ProviderInfo } from '../../../../../shared/api/types';
import { useProvidersQuery, useRemoveProviderKey, useSaveProviderKey } from '../../../../../shared/hooks/use-providers';

const SOURCE_LABEL: Record<ProviderInfo['source'], string> = {
  oauth: 'Signed in',
  stored: 'Key saved',
  env: 'From env',
  none: 'Not set',
};

const SOURCE_VARIANT: Record<ProviderInfo['source'], 'success' | 'info' | 'default'> = {
  oauth: 'success',
  stored: 'success',
  env: 'info',
  none: 'default',
};

/**
 * Provider + API-key management. Mirrors the TUI's `/api-keys` command.
 *
 * The search box is the primary affordance and stays pinned at the top of the
 * pane: an empty query shows the configured providers (key saved / from env);
 * typing filters the full catalog so any provider is reachable. Keys are
 * written to the server credential store and never read back to the client.
 */
export function ProvidersSection() {
  const providersQuery = useProvidersQuery();
  const saveKeyMutation = useSaveProviderKey();
  const removeKeyMutation = useRemoveProviderKey();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const keyInputRef = useRef<HTMLInputElement>(null);

  const providers = providersQuery.data ?? [];
  const loading = providersQuery.isPending;
  const busy = saveKeyMutation.isPending || removeKeyMutation.isPending;
  const error =
    (providersQuery.error ?? saveKeyMutation.error ?? removeKeyMutation.error) instanceof Error
      ? (providersQuery.error ?? saveKeyMutation.error ?? removeKeyMutation.error)!.message
      : null;

  useEffect(() => {
    if (editing) keyInputRef.current?.focus();
  }, [editing]);

  const configured = useMemo(
    () => providers.filter(p => p.source !== 'none').sort((a, b) => a.provider.localeCompare(b.provider)),
    [providers],
  );

  // When searching, surface ALL matches (any source) so configured + new
  // providers are reachable; configured ones float to the top.
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return providers
      .filter(p => p.provider.toLowerCase().includes(q))
      .sort((a, b) => {
        if ((a.source !== 'none') !== (b.source !== 'none')) return a.source !== 'none' ? -1 : 1;
        return a.provider.localeCompare(b.provider);
      })
      .slice(0, 50);
  }, [providers, search]);

  const saveKey = async (provider: string, envVar?: string) => {
    const key = keyDraft.trim();
    if (!key) return;
    try {
      await saveKeyMutation.mutateAsync({ provider, key, envVar });
      setEditing(null);
      setKeyDraft('');
    } catch {
      // Error surfaced via the mutation state above.
    }
  };

  const removeKey = async (provider: string) => {
    try {
      await removeKeyMutation.mutateAsync({ provider });
    } catch {
      // Error surfaced via the mutation state above.
    }
  };

  const renderRow = (p: ProviderInfo) => {
    const isEditing = editing === p.provider;
    return (
      <li key={p.provider} role="listitem" className="flex items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {p.source !== 'none' && <Check size={13} className="text-accent1 shrink-0" />}
          <Txt as="span" variant="ui-md" className="truncate text-icon6">
            {p.provider}
          </Txt>
          <Badge size="sm" variant={SOURCE_VARIANT[p.source]}>
            {SOURCE_LABEL[p.source]}
          </Badge>
        </div>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              ref={keyInputRef}
              type="password"
              size="sm"
              placeholder="Paste API key"
              value={keyDraft}
              onChange={e => setKeyDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void saveKey(p.provider, p.envVar);
                if (e.key === 'Escape') {
                  setEditing(null);
                  setKeyDraft('');
                }
              }}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !keyDraft.trim()}
              onClick={() => void saveKey(p.provider, p.envVar)}
            >
              Save
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setKeyDraft('');
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setEditing(p.provider);
                setKeyDraft('');
              }}
            >
              {p.source === 'stored' ? 'Update' : 'Add key'}
            </Button>
            {p.source === 'stored' && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void removeKey(p.provider)}>
                Remove
              </Button>
            )}
          </div>
        )}
      </li>
    );
  };

  const searching = search.trim().length > 0;
  const list = searching ? results : configured;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon3" />
        <Input
          type="text"
          placeholder="Search providers to add a key…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search providers"
          className="pl-8"
        />
      </div>

      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}

      {loading ? (
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Loading providers…
        </Txt>
      ) : (
        <>
          {!searching && (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {configured.length > 0
                ? `${configured.length} configured. Search above to add more.`
                : 'No providers configured yet. Search above to add a key.'}
            </Txt>
          )}
          {list.length === 0 ? (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {searching ? `No providers match “${search.trim()}”.` : 'No providers configured.'}
            </Txt>
          ) : (
            <ul role="list" className="flex flex-col divide-y divide-border1">
              {list.map(renderRow)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
