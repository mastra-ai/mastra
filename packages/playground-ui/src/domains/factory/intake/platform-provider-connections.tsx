import { useState } from 'react';
import type { ReactNode } from 'react';
import { ConnectionManagementButton } from './connection-management-button';
import { PlatformConnectActionsContext, usePlatformConnectActions } from './platform-connect-context';
import { MASTRA_PLATFORM_URL, PLATFORM_CONNECT_PROVIDERS, reconnectProvider } from './platform-connect-providers';
import type {
  PlatformConnectActions,
  PlatformConnectProviderId,
  PlatformProviderConnection,
} from './platform-connect-providers';
import { Button } from '@/ds/components/Button';
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
} from '@/ds/components/Dialog';
import { Input } from '@/ds/components/Input';
import { toast } from '@/ds/components/Toaster';
import { IconChainLink3 } from '@/ds/icons/central/IconChainLink3';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';

/** Supplies how every Platform connect button below it connects an account. */
export function PlatformConnectActionsProvider({
  actions,
  children,
}: {
  actions: PlatformConnectActions;
  children: ReactNode;
}) {
  return <PlatformConnectActionsContext.Provider value={actions}>{children}</PlatformConnectActionsContext.Provider>;
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
  const actions = usePlatformConnectActions();
  const [pending, setPending] = useState(false);
  const [collectingApiKey, setCollectingApiKey] = useState(false);

  const run = async (credentials?: Record<string, string>, params?: Record<string, string>) => {
    setPending(true);
    try {
      const connection = reconnectConnectionId
        ? await actions.reconnect(provider, {
            connectionId: reconnectConnectionId,
            ...(credentials ? { credentials } : {}),
          })
        : await actions.connect(provider, { ...(credentials ? { credentials } : {}), ...(params ? { params } : {}) });
      setCollectingApiKey(false);
      if (connection) {
        toast.success(`${meta.displayName} connected`);
      } else {
        toast.success(`${meta.displayName} authorization completed. The connection is activating.`);
      }
      onCompleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to connect ${meta.displayName}`);
    } finally {
      setPending(false);
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
