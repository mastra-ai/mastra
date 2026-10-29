import { Button } from '@mastra/playground-ui/components/Button';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, KeyRound, LogIn, ServerCog } from 'lucide-react';
import { useId, useState } from 'react';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { CustomProviderForm } from '../../settings/components/CustomProviderForm';
import type { PreviewProvider, ProviderConnection, ProviderConnectionMethod } from '../hooks/useProviderConnection';
import { CONNECTION_METHOD_LABEL, matchesProviderQuery } from '../hooks/useProviderConnection';
import { ProviderBrandIcon } from './ProviderBrandIcon';

type ProviderPickerTab = ProviderConnectionMethod | 'custom';

export function ModelProviderPicker({
  connection,
  onPreviewProvider,
}: {
  connection: ProviderConnection;
  onPreviewProvider?: PreviewProvider;
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<ProviderPickerTab>(connection.method ?? 'api_key');
  const connectedDescriptionId = useId();
  if (connection.isPending)
    return (
      <div role="status" aria-label="Loading model providers">
        <div aria-hidden>
          <Skeleton className="h-control-sm w-56 max-w-full rounded-full motion-reduce:before:animate-none" />
          <div className="flex h-36 flex-col gap-3 pt-2">
            <Skeleton className="h-control-md w-full rounded-full motion-reduce:before:animate-none" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-control-md w-28 rounded-full motion-reduce:before:animate-none" />
              <Skeleton className="h-control-md w-32 rounded-full motion-reduce:before:animate-none" />
              <Skeleton className="h-control-md w-24 rounded-full motion-reduce:before:animate-none" />
            </div>
          </div>
        </div>
      </div>
    );
  if (connection.catalogError)
    return (
      <div className="flex flex-col items-start gap-3">
        <Txt variant="caption" role="alert">
          {connection.catalogError.message}
        </Txt>
        <Button onClick={connection.retry}>Retry</Button>
      </div>
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
        value={tab}
        onValueChange={next => {
          setTab(next);
          onPreviewProvider?.(undefined, next === 'custom' ? undefined : next);
        }}
      >
        <TabList variant="pill-ghost" size="sm">
          <Tab value="api_key">
            <KeyRound aria-hidden="true" />
            {CONNECTION_METHOD_LABEL.api_key}
          </Tab>
          <Tab value="oauth">
            <LogIn aria-hidden="true" />
            {CONNECTION_METHOD_LABEL.oauth}
          </Tab>
          <Tab value="custom">
            <ServerCog aria-hidden="true" />
            Custom provider
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
            <span id={connectedDescriptionId} hidden>
              Connected
            </span>
            <div role="group" aria-label="API key providers" className="flex flex-wrap gap-2 overflow-y-auto">
              {visible.map(provider => (
                <Button
                  key={provider.provider}
                  aria-label={providerDisplayName(provider.provider)}
                  aria-describedby={connection.isConfigured(provider, 'api_key') ? connectedDescriptionId : undefined}
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
                  {connection.isConfigured(provider, 'api_key') && <Check aria-hidden="true" />}
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
        <TabContent value="custom">
          <div className="pt-2">
            <CustomProviderForm
              requireModels
              onSaved={provider => {
                connection.chooseCustomProvider(provider.id);
                onPreviewProvider?.(provider.id, 'api_key');
              }}
            />
          </div>
        </TabContent>
      </Tabs>
    </div>
  );
}
