import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Search } from 'lucide-react';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../shared/api/types';
import { useApplyProviderOMDefaults } from '../../../../../shared/hooks/use-om';
import {
  useCancelProviderOAuth,
  useProvidersQuery,
  useStartProviderOAuth,
} from '../../../../../shared/hooks/use-providers';
import { useFactoryAuth } from '../../../../../shared/hooks/useFactoryAuth';
import { useSetFactoryDefaultModelMutation } from '../../../../../shared/hooks/useFactoryDefaultModel';
import { useAvailableModelsQuery } from '../../../../../shared/hooks/useAvailableModels';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { AddApiKeyDialog } from '../../settings/components/AddApiKeyDialog';
import { ModelCombobox } from '../../settings/components/ModelCombobox';
import { providerDisplayName } from '../../settings/components/provider-display-name';
import { ProviderOAuthDialog } from '../../settings/components/ProviderOAuthDialog';

export interface ModelProviderFactoryStepProps {
  factoryId: string;
  completionError?: string;
  onComplete: () => void;
}

interface ActiveOAuthSession {
  provider: string;
  session: OAuthStartResponse;
}

const RECOMMENDED_PROVIDER_IDS = new Set(['anthropic', 'openai']);

function preferredFactoryModel(providerId: string): string | undefined {
  switch (providerId) {
    case 'openai':
      return 'openai/gpt-5.6-sol';
    case 'anthropic':
      return 'anthropic/claude-fable-5';
    default:
      return undefined;
  }
}

function isConfigured(provider: ProviderInfo): boolean {
  return provider.source !== 'none';
}

