import { Button } from '@mastra/playground-ui/components/Button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerInteractive,
  DrawerTitle,
} from '@mastra/playground-ui/components/Drawer';
import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { useApiConfig } from '../../../../../api/config';
import type {
  CreateMcpServerRequest,
  McpServerAuthType,
  McpServerInfo,
  UpdateMcpServerRequest,
} from '../../../../../api/types';
import { useCreateMcpServer, useUpdateMcpServer } from '../../../../../hooks/use-mcp-servers';

const AUTH_CHOICES = ['none', 'bearer', 'headers', 'oauth'] as const;
type AuthChoice = (typeof AUTH_CHOICES)[number];
const isAuthChoice = (value: string): value is AuthChoice => (AUTH_CHOICES as readonly string[]).includes(value);
type HeaderDraft = { name: string; value: string };
type HeaderList = NonNullable<CreateMcpServerRequest['headers']>;

interface Draft {
  name: string;
  url: string;
  auth: AuthChoice;
  token: string;
  headers: HeaderDraft[];
  /** Edit mode: the admin chose to replace the saved headers. */
  replaceHeaders: boolean;
  clientId: string;
  clientSecret: string;
  scopes: string;
}

const AUTH_TYPE: Record<AuthChoice, McpServerAuthType> = {
  none: 'none',
  bearer: 'headers',
  headers: 'headers',
  oauth: 'oauth',
};

const CALLBACK_PATH = '/auth/mcp-servers/callback';

function savedAuth(server: McpServerInfo): AuthChoice {
  if (server.authType === 'headers') {
    const [only, ...rest] = server.headerNames;
    return rest.length === 0 && only?.toLowerCase() === 'authorization' ? 'bearer' : 'headers';
  }
  return server.authType;
}

