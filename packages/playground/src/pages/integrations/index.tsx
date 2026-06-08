import type { ListToolProviderConnectionsResponse } from '@mastra/client-js';
import { useMemo, useState } from 'react';

import { useAuthorize } from '@/domains/tool-providers/hooks/use-authorize';
import { useDisconnectConnection } from '@/domains/tool-providers/hooks/use-disconnect-connection';
import { useExistingConnections } from '@/domains/tool-providers/hooks/use-existing-connections';
import { useIsToolProviderAdmin } from '@/domains/tool-providers/hooks/use-is-tool-provider-admin';
import { useToolProviders } from '@/domains/tool-providers/hooks/use-tool-providers';
import { useToolkits } from '@/domains/tool-providers/hooks/use-toolkits';

type ConnectionItem = ListToolProviderConnectionsResponse['items'][number];

function ConnectionRow({
  c,
  isAdmin,
  providerId: _providerId,
  disconnectPending,
  onDisconnect,
}: {
  c: ConnectionItem;
  isAdmin: boolean;
  providerId: string;
  disconnectPending: boolean;
  onDisconnect: () => void;
}) {
  return (
    <li className="flex items-center justify-between border-b py-2">
      <div>
        <div className="font-mono text-xs">{c.connectionId}</div>
        <div className="text-xs text-gray-500">
          {c.label ?? '(no label)'} · {c.status}
          {c.scope ? ` · ${c.scope}` : ''}
          {isAdmin && c.authorId ? ` · author: ${c.authorId}` : ''}
        </div>
      </div>
      <button
        type="button"
        className="text-red-600 underline disabled:opacity-50"
        onClick={onDisconnect}
        disabled={disconnectPending}
      >
        Disconnect
      </button>
    </li>
  );
}

/**
 * Minimal MVP page to exercise the v1 ToolProvider backend end-to-end:
 * pick a provider, pick a toolkit, run OAuth, list/disconnect connections.
 * Intentionally unstyled — verifies wiring, not UX.
 */
