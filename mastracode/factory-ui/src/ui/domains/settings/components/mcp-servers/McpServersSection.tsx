import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronDown, ChevronRight, LogIn, LogOut, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import type { McpServerInfo, McpServerStatus } from '../../../../../api/types';
import {
  McpServersRequestError,
  useDeleteMcpServer,
  useDisconnectMcpServerOAuth,
  useDiscoverMcpServer,
  useMcpServersQuery,
  useStartMcpServerOAuth,
} from '../../../../../hooks/use-mcp-servers';
import { useServerFeatures } from '../../../../../hooks/useServerFeatures';
import { SettingsRowsSkeleton } from '../../../../ui/SettingsRowsSkeleton';
import { goToMcpServerSignIn, MCP_OAUTH_RETURN_PARAMS, readMcpOAuthReturn } from '../../services/mcpServers';
import { settingsSectionPath } from '../../settingsSections';
import { SettingsSubsection } from '../SettingsSubsection';
import { McpServerDrawer } from './McpServerDrawer';
import { McpServerTools } from './McpServerTools';

const STATUS: Record<McpServerStatus, { label: string; variant: BadgeVariant }> = {
  connected: { label: 'Connected', variant: 'success' },
  needs_auth: { label: 'Needs sign-in', variant: 'warning' },
  error: { label: 'Error', variant: 'destructive' },
  unknown: { label: 'Not connected', variant: 'neutral' },
};

const errorText = (caught: unknown) => (caught instanceof Error ? caught.message : String(caught));

function needsSignIn(server: McpServerInfo): boolean {
  return server.authType === 'oauth' && server.oauth?.connected !== true;
}

function authSummary(server: McpServerInfo): string {
  if (server.authType === 'none') return 'No authentication';
  if (server.authType === 'oauth') return server.oauth?.connected ? 'OAuth, signed in' : 'OAuth, not signed in';
  return `Headers: ${server.headerNames.join(', ')}`;
}

/** Connect, sign in, sign out, and remove, with each failure reported on the server it happened to. */
function useServerActions(factoryId: string | undefined) {
  const discover = useDiscoverMcpServer();
  const startOAuth = useStartMcpServerOAuth();
  const disconnect = useDisconnectMcpServerOAuth();
  const remove = useDeleteMcpServer();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ serverId: string; message: string } | null>(null);

  const run = async (serverId: string, action: () => Promise<'navigating' | void>) => {
    setFailure(null);
    setPendingId(serverId);
    try {
      // The page is about to leave for the sign-in page; stay busy until it does.
      if ((await action()) === 'navigating') return;
    } catch (caught) {
      setFailure({ serverId, message: errorText(caught) });
    }
    setPendingId(null);
  };

  const signIn = (server: McpServerInfo) =>
    run(server.id, async () => {
      const result = await startOAuth.mutateAsync({ id: server.id, factoryProjectId: factoryId });
      if (!('authorizationUrl' in result)) return;
      goToMcpServerSignIn(result.authorizationUrl);
      return 'navigating';
    });

  return {
    pendingId,
    failure,
    signIn,
    connect: (server: McpServerInfo) =>
      needsSignIn(server)
        ? signIn(server)
        : run(server.id, async () => {
            await discover.mutateAsync({ id: server.id });
          }),
    signOut: (server: McpServerInfo) =>
      run(server.id, async () => {
        await disconnect.mutateAsync({ id: server.id });
      }),
    remove: (server: McpServerInfo) =>
      run(server.id, async () => {
        await remove.mutateAsync({ id: server.id });
      }),
  };
}

/**
 * Organization MCP servers: remote tool servers every session in the
 * organization (user chats and work-item runs) can call. Admins manage them;
 * members see them read-only.
 */
