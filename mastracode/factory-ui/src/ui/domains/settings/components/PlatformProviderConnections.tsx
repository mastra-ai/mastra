/**
 * Connect / reconnect controls for Platform-managed provider accounts,
 * completed headlessly in the Factory SPA.
 *
 * OAuth providers open the provider's own consent popup; API-key providers
 * collect the key in a dialog and submit it directly — the same UX as Mastra
 * Platform's own settings, with no Nango-branded screens and no Platform
 * round trip.
 */

import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  useConnectPlatformProviderMutation,
  useReconnectPlatformProviderMutation,
} from '../../../../hooks/usePlatformConnections';
import { PLATFORM_CONNECT_PROVIDERS } from '../../factory/services/platformConnect';
import type { PlatformConnectProviderId, PlatformProviderConnection } from '../../factory/services/platformConnect';

function connectionName(connection: PlatformProviderConnection): string {
  return connection.displayName?.trim() || connection.accountLabel?.trim() || 'Connected account';
}

interface ApiKeyDialogProps {
  provider: PlatformConnectProviderId;
  title: string;
  pending: boolean;
  onSubmit: (apiKey: string) => void;
  onClose: () => void;
}

interface ConnectParamsDialogProps {
  provider: PlatformConnectProviderId;
  title: string;
  pending: boolean;
  onSubmit: (params: Record<string, string>) => void;
  onClose: () => void;
}

/**
 * Collects provider connection config (e.g. Zendesk's subdomain) before the
 * OAuth popup opens — Nango needs these values to build the authorization
 * URL. Same dialog pattern as the API-key form so every provider's connect
 * flow feels identical.
 */
function ConnectParamsDialog({ provider, title, pending, onSubmit, onClose }: ConnectParamsDialogProps) {
  const meta = PLATFORM_CONNECT_PROVIDERS[provider];
  const fields = meta.connectParams ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const complete = fields.every(field => (values[field.key] ?? '').trim());
  const submit = () => {
    const params: Record<string, string> = {};
    for (const field of fields) params[field.key] = (values[field.key] ?? '').trim();
    onSubmit(params);
  };
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {meta.displayName} needs this to open the right sign-in page. You'll authorize in a {meta.displayName}{' '}
            popup next.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {fields.map(field => (
            <label key={field.key} className="flex flex-col gap-1.5">
              <Txt as="span" variant="ui-sm" className="text-icon5">
                {field.label}
              </Txt>
              <Input
                aria-label={field.label}
                placeholder={field.placeholder}
                value={values[field.key] ?? ''}
                onChange={event => setValues(prev => ({ ...prev, [field.key]: event.target.value }))}
                onKeyDown={event => {
                  if (event.key === 'Enter' && complete && !pending) submit();
                }}
              />
              {field.hint && (
                <Txt as="span" variant="ui-xs" className="text-icon3">
                  {field.hint}
                </Txt>
              )}
            </label>
          ))}
        </DialogBody>
        <DialogFooter>
          <ButtonsGroup>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !complete}>
              {pending ? 'Connecting…' : 'Continue'}
            </Button>
          </ButtonsGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeyDialog({ provider, title, pending, onSubmit, onClose }: ApiKeyDialogProps) {
  const meta = PLATFORM_CONNECT_PROVIDERS[provider];
  const [apiKey, setApiKey] = useState('');
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Paste an API key from your {meta.displayName} dashboard. The key is stored by Mastra Platform and never
            reaches the browser again.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Input
            aria-label={`${meta.displayName} API key`}
            type="password"
            placeholder="Paste your API key"
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
          />
        </DialogBody>
        <DialogFooter>
          <ButtonsGroup>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => onSubmit(apiKey.trim())} disabled={pending || !apiKey.trim()}>
              {pending ? 'Connecting…' : 'Connect'}
            </Button>
          </ButtonsGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface ProviderConnectControlProps {
  provider: PlatformConnectProviderId;
  /** Reconnect an existing connection instead of creating a new one. */
  reconnectConnectionId?: string;
  label: string;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'default' | 'ghost' | 'primary';
  /** Leading icon inside the button, e.g. the provider's logomark. */
  icon?: ReactNode;
  /** Called after the provider confirmed the authorization. */
  onCompleted?: () => void;
}

/**
 * One button driving the full connect or reconnect flow for a provider.
 * Owns its mutation: mint session → headless auth → wait for activation.
 */
export function ProviderConnectControl({
  provider,
  reconnectConnectionId,
  label,
  size = 'sm',
  variant = 'default',
  icon,
  onCompleted,
}: ProviderConnectControlProps) {
  const meta = PLATFORM_CONNECT_PROVIDERS[provider];
  const connectMutation = useConnectPlatformProviderMutation(provider);
  const reconnectMutation = useReconnectPlatformProviderMutation(provider);
  const [collecting, setCollecting] = useState<'apiKey' | 'params' | null>(null);
  const pending = connectMutation.isPending || reconnectMutation.isPending;

  const run = async (input: { credentials?: Record<string, string>; params?: Record<string, string> } = {}) => {
    try {
      const connection = reconnectConnectionId
        ? await reconnectMutation.mutateAsync({ connectionId: reconnectConnectionId, ...input })
        : await connectMutation.mutateAsync(input);
      setCollecting(null);
      if (connection) {
        toast.success(`${meta.displayName} connected`);
      } else {
        toast.success(`${meta.displayName} authorization completed — the connection is activating`);
      }
      onCompleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to connect ${meta.displayName}`);
    }
  };

  const start = () => {
    if (meta.authKind === 'apiKey') setCollecting('apiKey');
    else if (meta.connectParams?.length) setCollecting('params');
    else void run();
  };

  return (
    <>
      <Button size={size} variant={variant} icon={icon} disabled={pending} onClick={start}>
        {pending ? 'Connecting…' : label}
      </Button>
      {collecting === 'apiKey' && (
        <ApiKeyDialog
          provider={provider}
          title={label}
          pending={pending}
          onSubmit={apiKey => void run({ credentials: { apiKey } })}
          onClose={() => setCollecting(null)}
        />
      )}
      {collecting === 'params' && (
        <ConnectParamsDialog
          provider={provider}
          title={label}
          pending={pending}
          onSubmit={params => void run({ params })}
          onClose={() => setCollecting(null)}
        />
      )}
    </>
  );
}

export interface ProviderConnectionsListProps {
  provider: PlatformConnectProviderId;
  connections: PlatformProviderConnection[];
}

/**
 * Per-connection rows for organizations with multiple installed accounts.
 * Healthy connections show a quiet reconnect affordance; connections the
 * provider rejected surface it prominently.
 */
export function ProviderConnectionsList({ provider, connections }: ProviderConnectionsListProps) {
  if (connections.length === 0) return null;
  return (
    <ul className="flex flex-col">
      {connections.map(connection => (
        <li key={connection.id} className="flex items-center justify-between gap-2 px-4 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <Txt as="span" variant="ui-sm" className="truncate">
              {connectionName(connection)}
            </Txt>
            {connection.status === 'needs_reauth' && (
              <Txt as="span" variant="ui-xs" className="text-red-400">
                Needs reauthorization
              </Txt>
            )}
          </span>
          <ProviderConnectControl
            provider={provider}
            reconnectConnectionId={connection.id}
            label="Reconnect"
            size="xs"
            variant={connection.status === 'needs_reauth' ? 'default' : 'ghost'}
          />
        </li>
      ))}
    </ul>
  );
}
