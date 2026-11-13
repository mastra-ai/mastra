import { Button } from '@mastra/playground-ui/components/Button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@mastra/playground-ui/components/Drawer';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../../api/types';
import { useConnectMastraGateway, useStartProviderOAuth } from '../../../../../../hooks/use-providers';
import { useSidePanelDrawer } from '../../../../../lib/hooks/useSidePanelDrawer';
import { MastraGatewayBilling } from '../../../../workspaces/components/MastraGatewayBilling';
import {
  CREDENTIAL_LABEL,
  SHARED_SOURCE,
  SIGN_IN_EXPIRED_LABEL,
  credentialAt,
  signInExpiredAt,
  signInRequest,
} from '../../provider-credential';
import type { CredentialScope } from '../../provider-credential';
import { ProviderOptionRow } from './ProviderRows';

const AUDIENCE: Record<CredentialScope, string> = {
  user: 'Only you can use it.',
  org: 'Everyone in your organization can use it.',
};

const PROVIDER_LIST_CLASS = 'border-border divide-border min-h-0 divide-y overflow-y-auto rounded-lg border';

function matchesSearch(provider: ProviderInfo, query: string): boolean {
  return (
    provider.provider.toLowerCase().includes(query) ||
    providerDisplayName(provider.provider).toLowerCase().includes(query)
  );
}

function isGateway(provider: ProviderInfo): boolean {
  return provider.connectWithMastraAccount === true;
}

function takesApiKey(provider: ProviderInfo): boolean {
  return provider.source !== 'deployment' && !isGateway(provider);
}

function connectionLabel(provider: ProviderInfo, scope: CredentialScope): string | undefined {
  if (signInExpiredAt(provider, scope)) return SIGN_IN_EXPIRED_LABEL;
  const credential = credentialAt(provider, scope);
  if (credential) return CREDENTIAL_LABEL[credential];
  return SHARED_SOURCE[provider.source]?.label;
}

function emptyMessage(search: string): string {
  const trimmed = search.trim();
  return trimmed ? `No providers match “${trimmed}”.` : 'No providers offer sign-in.';
}

