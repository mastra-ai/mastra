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
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  useConnectPlatformProviderMutation,
  useReconnectPlatformProviderMutation,
} from '../../../../hooks/usePlatformConnections';
import { MASTRA_PLATFORM_URL, PLATFORM_CONNECT_PROVIDERS } from '../../factory/services/platformConnect';
import type { PlatformConnectProviderId, PlatformProviderConnection } from '../../factory/services/platformConnect';
import { IntegrationLabel } from './IntegrationLabel';
import { ConnectionManagementButton } from './common/ConnectionManagementButton';
import { IconChainLink1 } from '@mastra/playground-ui/icons/central/IconChainLink1';

const platformIcons = {
  gitlab: 'gitlab',
  jira: 'jira',
  'incident-io': 'incidentio',
} as const satisfies Record<PlatformConnectProviderId, string>;

export function connectionName(connection: PlatformProviderConnection): string {
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
        toast.success(`${meta.displayName} authorization completed. The connection is activating.`);
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

export function PlatformLabel({ provider }: { provider: PlatformConnectProviderId }) {
  return (
    <IntegrationLabel provider={platformIcons[provider]} name={PLATFORM_CONNECT_PROVIDERS[provider].displayName} />
  );
}

export function PlatformConnectButton({ provider }: { provider: PlatformConnectProviderId }) {
  return (
    <ProviderConnectControl
      provider={provider}
      label={`Connect ${PLATFORM_CONNECT_PROVIDERS[provider].displayName}`}
      buttonLabel="Connect"
      icon={<IconChainLink1 />}
    />
  );
}

export function PlatformReconnectButton({
  provider,
  connectionId,
}: {
  provider: PlatformConnectProviderId;
  connectionId: string;
}) {
  return (
    <ProviderConnectControl
      provider={provider}
      reconnectConnectionId={connectionId}
      label={`Reconnect ${PLATFORM_CONNECT_PROVIDERS[provider].displayName}`}
      buttonLabel="Reconnect"
      icon={<IconChainLink1 />}
    />
  );
}

export function PlatformManageLink({ provider }: { provider: PlatformConnectProviderId }) {
  return (
    <ConnectionManagementButton
      aria-label={`Manage ${PLATFORM_CONNECT_PROVIDERS[provider].displayName} connection`}
      render={<a href={MASTRA_PLATFORM_URL} target="_blank" rel="noopener noreferrer" />}
    >
      Manage
    </ConnectionManagementButton>
  );
}

export function PlatformConnectionActions({
  provider,
  connections,
}: {
  provider: PlatformConnectProviderId;
  connections: PlatformProviderConnection[];
}) {
  const expired = connections.find(connection => connection.status === 'needs_reauth');
  return (
    <>
      {expired && <PlatformReconnectButton provider={provider} connectionId={expired.id} />}
      <PlatformManageLink provider={provider} />
    </>
  );
}

export function AddPlatformAccountRow({ provider }: { provider: PlatformConnectProviderId }) {
  return (
    <SettingsRow label={<PlatformLabel provider={provider} />} description="Another account">
      <ProviderConnectControl
        provider={provider}
        label={`Connect another ${PLATFORM_CONNECT_PROVIDERS[provider].displayName} account`}
        buttonLabel="Connect"
        icon={<IconChainLink1 />}
      />
    </SettingsRow>
  );
}
