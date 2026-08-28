import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Search } from 'lucide-react';
import { useState } from 'react';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import { providerDisplayName } from '../../settings/components/provider-display-name';
import type { ProviderConnection } from '../hooks/useProviderConnection';
import { isProviderConfigured, matchesProviderQuery } from '../hooks/useProviderConnection';
import { ProviderBrandIcon } from './ProviderBrandIcon';

/** Sign-in buttons for the providers that support it, then an API-key search for the rest. */
export function ModelProviderPicker({ connection }: { connection: ProviderConnection }) {
  const [search, setSearch] = useState('');

  if (connection.isPending) return <SkeletonRows label="Loading model providers" rows={3} rowClassName="h-9 w-full" />;
  if (connection.catalogError) {
    return (
      <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg m-0" role="alert">
        {connection.catalogError.message}
      </Txt>
    );
  }

  const visibleKeyProviders = connection.keyProviders.filter(provider => matchesProviderQuery(provider, search));

  return (
    <div className="flex flex-col gap-4">
      {connection.signInProviders.length > 0 && (
        <>
          <div role="group" className="flex flex-col gap-2" aria-label="Sign in with a provider">
            {connection.signInProviders.map(provider => (
              <Button
                key={provider.provider}
                size="lg"
                variant={connection.provider?.provider === provider.provider ? 'primary' : 'default'}
                className="w-full"
                disabled={connection.pending}
                onClick={() => connection.chooseSignInProvider(provider)}
              >
                <ProviderBrandIcon provider={provider.provider} />
                {isProviderConfigured(provider)
                  ? `${providerDisplayName(provider.provider)} connected`
                  : `Continue with ${providerDisplayName(provider.provider)}`}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="bg-border1 h-px flex-1" />
            <Txt as="span" variant="ui-sm" className="text-icon3">
              OR
            </Txt>
            <div className="bg-border1 h-px flex-1" />
          </div>
        </>
      )}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={14} className="text-icon3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Search providers to connect with an API key…"
            value={search}
            onChange={event => setSearch(event.target.value)}
            aria-label="Search model providers"
            className="pl-8"
          />
        </div>
        {visibleKeyProviders.length > 0 && (
          <div role="group" className="flex max-h-40 flex-wrap gap-2 overflow-y-auto" aria-label="API key providers">
            {visibleKeyProviders.map(provider => (
              <Button
                key={provider.provider}
                variant={connection.provider?.provider === provider.provider ? 'primary' : 'outline'}
                aria-label={providerDisplayName(provider.provider)}
                disabled={connection.pending}
                onClick={() => connection.chooseKeyProvider(provider)}
              >
                {providerDisplayName(provider.provider)}
              </Button>
            ))}
          </div>
        )}
        {search.trim() && visibleKeyProviders.length === 0 && (
          <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
            {`No providers match “${search.trim()}”.`}
          </Txt>
        )}
      </div>
    </div>
  );
}
