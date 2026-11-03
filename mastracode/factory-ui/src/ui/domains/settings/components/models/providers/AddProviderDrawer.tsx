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
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Box } from 'lucide-react';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../../api/types';
import {
  useConnectMastraGateway,
  useMastraGatewayCreditsQuery,
  useStartProviderOAuth,
} from '../../../../../../hooks/use-providers';
import { mastraGatewayBilling } from '../../../../workspaces/components/mastra-gateway-credits';
import { ProviderBrandIcon } from '../../../../workspaces/components/ProviderBrandIcon';
import {
  CREDENTIAL_LABEL,
  SHARED_SOURCE,
  SIGN_IN_EXPIRED_LABEL,
  credentialAt,
  signInExpiredAt,
  signInRequest,
} from '../../provider-credential';
import type { CredentialScope } from '../../provider-credential';

const AUDIENCE: Record<CredentialScope, string> = {
  user: 'Only you can use it.',
  org: 'Everyone in your organization can use it.',
};

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
  const isMobile = useIsMobile();
  const startOAuthMutation = useStartProviderOAuth();
  const connectGatewayMutation = useConnectMastraGateway();
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  // The Mastra Gateway connects in one click, so it leads the default list.
  const sorted = providers.toSorted(
    (left, right) => Number(isGateway(right)) - Number(isGateway(left)) || left.provider.localeCompare(right.provider),
  );
  const signInProviders = sorted.filter(provider => isGateway(provider) || provider.oauth?.supported === true);
  const shown = query ? sorted.filter(provider => matchesSearch(provider, query)) : signInProviders;
  const keyOnlyCount = providers.filter(provider => provider.oauth?.supported !== true && takesApiKey(provider)).length;
  const startingProvider = startOAuthMutation.isPending
    ? startOAuthMutation.variables.provider
    : connectGatewayMutation.isPending
      ? providers.find(isGateway)?.provider
      : undefined;

  const signIn = (provider: ProviderInfo) => {
    startOAuthMutation.mutate(signInRequest(provider, requestScope), {
      onSuccess: session => onOAuthStarted(provider.provider, session),
    });
  };

  const connectGateway = () => {
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
    <Drawer
      side={isMobile ? 'bottom' : 'right'}
      variant={isMobile ? 'default' : 'floating'}
      overlay="visible"
      open={open}
      onOpenChange={closeUnlessStarting}
      onOpenChangeComplete={resetOnceHidden}
    >
      <DrawerContent aria-busy={startingProvider !== undefined || undefined}>
        <DrawerHeader>
          <DrawerTitle>Add provider</DrawerTitle>
          <DrawerDescription>
            Sign in with a subscription or paste an API key. {AUDIENCE[credentialScope]}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex min-h-0 flex-col gap-3">
          <SearchInput
            label="Search providers"
            placeholder={`Search ${providers.length} providers…`}
            value={search}
            onValueChange={setSearch}
          />
          <Txt as="p" variant="caption" tone="muted">
            {query ? `${shown.length} of ${providers.length} providers` : 'Sign in with a subscription'}
          </Txt>
          {shown.length === 0 ? (
            <Txt as="p" variant="caption" className="py-4 text-center">
              {emptyMessage(search)}
            </Txt>
          ) : (
            <ul className="border-border divide-border min-h-0 divide-y overflow-y-auto rounded-lg border">
              {shown.map(provider => (
                <AddProviderRow
                  key={provider.provider}
                  provider={provider}
                  credentialScope={credentialScope}
                  startingProvider={startingProvider}
                  onSignIn={() => (isGateway(provider) ? connectGateway() : signIn(provider))}
                  onAddKey={() => onAddKey(provider)}
                />
              ))}
            </ul>
          )}
          {!query && keyOnlyCount > 0 && (
            <Txt as="p" variant="caption" tone="muted">
              {keyOnlyCount} more take an API key. Type to find one.
            </Txt>
          )}
          {(startOAuthMutation.error ?? connectGatewayMutation.error) && (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {(startOAuthMutation.error ?? connectGatewayMutation.error)?.message}
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
  onAddKey,
}: {
  provider: ProviderInfo;
  credentialScope: CredentialScope;
  startingProvider: string | undefined;
  onSignIn: () => void;
  onAddKey: () => void;
}) {
  const displayName = providerDisplayName(provider.provider);
  const { data: gatewayCredits } = useMastraGatewayCreditsQuery({ enabled: isGateway(provider) });
  const label =
    connectionLabel(provider, credentialScope) ??
    (isGateway(provider) ? mastraGatewayBilling(gatewayCredits) : undefined);
  const starting = startingProvider !== undefined;
  return (
    <li className="flex min-h-12 items-center gap-3 py-2 pr-2 pl-3">
      <ProviderBrandIcon provider={provider.provider} fallback={<Box className="text-muted-foreground size-4" />} />
      <span className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" variant="caption" className="truncate">
          {displayName}
        </Txt>
        {label && (
          <Txt as="span" variant="meta" tone="muted">
            {label}
          </Txt>
        )}
      </span>
      {takesApiKey(provider) && (
        <Button size="sm" aria-label={`Add API key for ${displayName}`} disabled={starting} onClick={onAddKey}>
          API key
        </Button>
      )}
      {isGateway(provider) && !credentialAt(provider, credentialScope) && (
        <Button
          size="sm"
          variant="primary"
          aria-label={`Connect ${displayName}`}
          disabled={starting}
          onClick={onSignIn}
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
          onClick={onSignIn}
        >
          {startingProvider === provider.provider ? 'Starting…' : 'Sign in'}
        </Button>
      )}
    </li>
  );
}
