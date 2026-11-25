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
import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  useConnectPlatformProviderMutation,
  useReconnectPlatformProviderMutation,
} from '../../../../hooks/usePlatformConnections';
import {
  MASTRA_PLATFORM_URL,
  PLATFORM_CONNECT_PROVIDERS,
  reconnectProvider,
} from '../../factory/services/platformConnect';
import type { PlatformConnectProviderId, PlatformProviderConnection } from '../../factory/services/platformConnect';
import { ConnectionManagementButton } from './common/ConnectionManagementButton';
import { IconChainLink3 } from '@mastra/playground-ui/icons/central/IconChainLink3';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';

const platformIcons = {
  gitlab: 'gitlab',
  'gitlab-self-hosted': 'gitlab',
  jira: 'jira',
  'incident-io': 'incidentio',
  vanta: 'vanta',
} as const satisfies Record<PlatformConnectProviderId, string>;

export function connectionName(connection: PlatformProviderConnection): string {
  return connection.displayName?.trim() || connection.accountLabel?.trim() || 'Connected account';
}

interface ApiKeyDialogProps {
  provider: PlatformConnectProviderId;
  title: string;
  pending: boolean;
  /** Reconnecting keeps the connection's settings, so only the credential is asked for. */
  reconnecting: boolean;
  onSubmit: (apiKey: string, params: Record<string, string> | undefined) => void;
  onClose: () => void;
}

function ApiKeyDialog({ provider, title, pending, reconnecting, onSubmit, onClose }: ApiKeyDialogProps) {
  const meta = PLATFORM_CONNECT_PROVIDERS[provider];
  const credentialName = meta.credentialName ?? 'API key';
  const fields = reconnecting ? [] : (meta.params ?? []);
  const [apiKey, setApiKey] = useState('');
  const [params, setParams] = useState<Record<string, string>>({});
  const value = (key: string) => params[key]?.trim() ?? '';
  const complete = Boolean(apiKey.trim()) && fields.every(field => value(field.key));
  const submit = () =>
    onSubmit(
      apiKey.trim(),
      fields.length > 0 ? Object.fromEntries(fields.map(field => [field.key, value(field.key)])) : undefined,
    );
  return (
    <Dialog open onOpenChange={open => !open && onClose()} pending={pending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Paste an {credentialName} from your {meta.displayName} account. The {credentialName} is stored by Mastra
            Platform and never reaches the browser again.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {fields.map(field => (
            <Input
              key={field.key}
              aria-label={field.label}
              placeholder={field.placeholder}
              value={params[field.key] ?? ''}
              onChange={event => setParams(current => ({ ...current, [field.key]: event.target.value }))}
            />
          ))}
          <Input
            aria-label={`${meta.displayName} ${credentialName}`}
            type="password"
            placeholder={`Paste your ${credentialName}`}
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
          />
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!complete} onConfirm={submit} loading={pending}>
            Connect
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

  const run = async (credentials?: Record<string, string>, params?: Record<string, string>) => {
    const auth = { ...(credentials ? { credentials } : {}), ...(params ? { params } : {}) };
    try {
      const connection = reconnectConnectionId
        ? await reconnectMutation.mutateAsync({
            connectionId: reconnectConnectionId,
            ...(credentials ? { credentials } : {}),
          })
        : await connectMutation.mutateAsync(auth);
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
        aria-label={buttonLabel ? label : undefined}
        onClick={() => (meta.authKind === 'apiKey' ? setCollectingApiKey(true) : void run())}
        loading={pending}
      >
        {buttonLabel ?? label}
      </Button>
      {collectingApiKey && (
        <ApiKeyDialog
          provider={provider}
          title={label}
          pending={pending}
          reconnecting={Boolean(reconnectConnectionId)}
          onSubmit={(apiKey, params) => void run({ apiKey }, params)}
          onClose={() => setCollectingApiKey(false)}
        />
      )}
    </>
  );
}

/** The integration icon and name `IntegrationItem` takes for a Platform provider. */
export function platformIntegration(provider: PlatformConnectProviderId) {
  return { provider: platformIcons[provider], name: PLATFORM_CONNECT_PROVIDERS[provider].displayName };
}

export function PlatformConnectButton({
  provider,
  buttonLabel = 'Connect',
}: {
  provider: PlatformConnectProviderId;
  buttonLabel?: string;
}) {
  return (
    <ProviderConnectControl
      provider={provider}
      label={`Connect ${PLATFORM_CONNECT_PROVIDERS[provider].displayName}`}
      buttonLabel={buttonLabel}
      icon={<IconChainLink3 />}
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
      icon={<IconChainLink3 />}
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
      {expired && <PlatformReconnectButton provider={reconnectProvider(provider, expired)} connectionId={expired.id} />}
      <PlatformManageLink provider={provider} />
    </>
  );
}

export function AddPlatformAccountButton({
  provider,
  buttonLabel = 'Add account',
}: {
  provider: PlatformConnectProviderId;
  buttonLabel?: string;
}) {
  return (
    <ProviderConnectControl
      provider={provider}
      label={`Add account to ${PLATFORM_CONNECT_PROVIDERS[provider].displayName}`}
      buttonLabel={buttonLabel}
      variant="ghost"
      icon={<IconPlusMedium />}
    />
  );
}
