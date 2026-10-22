import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Box } from 'lucide-react';
import { useState } from 'react';

import type { ProviderInfo } from '../../../../../api/types';
import { ProviderBrandIcon } from '../../../workspaces/components/ProviderBrandIcon';
import { CREDENTIAL_LABEL, credentialAt } from '../provider-credential';
import type { CredentialScope } from '../provider-credential';

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

export function AddProviderDialog({
  providers,
  credentialScope,
  startingProvider,
  error,
  onSignIn,
  onAddKey,
  onClose,
}: {
  providers: ProviderInfo[];
  credentialScope: CredentialScope;
  startingProvider: string | undefined;
  error: string | undefined;
  onSignIn: (provider: ProviderInfo) => void;
  onAddKey: (provider: ProviderInfo) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const sorted = providers.toSorted((left, right) => left.provider.localeCompare(right.provider));
  const signInProviders = sorted.filter(provider => provider.oauth?.supported === true);
  const shown = query ? sorted.filter(provider => matchesSearch(provider, query)) : signInProviders;
  const keyOnlyCount = providers.length - signInProviders.length;

  return (
    <Dialog open onOpenChange={open => !open && onClose()} pending={startingProvider !== undefined}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add provider</DialogTitle>
          <DialogDescription>
            Sign in with a subscription or paste an API key. {AUDIENCE[credentialScope]}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
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
              No providers match “{search.trim()}”.
            </Txt>
          ) : (
            <ul className="border-border divide-border max-h-80 divide-y overflow-y-auto rounded-lg border">
              {shown.map(provider => {
                const displayName = providerDisplayName(provider.provider);
                const connected = credentialAt(provider, credentialScope);
                return (
                  <li key={provider.provider} className="flex min-h-12 items-center gap-3 py-2 pr-2 pl-3">
                    <ProviderBrandIcon
                      provider={provider.provider}
                      fallback={<Box className="text-muted-foreground size-4" />}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Txt as="span" variant="caption" className="truncate">
                        {displayName}
                      </Txt>
                      {connected && (
                        <Txt as="span" variant="meta" tone="muted">
                          {CREDENTIAL_LABEL[connected]}
                        </Txt>
                      )}
                    </span>
                    {provider.source !== 'deployment' && (
                      <Button
                        size="sm"
                        aria-label={`Add API key for ${displayName}`}
                        onClick={() => onAddKey(provider)}
                      >
                        API key
                      </Button>
                    )}
                    {provider.oauth?.supported === true && (
                      <Button
                        size="sm"
                        variant="primary"
                        aria-label={`Sign in to ${displayName}`}
                        disabled={startingProvider !== undefined}
                        onClick={() => onSignIn(provider)}
                      >
                        {startingProvider === provider.provider ? 'Starting…' : 'Sign in'}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!query && keyOnlyCount > 0 && (
            <Txt as="p" variant="caption" tone="muted">
              {keyOnlyCount} more take an API key. Type to find one.
            </Txt>
          )}
          {error && (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {error}
            </Txt>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
