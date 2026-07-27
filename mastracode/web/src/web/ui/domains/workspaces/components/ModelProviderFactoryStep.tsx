import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { AnthropicChatIcon } from '@mastra/playground-ui/icons/AnthropicChatIcon';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { GoogleIcon } from '@mastra/playground-ui/icons/GoogleIcon';
import { GroqIcon } from '@mastra/playground-ui/icons/GroqIcon';
import { MistralIcon } from '@mastra/playground-ui/icons/MistralIcon';
import { OpenAIIcon } from '@mastra/playground-ui/icons/OpenAIIcon';
import { XGroqIcon } from '@mastra/playground-ui/icons/XGroqIcon';
import { Search } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
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

/** Brand marks for providers we can render an icon for; others get no icon. */
const PROVIDER_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  anthropic: AnthropicChatIcon,
  openai: OpenAIIcon,
  'openai-codex': OpenAIIcon,
  'github-copilot': GithubIcon,
  xai: XGroqIcon,
  google: GoogleIcon,
  groq: GroqIcon,
  mistral: MistralIcon,
};

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

function byConfiguredThenName(left: ProviderInfo, right: ProviderInfo): number {
  if (isConfigured(left) !== isConfigured(right)) return isConfigured(left) ? -1 : 1;
  return providerDisplayName(left.provider).localeCompare(providerDisplayName(right.provider));
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

  const providers = [...(providersQuery.data ?? [])].sort(byConfiguredThenName);
  // Providers with a browser sign-in flow get first-class sign-in buttons; the
  // rest connect with an API key from the searchable list below the divider.
  const signInProviders = providers.filter(provider => provider.oauth?.supported === true);
  const keyProviders = providers.filter(provider => provider.oauth?.supported !== true);
  const searchQuery = providerSearch.trim().toLowerCase();
  // Without a search the API-key list stays quiet (connected providers only),
  // sign-in-page style; searching reveals the full catalog.
  const visibleKeyProviders = searchQuery
    ? keyProviders.filter(provider => {
        const displayName = providerDisplayName(provider.provider).toLowerCase();
        return provider.provider.toLowerCase().includes(searchQuery) || displayName.includes(searchQuery);
      })
    : keyProviders.filter(isConfigured);
  const selectedProvider = providers.find(provider => provider.provider === providerId);
  const providerConfigured = selectedProvider ? isConfigured(selectedProvider) : false;
  const SelectedProviderIcon = selectedProvider ? PROVIDER_ICONS[selectedProvider.provider] : undefined;
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

  const chooseSignInProvider = (provider: ProviderInfo) => {
    selectProvider(provider.provider);
    if (!isConfigured(provider)) void startOAuth(provider);
  };

  const chooseKeyProvider = (provider: ProviderInfo) => {
    selectProvider(provider.provider);
    if (!isConfigured(provider)) setKeyDialogProvider(provider);
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
      <div className="border-border1 bg-surface2/80 flex flex-col gap-5 rounded-2xl border p-5">
        {providersQuery.isPending || modelsQuery.isPending ? (
          <SkeletonRows label="Loading model providers" rows={3} rowClassName="h-9 w-full" />
        ) : catalogError instanceof Error ? (
          <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg m-0" role="alert">
            {catalogError.message}
          </Txt>
        ) : selectedProvider && providerConfigured ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {SelectedProviderIcon && <SelectedProviderIcon aria-hidden="true" className="size-4" />}
                <Txt as="span" variant="ui-md" className="text-icon6">
                  {providerDisplayName(selectedProvider.provider)}
                </Txt>
              </div>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setProviderId(undefined);
                  setSelectedModelId('');
                  setError(undefined);
                }}
              >
                Change provider
              </Button>
            </div>
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
            <Button variant="primary" className="w-full" disabled={!modelId || saving} onClick={() => void finish()}>
              {saving && <Spinner size="sm" aria-label="Saving model defaults" />}
              Finish setup
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {signInProviders.length > 0 && (
              <div className="flex flex-col gap-2" aria-label="Sign in with a provider">
                {signInProviders.map(provider => {
                  const ProviderIcon = PROVIDER_ICONS[provider.provider];
                  const connected = isConfigured(provider);
                  return (
                    <Button
                      key={provider.provider}
                      size="lg"
                      variant={providerId === provider.provider ? 'primary' : 'default'}
                      className="w-full"
                      disabled={pending}
                      onClick={() => chooseSignInProvider(provider)}
                    >
                      {ProviderIcon && <ProviderIcon aria-hidden="true" />}
                      {connected
                        ? `${providerDisplayName(provider.provider)} connected`
                        : `Continue with ${providerDisplayName(provider.provider)}`}
                    </Button>
                  );
                })}
              </div>
            )}

            {signInProviders.length > 0 && (
              <div className="flex items-center gap-3" aria-hidden="true">
                <div className="bg-border1 h-px flex-1" />
                <Txt as="span" variant="ui-sm" className="text-icon3">
                  OR
                </Txt>
                <div className="bg-border1 h-px flex-1" />
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search size={14} className="text-icon3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
                <Input
                  type="search"
                  placeholder="Search providers to connect with an API key…"
                  value={providerSearch}
                  onChange={event => setProviderSearch(event.target.value)}
                  aria-label="Search model providers"
                  className="pl-8"
                />
              </div>
              {visibleKeyProviders.length > 0 && (
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto" aria-label="API key providers">
                  {visibleKeyProviders.map(provider => (
                    <Button
                      key={provider.provider}
                      variant={providerId === provider.provider ? 'primary' : 'outline'}
                      aria-label={providerDisplayName(provider.provider)}
                      disabled={pending}
                      onClick={() => chooseKeyProvider(provider)}
                    >
                      {providerDisplayName(provider.provider)}
                    </Button>
                  ))}
                </div>
              )}
              {searchQuery && visibleKeyProviders.length === 0 && (
                <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
                  {`No providers match “${providerSearch.trim()}”.`}
                </Txt>
              )}
            </div>
          </div>
        )}

        {(error ?? completionError) && (
          <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg m-0" role="alert">
            {error ?? completionError}
          </Txt>
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