export default function IntegrationsPage() {
  const [providerId, setProviderId] = useState<string>('');
  const [toolkit, setToolkit] = useState<string>('');
  const [label, setLabel] = useState<string>('');

  const providersQuery = useToolProviders();
  const toolkitsQuery = useToolkits(providerId || null);
  const connectionsQuery = useExistingConnections(providerId || null, toolkit || null);
  const authorize = useAuthorize();
  const disconnect = useDisconnectConnection();
  const isAdmin = useIsToolProviderAdmin();

  const providers = providersQuery.data?.providers ?? [];
  const toolkits = toolkitsQuery.data?.data ?? [];
  const connections = useMemo(() => connectionsQuery.data?.items ?? [], [connectionsQuery.data?.items]);

  // Admin-only grouping by authorId. When >1 distinct author present, we render
  // grouped sections; otherwise we render a flat list with `author:` suffix on
  // each row's metadata line. Non-admins see the flat list with no author info.
  const groupedByAuthor = useMemo(() => {
    if (!isAdmin) return null;
    const authors = new Set<string>();
    for (const c of connections) {
      if (c.authorId) authors.add(c.authorId);
    }
    if (authors.size <= 1) return null;
    const groups = new Map<string, typeof connections>();
    for (const c of connections) {
      const key = c.authorId ?? '(unknown)';
      const existing = groups.get(key);
      if (existing) existing.push(c);
      else groups.set(key, [c]);
    }
    // Stable ordering: shared bucket last; others alphabetical.
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'shared') return 1;
      if (b === 'shared') return -1;
      return a.localeCompare(b);
    });
  }, [connections, isAdmin]);

  const handleConnect = () => {
    if (!providerId || !toolkit) return;
    authorize.mutate(
      { providerId, toolkit, label: label.trim() || null },
      {
        onSuccess: () => {
          setLabel('');
          void connectionsQuery.refetch();
        },
      },
    );
  };

  return (
    <div className="p-6 max-w-3xl space-y-6 text-sm">
      <h1 className="text-2xl font-semibold">Integrations</h1>
      <p className="text-gray-500">
        Minimal page to verify the ToolProvider backend. Pick a provider and toolkit, then connect.
      </p>

      <div className="space-y-4 border rounded p-4">
        <div className="space-y-1">
          <label className="block font-medium" htmlFor="provider-select">
            Provider
          </label>
          <select
            id="provider-select"
            className="border rounded px-2 py-1 w-full"
            value={providerId}
            onChange={e => {
              setProviderId(e.target.value);
              setToolkit('');
            }}
            disabled={providersQuery.isLoading}
          >
            <option value="">— select provider —</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {p.displayName ?? p.name} ({p.id})
              </option>
            ))}
          </select>
          {providersQuery.isLoading && <span className="text-gray-500">Loading providers…</span>}
          {providersQuery.error && <span className="text-red-600">{String(providersQuery.error)}</span>}
        </div>

        <div className="space-y-1">
          <label className="block font-medium" htmlFor="toolkit-select">
            Toolkit
          </label>
          <select
            id="toolkit-select"
            className="border rounded px-2 py-1 w-full"
            value={toolkit}
            onChange={e => setToolkit(e.target.value)}
            disabled={!providerId || toolkitsQuery.isLoading}
          >
            <option value="">— select toolkit —</option>
            {toolkits.map(t => (
              <option key={t.slug} value={t.slug}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
          {toolkitsQuery.isLoading && <span className="text-gray-500">Loading toolkits…</span>}
          {toolkitsQuery.error && <span className="text-red-600">{String(toolkitsQuery.error)}</span>}
        </div>

        <div className="space-y-1">
          <label className="block font-medium" htmlFor="label-input">
            Label (optional)
          </label>
          <input
            id="label-input"
            type="text"
            className="border rounded px-2 py-1 w-full"
            placeholder="My personal Gmail"
            value={label}
            onChange={e => setLabel(e.target.value)}
            disabled={!providerId || !toolkit}
          />
        </div>

        <button
          type="button"
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
          onClick={handleConnect}
          disabled={!providerId || !toolkit || authorize.isPending}
        >
          {authorize.isPending ? 'Authorizing…' : 'Connect'}
        </button>

        {authorize.error && <p className="text-red-600">{String(authorize.error)}</p>}
        {authorize.data && (
          <p className="text-green-700">
            Authorized: {authorize.data.connectionId} (status: {authorize.data.status})
          </p>
        )}
      </div>

      <div className="space-y-2 border rounded p-4">
        <h2 className="text-lg font-semibold">Existing connections</h2>
        {!providerId || !toolkit ? (
          <p className="text-gray-500">Pick a provider and toolkit to list connections.</p>
        ) : connectionsQuery.isLoading ? (
          <p className="text-gray-500">Loading…</p>
        ) : connectionsQuery.error ? (
          <p className="text-red-600">{String(connectionsQuery.error)}</p>
        ) : connections.length === 0 ? (
          <p className="text-gray-500">No connections.</p>
        ) : groupedByAuthor ? (
          <div className="space-y-4">
            {groupedByAuthor.map(([authorKey, rows]) => (
              <div key={authorKey}>
                <h3
                  className="text-sm font-semibold text-gray-700"
                  data-testid={`integration-author-group-${authorKey}`}
                >
                  {authorKey === 'shared' ? 'Shared' : `Owned by ${authorKey}`}
                </h3>
                <ul className="space-y-1">
                  {rows.map(c => (
                    <ConnectionRow
                      key={c.connectionId}
                      c={c}
                      isAdmin={isAdmin}
                      providerId={providerId}
                      disconnectPending={disconnect.isPending}
                      onDisconnect={() => disconnect.mutate({ providerId, connectionId: c.connectionId })}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-1">
            {connections.map(c => (
              <ConnectionRow
                key={c.connectionId}
                c={c}
                isAdmin={isAdmin}
                providerId={providerId}
                disconnectPending={disconnect.isPending}
                onDisconnect={() => disconnect.mutate({ providerId, connectionId: c.connectionId })}
              />
            ))}
          </ul>
        )}
        {disconnect.error && <p className="text-red-600">{String(disconnect.error)}</p>}
      </div>
    </div>
  );
}
