import { Button } from '@mastra/playground-ui/components/Button';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, KeyRound, LogIn } from 'lucide-react';
import { useState } from 'react';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { providerDisplayName } from '../../settings/components/provider-display-name';
import type { PreviewProvider, ProviderConnection, ProviderConnectionMethod } from '../hooks/useProviderConnection';
import { matchesProviderQuery } from '../hooks/useProviderConnection';
import { ProviderBrandIcon } from './ProviderBrandIcon';

/** Connection method is independent of provider and credential ownership. */
export function ModelProviderPicker({
  connection,
  onPreviewProvider,
}: {
  connection: ProviderConnection;
  onPreviewProvider?: PreviewProvider;
}) {
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<ProviderConnectionMethod>('api_key');
  if (connection.isPending) return <SkeletonRows label="Loading model providers" rows={3} rowClassName="h-9 w-full" />;
  if (connection.catalogError)
    return (
      <Txt variant="caption" role="alert">
        {connection.catalogError.message}
      </Txt>
    );

  const visible = connection.keyProviders.filter(provider => matchesProviderQuery(provider, search));
  const restore = () => onPreviewProvider?.(connection.provider?.provider, connection.method);
  return (
    <div
      onMouseLeave={restore}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) restore();
      }}
    >
      <Tabs
        defaultTab="api_key"
        value={method}
        onValueChange={next => {
          setMethod(next);
          onPreviewProvider?.(undefined, next);
        }}
      >
        <TabList variant="pill-ghost" size="sm">
          <Tab value="api_key">
            <KeyRound aria-hidden="true" />
            API key
          </Tab>
          <Tab value="oauth">
            <LogIn aria-hidden="true" />
            Provider sign-in
          </Tab>
        </TabList>
        <TabContent value="api_key">
          <div className="flex h-36 flex-col gap-3 pt-2">
            <SearchInput
              label="Search model providers"
              placeholder="Search providers…"
              value={search}
              onValueChange={setSearch}
            />
            <div role="group" aria-label="API key providers" className="flex flex-wrap gap-2 overflow-y-auto">
              {visible.map(provider => (
                <Button
                  key={provider.provider}
                  aria-label={providerDisplayName(provider.provider)}
                  disabled={connection.pending || !connection.canConfigure(provider, 'api_key')}
                  onMouseEnter={() => onPreviewProvider?.(provider.provider, 'api_key')}
                  onFocus={() => onPreviewProvider?.(provider.provider, 'api_key')}
                  onClick={() => {
                    connection.chooseKeyProvider(provider);
                    onPreviewProvider?.(provider.provider, 'api_key');
                  }}
                >
                  <ProviderBrandIcon provider={provider.provider} />
                  {providerDisplayName(provider.provider)}
                  {connection.isConfigured(provider, 'api_key') && <Check aria-label="Connected" />}
                </Button>
              ))}
            </div>
            {visible.length === 0 && (
              <Txt variant="caption" tone="muted">
                {search.trim() ? `No providers match “${search.trim()}”.` : 'No API key providers available.'}
              </Txt>
            )}
          </div>
        </TabContent>
        <TabContent value="oauth">
          <div
            role="group"
            aria-label="Sign in with a provider"
            className="flex h-36 flex-col gap-2 overflow-y-auto pt-2"
          >
            {connection.signInProviders.map(provider => (
              <Button
                key={provider.provider}
                className="w-full"
                disabled={connection.pending || !connection.canConfigure(provider, 'oauth')}
                onMouseEnter={() => onPreviewProvider?.(provider.provider, 'oauth')}
                onFocus={() => onPreviewProvider?.(provider.provider, 'oauth')}
                onClick={() => {
                  connection.chooseSignInProvider(provider);
                  onPreviewProvider?.(provider.provider, 'oauth');
                }}
              >
                <ProviderBrandIcon provider={provider.provider} />
                {connection.isConfigured(provider, 'oauth')
                  ? `Use ${providerDisplayName(provider.provider)} connection`
                  : `Continue with ${providerDisplayName(provider.provider)}`}
              </Button>
            ))}
            {connection.signInProviders.length === 0 && (
              <Txt variant="caption" tone="muted">
                Provider sign-in isn’t available on this deployment. Use an API key.
              </Txt>
            )}
          </div>
        </TabContent>
      </Tabs>
    </div>
  );
}