function initialDraft(server: McpServerInfo | undefined): Draft {
  return {
    name: server?.name ?? '',
    url: server?.url ?? '',
    auth: server ? savedAuth(server) : 'none',
    token: '',
    headers: [{ name: '', value: '' }],
    replaceHeaders: false,
    clientId: server?.oauth?.clientId ?? '',
    clientSecret: '',
    scopes: server?.oauth?.scopes.join(' ') ?? '',
  };
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function parseScopes(raw: string): string[] {
  return raw.split(/[\s,]+/).filter(Boolean);
}

/** The headers the draft sends, or why it can't send any. */
function draftHeaders(draft: Draft): HeaderList | string {
  if (draft.auth === 'bearer') {
    const token = draft.token.trim().replace(/^bearer\s+/i, '');
    return token ? [{ name: 'Authorization', value: `Bearer ${token}` }] : 'Enter the token.';
  }
  const rows = draft.headers.filter(row => row.name.trim() || row.value.trim());
  if (rows.length === 0) return 'Add at least one header.';
  if (rows.some(row => !row.name.trim() || !row.value.trim())) return 'Enter a name and a value for every header.';
  return rows.map(row => ({ name: row.name.trim(), value: row.value.trim() }));
}

function createBody(draft: Draft): CreateMcpServerRequest | string {
  const base = { name: draft.name.trim(), url: draft.url.trim() };
  if (draft.auth === 'none') return { ...base, authType: 'none' };
  if (draft.auth === 'oauth') {
    const scopes = parseScopes(draft.scopes);
    const oauth = {
      ...(draft.clientId.trim() ? { clientId: draft.clientId.trim() } : {}),
      ...(draft.clientSecret.trim() ? { clientSecret: draft.clientSecret.trim() } : {}),
      ...(scopes.length > 0 ? { scopes } : {}),
    };
    return { ...base, authType: 'oauth', ...(Object.keys(oauth).length > 0 ? { oauth } : {}) };
  }
  const headers = draftHeaders(draft);
  return typeof headers === 'string' ? headers : { ...base, authType: 'headers', headers };
}

/** Only what changed: omitted credentials keep their saved values. */
function updateBody(server: McpServerInfo, draft: Draft): UpdateMcpServerRequest | string {
  const body: UpdateMcpServerRequest = {};
  const name = draft.name.trim();
  const url = draft.url.trim();
  if (name !== server.name) body.name = name;
  if (url !== server.url) body.url = url;
  const authType = AUTH_TYPE[draft.auth];
  if (authType !== server.authType) body.authType = authType;

  if (authType === 'headers') {
    const keepSaved =
      server.authType === 'headers' &&
      draft.auth === savedAuth(server) &&
      !draft.replaceHeaders &&
      !(draft.auth === 'bearer' && draft.token.trim());
    if (!keepSaved) {
      const headers = draftHeaders(draft);
      if (typeof headers === 'string') return headers;
      body.headers = headers;
    }
  }

  if (authType === 'oauth') {
    const oauth: NonNullable<UpdateMcpServerRequest['oauth']> = {};
    const clientId = draft.clientId.trim();
    if (clientId !== (server.oauth?.clientId ?? '')) oauth.clientId = clientId || null;
    if (draft.clientSecret.trim()) oauth.clientSecret = draft.clientSecret.trim();
    const scopes = parseScopes(draft.scopes);
    if (scopes.join(' ') !== (server.oauth?.scopes ?? []).join(' ')) oauth.scopes = scopes;
    if (Object.keys(oauth).length > 0) body.oauth = oauth;
  }
  return body;
}

/**
 * Add or edit an organization MCP server. Credentials are write-only: an
 * edit shows which headers or secrets are saved and sends them only when the
 * admin replaces them.
 */
export function McpServerDrawer({
  open,
  server,
  metadataDocument,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The server being edited; absent when adding one. */
  server?: McpServerInfo;
  /** The Factory can sign in without a client ID. */
  metadataDocument: boolean;
  onClose: () => void;
  onSaved: (server: McpServerInfo) => void;
}) {
  const isMobile = useIsMobile();
  const { baseUrl } = useApiConfig();
  const createMutation = useCreateMcpServer();
  const updateMutation = useUpdateMcpServer();
  const [draft, setDraft] = useState(() => initialDraft(server));
  const [error, setError] = useState<string | null>(null);
  const saving = createMutation.isPending || updateMutation.isPending;
  const update = (patch: Partial<Draft>) => setDraft(current => ({ ...current, ...patch }));

  const draftOrigin = originOf(draft.url.trim());
  const originChanged = server !== undefined && draftOrigin !== null && draftOrigin !== originOf(server.url);
  const savedHeaders =
    server?.authType === 'headers' && draft.auth === savedAuth(server) && !draft.replaceHeaders
      ? server.headerNames
      : null;
  const redirectUri = new URL(CALLBACK_PATH, baseUrl || window.location.origin).toString();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.url.trim()) {
      setError('Enter a name and the server URL.');
      return;
    }
    if (draft.auth === 'oauth' && !metadataDocument && !draft.clientId.trim()) {
      setError("Enter the client ID registered with the server's authorization server.");
      return;
    }
    setError(null);
    try {
      if (!server) {
        const body = createBody(draft);
        if (typeof body === 'string') return setError(body);
        onSaved((await createMutation.mutateAsync(body)).server);
        return;
      }
      const body = updateBody(server, draft);
      if (typeof body === 'string') return setError(body);
      if (Object.keys(body).length === 0) return onClose();
      onSaved((await updateMutation.mutateAsync({ id: server.id, body })).server);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <Drawer
      side={isMobile ? 'bottom' : 'right'}
      variant={isMobile ? 'default' : 'floating'}
      overlay="visible"
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && !saving) onClose();
      }}
    >
      <DrawerContent aria-busy={saving || undefined}>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => void submit(event)} noValidate>
          <DrawerHeader>
            <DrawerTitle>{server ? `Edit ${server.name}` : 'Add MCP server'}</DrawerTitle>
            <DrawerDescription>
              A remote MCP server reached over HTTP. Everyone in your organization can use the tools you choose.
            </DrawerDescription>
          </DrawerHeader>
          {/* Outside an interactive region, a pointerdown on a segmented-control item starts a
              drawer swipe that captures the pointer, so the click never selects the item. */}
          <DrawerInteractive render={<DrawerBody className="flex min-h-0 flex-col gap-4 overflow-y-auto" />}>
            <Field className="gap-1">
              <FieldLabel>Name</FieldLabel>
              <Input
                size="sm"
                placeholder="e.g. Docs"
                value={draft.name}
                onChange={event => update({ name: event.target.value })}
                autoFocus
              />
              <FieldDescription>Its tools are named after it, like docs_search.</FieldDescription>
            </Field>
            <Field className="gap-1">
              <FieldLabel>Server URL</FieldLabel>
              <Input
                size="sm"
                type="url"
                placeholder="https://mcp.example.com/mcp"
                value={draft.url}
                onChange={event => update({ url: event.target.value })}
              />
              <FieldDescription>Every member can see this address. Put keys in headers, not the URL.</FieldDescription>
            </Field>
            {originChanged && (
              <Notice variant="warning">
                Changing the server address removes its saved credentials, sign-in, and tools. Enter the credentials
                again.
              </Notice>
            )}
            <div className="flex flex-col gap-1.5">
              <Txt as="span" variant="label" aria-hidden>
                Authentication
              </Txt>
              <SegmentedControl
                aria-label="Authentication"
                value={draft.auth}
                onValueChange={auth => {
                  if (isAuthChoice(auth)) update({ auth });
                }}
                disabled={saving}
              >
                <SegmentedControlItem value="none">None</SegmentedControlItem>
                <SegmentedControlItem value="bearer">Bearer token</SegmentedControlItem>
                <SegmentedControlItem value="headers">Custom headers</SegmentedControlItem>
                <SegmentedControlItem value="oauth">OAuth</SegmentedControlItem>
              </SegmentedControl>
            </div>

            {draft.auth === 'bearer' && (
              <Field className="gap-1">
                <FieldLabel>Token</FieldLabel>
                <Input
                  size="sm"
                  type="password"
                  autoComplete="off"
                  placeholder={savedHeaders ? 'Saved. Enter a new token to replace it' : 'Paste the token'}
                  value={draft.token}
                  onChange={event => update({ token: event.target.value })}
                />
                <FieldDescription>Sent as an Authorization: Bearer header.</FieldDescription>
              </Field>
            )}

            {draft.auth === 'headers' &&
              (savedHeaders ? (
                <div className="flex flex-col gap-1.5">
                  <Txt as="span" variant="label">
                    Headers
                  </Txt>
                  <ul className="flex flex-col gap-1" aria-label="Saved headers">
                    {savedHeaders.map(name => (
                      <li key={name} className="flex items-center gap-2">
                        <InlineCode>{name}</InlineCode>
                        <Txt as="span" variant="caption" tone="muted">
                          Saved
                        </Txt>
                      </li>
                    ))}
                  </ul>
                  <div>
                    <Button
                      size="sm"
                      type="button"
                      onClick={() =>
                        update({
                          replaceHeaders: true,
                          headers: savedHeaders.map(name => ({ name, value: '' })),
                        })
                      }
                    >
                      Replace headers
                    </Button>
                  </div>
                </div>
              ) : (
                <HeaderRows headers={draft.headers} onChange={headers => update({ headers })} />
              ))}

            {draft.auth === 'oauth' && (
              <>
                <Field className="gap-1">
                  <FieldLabel>Client ID</FieldLabel>
                  <Input
                    size="sm"
                    placeholder={metadataDocument ? 'Optional' : "From the server's authorization server"}
                    value={draft.clientId}
                    onChange={event => update({ clientId: event.target.value })}
                  />
                  <FieldDescription>
                    {metadataDocument
                      ? 'Leave blank to identify this Factory with its client metadata document.'
                      : 'This Factory is not served over https, so register it with the authorization server and enter the client ID.'}{' '}
                    Redirect URI: <InlineCode>{redirectUri}</InlineCode>
                  </FieldDescription>
                </Field>
                <Field className="gap-1">
                  <FieldLabel>Client secret</FieldLabel>
                  <Input
                    size="sm"
                    type="password"
                    autoComplete="off"
                    placeholder={
                      server?.oauth?.hasClientSecret ? 'Saved. Enter a new secret to replace it' : 'Optional'
                    }
                    value={draft.clientSecret}
                    onChange={event => update({ clientSecret: event.target.value })}
                  />
                </Field>
                <Field className="gap-1">
                  <FieldLabel>Scopes</FieldLabel>
                  <Input
                    size="sm"
                    placeholder="Optional, separated by spaces"
                    value={draft.scopes}
                    onChange={event => update({ scopes: event.target.value })}
                  />
                </Field>
                <Txt as="p" variant="caption" tone="muted">
                  The sign-in acts for the whole organization: every session uses it.
                </Txt>
              </>
            )}

            {error && (
              <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
                {error}
              </Txt>
            )}
          </DrawerInteractive>
          <DrawerFooter>
            <Button type="button" size="sm" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={saving}>
              {saving && <Spinner size="sm" aria-hidden className="size-3" />}
              {server ? 'Save' : draft.auth === 'oauth' ? 'Add and sign in' : 'Add and connect'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

function HeaderRows({ headers, onChange }: { headers: HeaderDraft[]; onChange: (headers: HeaderDraft[]) => void }) {
  const set = (index: number, patch: Partial<HeaderDraft>) =>
    onChange(headers.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  return (
    <div className="flex flex-col gap-1.5">
      <Txt as="span" variant="label">
        Headers
      </Txt>
      {headers.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            size="sm"
            aria-label={`Header ${index + 1} name`}
            placeholder="X-Api-Key"
            value={row.name}
            onChange={event => set(index, { name: event.target.value })}
          />
          <Input
            size="sm"
            type="password"
            autoComplete="off"
            aria-label={`Header ${index + 1} value`}
            placeholder="Value"
            value={row.value}
            onChange={event => set(index, { value: event.target.value })}
          />
          <Button
            size="icon-sm"
            type="button"
            variant="ghost"
            aria-label={`Remove header ${index + 1}`}
            disabled={headers.length === 1}
            onClick={() => onChange(headers.filter((_, at) => at !== index))}
          >
            <X size={14} aria-hidden />
          </Button>
        </div>
      ))}
      <div>
        <Button
          size="sm"
          type="button"
          variant="ghost"
          icon={<Plus />}
          onClick={() => onChange([...headers, { name: '', value: '' }])}
        >
          Add header
        </Button>
      </div>
    </div>
  );
}