export function McpServersSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const features = useServerFeatures();
  const enabled = features.data?.mcpServers === true;
  const query = useMcpServersQuery({ enabled });
  const actions = useServerActions(factoryId);
  // `key` changes on every open so the form starts fresh; closing keeps the content through the animation.
  const [drawer, setDrawer] = useState<{ key: number; open: boolean; server?: McpServerInfo }>({
    key: 0,
    open: false,
  });
  const openDrawer = (server?: McpServerInfo) => setDrawer(current => ({ key: current.key + 1, open: true, server }));
  const closeDrawer = () => setDrawer(current => ({ ...current, open: false }));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const [oauthReturn, setOAuthReturn] = useState(() => readMcpOAuthReturn(searchParams));

  // The OAuth callback reports its outcome in the URL; show it once, then drop it from the address.
  useEffect(() => {
    if (!MCP_OAUTH_RETURN_PARAMS.some(param => searchParams.has(param))) return;
    setSearchParams(
      current => {
        const next = new URLSearchParams(current);
        for (const param of MCP_OAUTH_RETURN_PARAMS) next.delete(param);
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  if (features.isPending) return <SettingsRowsSkeleton label="Loading MCP servers" rows={2} />;
  if (!enabled) {
    return <Notice variant="info">MCP servers are not available on this server.</Notice>;
  }

  const data = query.data;
  const canManage = data?.canManage === true;
  const servers = data?.servers ?? [];
  const returnedServer = oauthReturn?.serverId ? servers.find(server => server.id === oauthReturn.serverId) : undefined;

  const toggleTools = (id: string) =>
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const saved = (server: McpServerInfo) => {
    closeDrawer();
    // New servers, and edits that changed the address or credentials, need connecting.
    if (server.status === 'unknown') void actions.connect(server);
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {oauthReturn && (
        <Notice
          variant={oauthReturn.ok ? 'success' : 'destructive'}
          title={oauthReturn.ok ? 'Signed in' : "Couldn't sign in"}
          onDismiss={() => setOAuthReturn(null)}
        >
          {oauthReturn.ok
            ? `${returnedServer?.name ?? 'The server'} is connected. Choose which of its tools sessions get.`
            : oauthReturn.message}
        </Notice>
      )}
      <SettingsSubsection
        scope="org"
        title="Organization MCP servers"
        description="Everyone in your organization can use these servers' tools in their sessions and work-item runs."
        action={
          canManage && (
            <Button size="sm" icon={<Plus />} onClick={() => openDrawer()}>
              Add server
            </Button>
          )
        }
      >
        {query.isPending ? (
          <SettingsRowsSkeleton label="Loading MCP servers" rows={2} />
        ) : query.error ? (
          query.error instanceof McpServersRequestError && query.error.status === 401 ? (
            <Txt as="p" variant="caption" tone="muted">
              Sign in to see your organization's MCP servers.
            </Txt>
          ) : (
            <Notice
              variant="destructive"
              title="Couldn't load MCP servers"
              action={<Notice.Button onClick={() => void query.refetch()}>Retry</Notice.Button>}
            >
              {query.error.message}
            </Notice>
          )
        ) : (
          <div className="flex flex-col gap-3">
            {!canManage && (
              <Txt as="p" variant="caption" tone="muted">
                Only organization admins can manage MCP servers.
              </Txt>
            )}
            {servers.length === 0 ? (
              <Txt as="p" variant="caption" tone="muted">
                No MCP servers yet. Add a remote MCP server to give every session its tools. Whether sessions ask before
                running them follows Auto-approve and the MCP tool permission in{' '}
                {factoryId ? (
                  <Link to={settingsSectionPath(factoryId, 'behavior')} className="underline">
                    Behavior
                  </Link>
                ) : (
                  'Behavior'
                )}{' '}
                settings.
              </Txt>
            ) : (
              <ul role="list" aria-label="MCP servers" className="divide-border flex flex-col divide-y">
                {servers.map(server => (
                  <McpServerRow
                    key={server.id}
                    server={server}
                    canManage={canManage}
                    busy={actions.pendingId === server.id}
                    error={actions.failure?.serverId === server.id ? actions.failure.message : null}
                    toolsOpen={expanded.has(server.id)}
                    onToggleTools={() => toggleTools(server.id)}
                    onConnect={() => void actions.connect(server)}
                    onSignIn={() => void actions.signIn(server)}
                    onSignOut={() => void actions.signOut(server)}
                    onEdit={() => openDrawer(server)}
                    onRemove={() => void actions.remove(server)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </SettingsSubsection>
      {canManage && (
        <McpServerDrawer
          key={drawer.key}
          open={drawer.open}
          server={drawer.server}
          metadataDocument={data?.oauth.metadataDocument === true}
          onClose={closeDrawer}
          onSaved={saved}
        />
      )}
    </div>
  );
}

function McpServerRow({
  server,
  canManage,
  busy,
  error,
  toolsOpen,
  onToggleTools,
  onConnect,
  onSignIn,
  onSignOut,
  onEdit,
  onRemove,
}: {
  server: McpServerInfo;
  canManage: boolean;
  busy: boolean;
  error: string | null;
  toolsOpen: boolean;
  onToggleTools: () => void;
  onConnect: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const status = STATUS[server.status];
  const selectedCount = server.tools.filter(tool => tool.selected).length;
  const newCount = server.tools.filter(tool => tool.isNew).length;
  const toolsId = `mcp-server-tools-${server.id}`;
  const signInFirst = needsSignIn(server);

  return (
    <li role="listitem" aria-label={server.name} className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Txt as="span" variant="body" tone="ink" className="truncate">
              {server.name}
            </Txt>
            <Badge size="sm" variant={status.variant}>
              {status.label}
            </Badge>
            {newCount > 0 && (
              <Badge size="sm" variant="info">
                {newCount} new {newCount === 1 ? 'tool' : 'tools'}
              </Badge>
            )}
          </div>
          <Txt as="span" variant="meta" tone="muted" className="truncate">
            {server.url}
          </Txt>
          <div className="flex flex-wrap items-center gap-x-3">
            <Txt as="span" variant="meta" tone="muted">
              {authSummary(server)}
            </Txt>
            <Txt as="span" variant="meta" tone="muted" className="tabular-nums">
              {server.tools.length > 0
                ? `${selectedCount} of ${server.tools.length} tools`
                : server.discoveredAt
                  ? 'No tools'
                  : 'Tools not listed yet'}
            </Txt>
          </div>
          {server.lastError && server.status !== 'connected' && (
            <Txt as="p" variant="caption" className="text-destructive-foreground">
              {server.lastError}
            </Txt>
          )}
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {signInFirst ? (
              <Button size="sm" icon={<LogIn />} disabled={busy} onClick={onSignIn}>
                Sign in
              </Button>
            ) : (
              <Button size="sm" icon={<RefreshCw />} disabled={busy} onClick={onConnect}>
                {server.status === 'connected' ? 'Refresh tools' : 'Connect'}
              </Button>
            )}
            {server.authType === 'oauth' && server.oauth?.connected && (
              <Button size="sm" variant="ghost" icon={<LogOut />} disabled={busy} onClick={onSignOut}>
                Sign out
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={<Pencil />} disabled={busy} onClick={onEdit}>
              Edit
            </Button>
            <AlertDialog>
              <AlertDialog.Trigger
                render={
                  <Button size="sm" variant="destructive-ghost" icon={<Trash2 />} disabled={busy}>
                    Remove
                  </Button>
                }
              />
              <AlertDialog.Content>
                <AlertDialog.Header>
                  <AlertDialog.Title>Remove {server.name}?</AlertDialog.Title>
                  <AlertDialog.Description>
                    Sessions lose its tools, and its saved credentials and sign-in are deleted.
                  </AlertDialog.Description>
                </AlertDialog.Header>
                <AlertDialog.Footer>
                  <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                  <AlertDialog.Action onClick={onRemove}>Remove</AlertDialog.Action>
                </AlertDialog.Footer>
              </AlertDialog.Content>
            </AlertDialog>
          </div>
        )}
      </div>
      {error && (
        <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
          {error}
        </Txt>
      )}
      {server.tools.length > 0 && (
        <div className="flex flex-col gap-2">
          <div>
            <Button
              size="sm"
              variant="ghost"
              icon={toolsOpen ? <ChevronDown /> : <ChevronRight />}
              aria-expanded={toolsOpen}
              aria-controls={toolsId}
              onClick={onToggleTools}
            >
              {canManage ? 'Choose tools' : 'View tools'}
            </Button>
          </div>
          {toolsOpen && (
            <div id={toolsId}>
              <McpServerTools
                key={server.tools.map(tool => `${tool.name}:${tool.selected}`).join('|')}
                server={server}
                canManage={canManage}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