export function ModelProviderFactoryStep({ factoryId, completionError, onComplete }: ModelProviderFactoryStepProps) {
  const providersQuery = useProvidersQuery();
  const modelsQuery = useAvailableModelsQuery();
  const authQuery = useFactoryAuth();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const setDefaultModel = useSetFactoryDefaultModelMutation(factoryId);
  const applyOMDefaults = useApplyProviderOMDefaults();
  const [providerId, setProviderId] = useState<string>();
  const [providerSearch, setProviderSearch] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();
  const [activeOAuth, setActiveOAuth] = useState<ActiveOAuthSession>();
  const [error, setError] = useState<string>();

  const providers = [...(providersQuery.data ?? [])].sort((left, right) => {
    if (isConfigured(left) !== isConfigured(right)) return isConfigured(left) ? -1 : 1;
    return providerDisplayName(left.provider).localeCompare(providerDisplayName(right.provider));
  });
  const searchQuery = providerSearch.trim().toLowerCase();
  const primaryProviders = providers.filter(
    provider =>
      isConfigured(provider) || provider.oauth?.supported === true || RECOMMENDED_PROVIDER_IDS.has(provider.provider),
  );
  const visibleProviders = searchQuery
    ? providers.filter(provider => {
        const displayName = providerDisplayName(provider.provider).toLowerCase();
        return provider.provider.toLowerCase().includes(searchQuery) || displayName.includes(searchQuery);
      })
    : primaryProviders;
  const connectedProviders = visibleProviders.filter(isConfigured);
  const availableProviders = visibleProviders.filter(provider => !isConfigured(provider));
  const selectedProvider = providers.find(provider => provider.provider === providerId);
  const providerConfigured = selectedProvider ? isConfigured(selectedProvider) : false;
  const providerModels = (modelsQuery.data ?? []).filter(model => model.provider === providerId);
  const preferredModelId = providerId ? preferredFactoryModel(providerId) : undefined;
  const modelId =
    selectedModelId || providerModels.find(model => model.id === preferredModelId)?.id || providerModels[0]?.id || '';
  const saving = setDefaultModel.isPending || applyOMDefaults.isPending;
  const pending = saving || startOAuthMutation.isPending;
  const catalogError = providersQuery.error ?? modelsQuery.error;

  const selectProvider = (nextProviderId: string) => {
    setProviderId(nextProviderId);
    setSelectedModelId('');
    setError(undefined);
  };

  const startOAuth = async (provider: ProviderInfo) => {
    setError(undefined);
    try {
      const modes = provider.oauth?.modes ?? [];
      const session = await startOAuthMutation.mutateAsync({
        provider: provider.provider,
        mode: modes.length === 1 ? modes[0] : undefined,
      });
      setActiveOAuth({ provider: provider.provider, session });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to start provider sign in');
    }
  };

  const closeOAuth = () => {
    const flow = activeOAuth;
    setActiveOAuth(undefined);
    if (flow) cancelOAuthMutation.mutate({ provider: flow.provider, sessionId: flow.session.sessionId });
  };

  const finish = async () => {
    if (!providerId || !modelId) return;
    setError(undefined);
    try {
      await Promise.all([
        setDefaultModel.mutateAsync(modelId),
        applyOMDefaults.mutateAsync({ providerId, factoryModelId: modelId }),
      ]);
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to configure model defaults');
    }
  };

  return (
    <section aria-label="Model provider setup" className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-5 rounded-2xl border border-border1 bg-surface2/80 p-5">
        {providersQuery.isPending || modelsQuery.isPending ? (
          <SkeletonRows label="Loading model providers" rows={3} rowClassName="h-9 w-full" />
        ) : catalogError instanceof Error ? (
          <Txt as="p" variant="ui-sm" className="m-0 text-notice-destructive-fg" role="alert">
            {catalogError.message}
          </Txt>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-icon3" />
              <Input
                type="search"
                placeholder="Search all providers…"
                value={providerSearch}
                onChange={event => setProviderSearch(event.target.value)}
                aria-label="Search model providers"
                className="pl-8"
              />
            </div>
            {connectedProviders.length > 0 && (
              <div className="flex flex-col gap-2">
                <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
                  Connected providers
                </Txt>
                <div className="flex flex-wrap gap-2" aria-label="Connected providers">
                  {connectedProviders.map(provider => (
                    <Button
                      key={provider.provider}
                      variant={providerId === provider.provider ? 'primary' : 'outline'}
                      aria-label={providerDisplayName(provider.provider)}
                      disabled={pending}
                      onClick={() => selectProvider(provider.provider)}
                    >
                      {providerDisplayName(provider.provider)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {availableProviders.length > 0 && (
              <div className="flex flex-col gap-2">
                <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
                  {searchQuery ? 'Available providers' : 'Recommended providers'}
                </Txt>
                <div className="flex flex-wrap gap-2" aria-label="Available providers">
                  {availableProviders.map(provider => (
                    <Button
                      key={provider.provider}
                      variant={providerId === provider.provider ? 'primary' : 'outline'}
                      aria-label={providerDisplayName(provider.provider)}
                      disabled={pending}
                      onClick={() => selectProvider(provider.provider)}
                    >
                      {providerDisplayName(provider.provider)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {visibleProviders.length === 0 && (
              <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
                {searchQuery ? `No providers match “${providerSearch.trim()}”.` : 'No model providers are available.'}
              </Txt>
            )}
          </div>
        )}

        {selectedProvider && !providerConfigured && (
          <div className="flex flex-wrap gap-2">
            {selectedProvider.oauth?.supported === true && (
              <Button
                variant="primary"
                disabled={startOAuthMutation.isPending}
                onClick={() => void startOAuth(selectedProvider)}
              >
                {startOAuthMutation.isPending ? 'Starting…' : 'Sign in'}
              </Button>
            )}
            <Button
              variant={selectedProvider.oauth?.supported === true ? 'outline' : 'primary'}
              onClick={() => setKeyDialogProvider(selectedProvider)}
            >
              Use API key
            </Button>
          </div>
        )}

        {selectedProvider && providerConfigured && (
          <label className="flex flex-col gap-2">
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Factory default model
            </Txt>
            <ModelCombobox
              models={providerModels}
              value={modelId}
              onValueChange={setSelectedModelId}
              placeholder="Select a default model…"
              disabled={saving}
            />
          </label>
        )}

        {(error ?? completionError) && (
          <Txt as="p" variant="ui-sm" className="m-0 text-notice-destructive-fg" role="alert">
            {error ?? completionError}
          </Txt>
        )}

        {selectedProvider && providerConfigured && (
          <div>
            <Button variant="primary" disabled={!modelId || saving} onClick={() => void finish()}>
              {saving && <Spinner size="sm" aria-label="Saving model defaults" />}
              Finish setup
            </Button>
          </div>
        )}
      </div>

      {keyDialogProvider && (
        <AddApiKeyDialog
          provider={keyDialogProvider}
          authEnabled={authQuery.data?.authEnabled === true}
          onClose={() => setKeyDialogProvider(undefined)}
        />
      )}

      {activeOAuth && (
        <ProviderOAuthDialog
          provider={activeOAuth.provider}
          session={activeOAuth.session}
          onClose={closeOAuth}
          onComplete={() => setActiveOAuth(undefined)}
        />
      )}
    </section>
  );
}
