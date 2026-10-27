import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link2 } from 'lucide-react';
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

function ApiKeyDialog({ provider, title, pending, onSubmit, onClose }: ApiKeyDialogProps) {
  const meta = PLATFORM_CONNECT_PROVIDERS[provider];
  const [apiKey, setApiKey] = useState('');
  return (
    <Dialog open onOpenChange={open => !open && onClose()} pending={pending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Paste an API key from your {meta.displayName} dashboard. The key is stored by Mastra Platform and never
            reaches the browser again.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input
            aria-label={`${meta.displayName} API key`}
            type="password"
            placeholder="Paste your API key"
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
          />
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!apiKey.trim()} onConfirm={() => onSubmit(apiKey.trim())}>
            {pending ? 'Connecting…' : 'Connect'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface ProviderConnectControlProps {
  provider: PlatformConnectProviderId;
  reconnectConnectionId?: string;
  label: string;
  buttonLabel?: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'ghost' | 'primary';
  icon?: ReactNode;
  className?: string;
  onCompleted?: () => void;
}

export function ProviderConnectControl({
  provider,
  reconnectConnectionId,
  label,
  buttonLabel,
  size = 'sm',
  variant = 'default',
  icon,
  className,
  onCompleted,
}: ProviderConnectControlProps) {
  const meta = PLATFORM_CONNECT_PROVIDERS[provider];
  const connectMutation = useConnectPlatformProviderMutation(provider);
  const reconnectMutation = useReconnectPlatformProviderMutation(provider);
  const [collectingApiKey, setCollectingApiKey] = useState(false);
  const pending = connectMutation.isPending || reconnectMutation.isPending;

  const run = async (credentials?: Record<string, string>) => {
    try {
      const connection = reconnectConnectionId
        ? await reconnectMutation.mutateAsync({
            connectionId: reconnectConnectionId,
            ...(credentials ? { credentials } : {}),
          })
        : await connectMutation.mutateAsync({ ...(credentials ? { credentials } : {}) });
      setCollectingApiKey(false);
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

  return (
    <>
      <Button
        size={size}
        variant={variant}
        icon={icon}
        className={className}
        disabled={pending}
        aria-label={buttonLabel && !pending ? label : undefined}
        onClick={() => (meta.authKind === 'apiKey' ? setCollectingApiKey(true) : void run())}
      >
        {pending ? 'Connecting…' : (buttonLabel ?? label)}
      </Button>
      {collectingApiKey && (
        <ApiKeyDialog
          provider={provider}
          title={label}
          pending={pending}
          onSubmit={apiKey => void run({ apiKey })}
          onClose={() => setCollectingApiKey(false)}
        />
      )}
    </>
  );
}

export interface ProviderConnectionsListProps {
  provider: PlatformConnectProviderId;
  connections: PlatformProviderConnection[];
}

export function ProviderConnectionsList({ provider, connections }: ProviderConnectionsListProps) {
  if (connections.length === 0) return null;
  return (
    <ul className="flex flex-col">
      {connections.map(connection => (
        <li key={connection.id} className="flex items-center justify-between gap-2 px-4 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <Txt as="span" variant="caption" className="truncate">
              {connectionName(connection)}
            </Txt>
            {connection.status === 'needs_reauth' && (
              <Txt as="span" variant="meta" className="text-destructive-foreground">
                Needs reauthorization
              </Txt>
            )}
          </span>
          <ProviderConnectControl
            provider={provider}
            reconnectConnectionId={connection.id}
            label="Reconnect"
            icon={<Link2 />}
            size="sm"
            variant={connection.status === 'needs_reauth' ? 'default' : 'ghost'}
          />
        </li>
      ))}
    </ul>
  );
}