export function AddProviderDrawer({
  open,
  providers,
  credentialScope,
  requestScope,
  onOAuthStarted,
  onAddKey,
  onClose,
}: {
  open: boolean;
  providers: ProviderInfo[];
  credentialScope: CredentialScope;
  requestScope: CredentialScope | undefined;
  onOAuthStarted: (provider: string, session: OAuthStartResponse) => void;
  onAddKey: (provider: ProviderInfo) => void;
  onClose: () => void;
}) {
  const sidePanel = useSidePanelDrawer();
  const startOAuthMutation = useStartProviderOAuth();
  const connectGatewayMutation = useConnectMastraGateway();
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const sorted = providers.toSorted(
    (left, right) => Number(isGateway(right)) - Number(isGateway(left)) || left.provider.localeCompare(right.provider),
  );
  const gateway = query ? undefined : sorted.find(isGateway);
  const signInProviders = sorted.filter(provider => provider.oauth?.supported === true);
  const shown = query ? sorted.filter(provider => matchesSearch(provider, query)) : signInProviders;
  const keyOnlyCount = providers.filter(provider => provider.oauth?.supported !== true && takesApiKey(provider)).length;
  const connectingGateway = connectGatewayMutation.isPending ? providers.find(isGateway)?.provider : undefined;
  const startingProvider = startOAuthMutation.isPending ? startOAuthMutation.variables.provider : connectingGateway;
  const startError = startOAuthMutation.error ?? connectGatewayMutation.error;

  // Each attempt shows its own error, not one left over from the other way to connect.
  const signIn = (provider: ProviderInfo) => {
    connectGatewayMutation.reset();
    startOAuthMutation.mutate(signInRequest(provider, requestScope), {
      onSuccess: session => onOAuthStarted(provider.provider, session),
    });
  };

  const connectGateway = () => {
    startOAuthMutation.reset();
    connectGatewayMutation.mutate({ scope: requestScope }, { onSuccess: onClose });
  };

  const closeUnlessStarting = (nextOpen: boolean) => {
    if (!nextOpen && startingProvider === undefined) onClose();
  };

  const resetOnceHidden = (nextOpen: boolean) => {
    if (nextOpen) return;
    setSearch('');
    startOAuthMutation.reset();
    connectGatewayMutation.reset();
  };

  return (
    <Drawer {...sidePanel} open={open} onOpenChange={closeUnlessStarting} onOpenChangeComplete={resetOnceHidden}>
      <DrawerContent aria-busy={startingProvider !== undefined || undefined}>
        <DrawerHeader>
          <DrawerTitle>Add provider</DrawerTitle>
          <DrawerDescription>{AUDIENCE[credentialScope]}</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex min-h-0 flex-col gap-3">
          <SearchInput
            label="Search providers"
            placeholder={`Search ${providers.length} providers`}
            value={search}
            onValueChange={setSearch}
          />
          {gateway && (
            <>
              <Txt as="p" variant="caption" tone="muted">
                Recommended
              </Txt>
              <ul className={PROVIDER_LIST_CLASS}>
                <AddProviderRow
                  provider={gateway}
                  credentialScope={credentialScope}
                  startingProvider={startingProvider}
                  onSignIn={signIn}
                  onConnectGateway={connectGateway}
                  onAddKey={onAddKey}
                />
              </ul>
            </>
          )}
          <Txt as="p" variant="caption" tone="muted">
            {query ? `${shown.length} of ${providers.length} providers` : 'Sign in with a subscription'}
          </Txt>
          {shown.length === 0 ? (
            <Txt as="p" variant="caption" className="py-4 text-center">
              {emptyMessage(search)}
            </Txt>
          ) : (
            <ul className={PROVIDER_LIST_CLASS}>
              {shown.map(provider => (
                <AddProviderRow
                  key={provider.provider}
                  provider={provider}
                  credentialScope={credentialScope}
                  startingProvider={startingProvider}
                  onSignIn={signIn}
                  onConnectGateway={connectGateway}
                  onAddKey={onAddKey}
                />
              ))}
            </ul>
          )}
          {!query && keyOnlyCount > 0 && (
            <Txt as="p" variant="caption" tone="muted">
              {keyOnlyCount} more take an API key. Type to find one.
            </Txt>
          )}
          {startError && (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {startError.message}
            </Txt>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function AddProviderRow({
  provider,
  credentialScope,
  startingProvider,
  onSignIn,
  onConnectGateway,
  onAddKey,
}: {
  provider: ProviderInfo;
  credentialScope: CredentialScope;
  startingProvider: string | undefined;
  onSignIn: (provider: ProviderInfo) => void;
  onConnectGateway: () => void;
  onAddKey: (provider: ProviderInfo) => void;
}) {
  const displayName = providerDisplayName(provider.provider);
  const label =
    connectionLabel(provider, credentialScope) ?? (isGateway(provider) ? <MastraGatewayBilling /> : undefined);
  const starting = startingProvider !== undefined;
  return (
    <ProviderOptionRow provider={provider.provider} label={label}>
      {takesApiKey(provider) && (
        <Button
          size="sm"
          aria-label={`Add API key for ${displayName}`}
          disabled={starting}
          onClick={() => onAddKey(provider)}
        >
          API key
        </Button>
      )}
      {isGateway(provider) && !credentialAt(provider, credentialScope) && (
        <Button
          size="sm"
          variant="primary"
          aria-label={`Connect ${displayName}`}
          disabled={starting}
          onClick={onConnectGateway}
        >
          {startingProvider === provider.provider ? 'Connecting…' : 'Connect'}
        </Button>
      )}
      {provider.oauth?.supported === true && (
        <Button
          size="sm"
          variant="primary"
          aria-label={`Sign in to ${displayName}`}
          disabled={starting}
          onClick={() => onSignIn(provider)}
        >
          {startingProvider === provider.provider ? 'Starting…' : 'Sign in'}
        </Button>
      )}
    </ProviderOptionRow>
  );
}
