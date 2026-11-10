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
import { useStartProviderOAuth } from '../../../../../../hooks/use-providers';
import { useSidePanelDrawer } from '../../../../../lib/hooks/useSidePanelDrawer';
import {
  CREDENTIAL_LABEL,
  SCOPE_AUDIENCE,
  SHARED_SOURCE,
  SIGN_IN_EXPIRED_LABEL,
  credentialAt,
  signInExpiredAt,
  signInRequest,
} from '../../provider-credential';
import type { CredentialScope } from '../../provider-credential';
import { CustomEndpointIcon, OptionRow, ProviderOptionRow } from './ProviderRows';

function matchesSearch(provider: ProviderInfo, query: string): boolean {
  return (
    provider.provider.toLowerCase().includes(query) ||
    providerDisplayName(provider.provider).toLowerCase().includes(query)
  );
}

function takesApiKey(provider: ProviderInfo): boolean {
  return provider.source !== 'deployment';
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
  onAddCustomProvider,
  onClose,
}: {
  open: boolean;
  providers: ProviderInfo[];
  credentialScope: CredentialScope;
  requestScope: CredentialScope | undefined;
  onOAuthStarted: (provider: string, session: OAuthStartResponse) => void;
  onAddKey: (provider: ProviderInfo) => void;
  onAddCustomProvider: () => void;
  onClose: () => void;
}) {
  const sidePanel = useSidePanelDrawer();
  const startOAuthMutation = useStartProviderOAuth();
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const sorted = providers.toSorted((left, right) => left.provider.localeCompare(right.provider));
  const signInProviders = sorted.filter(provider => provider.oauth?.supported === true);
  const shown = query ? sorted.filter(provider => matchesSearch(provider, query)) : signInProviders;
  const keyOnlyCount = providers.filter(provider => provider.oauth?.supported !== true && takesApiKey(provider)).length;
  const startingProvider = startOAuthMutation.isPending ? startOAuthMutation.variables.provider : undefined;

  const signIn = (provider: ProviderInfo) => {
    startOAuthMutation.mutate(signInRequest(provider, requestScope), {
      onSuccess: session => onOAuthStarted(provider.provider, session),
    });
  };

  const closeUnlessStarting = (nextOpen: boolean) => {
    if (!nextOpen && startingProvider === undefined) onClose();
  };

  const resetOnceHidden = (nextOpen: boolean) => {
    if (nextOpen) return;
    setSearch('');
    startOAuthMutation.reset();
  };

  return (
    <Drawer {...sidePanel} open={open} onOpenChange={closeUnlessStarting} onOpenChangeComplete={resetOnceHidden}>
      <DrawerContent aria-busy={startingProvider !== undefined || undefined}>
        <DrawerHeader>
          <DrawerTitle>Add provider</DrawerTitle>
          <DrawerDescription>
            Sign in with a subscription or paste an API key. {SCOPE_AUDIENCE[credentialScope]}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex min-h-0 flex-col gap-3">
          <SearchInput
            label="Search providers"
            placeholder={`Search ${providers.length} providers`}
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
                  onSignIn={() => signIn(provider)}
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
          {/* Outside the searched list: the way out when no provider matches. */}
          <ul className="border-border shrink-0 rounded-lg border">
            <OptionRow icon={<CustomEndpointIcon />} title="Custom endpoint" detail="Any OpenAI-compatible API">
              <Button
                size="sm"
                aria-label="Add a custom endpoint"
                disabled={startingProvider !== undefined}
                onClick={onAddCustomProvider}
              >
                Add
              </Button>
            </OptionRow>
          </ul>
          {startOAuthMutation.error && (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {startOAuthMutation.error.message}
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
  const starting = startingProvider !== undefined;
  return (
    <ProviderOptionRow provider={provider.provider} label={connectionLabel(provider, credentialScope)}>
      {takesApiKey(provider) && (
        <Button size="sm" aria-label={`Add API key for ${displayName}`} disabled={starting} onClick={onAddKey}>
          API key
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
    </ProviderOptionRow>
  );
}
