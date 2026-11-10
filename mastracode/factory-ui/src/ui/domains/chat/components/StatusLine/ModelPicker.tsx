import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { ModelPicker as SharedModelPicker } from '@mastra/playground-ui/domains/llm';
import type { ModelPickerProvider } from '@mastra/playground-ui/domains/llm';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { KeyRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import { useChatConnection } from '../../context/useChatConnection';
import { useChatModelScope } from '../../context/useChatModelScope';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { useChatModels } from '../../context/useChatModels';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { ProviderBrandIcon } from '../../../workspaces/components/ProviderBrandIcon';
import { sessionDefaultsAnchor, settingsSectionPath } from '../../../settings/settingsSections';
import { LockedModelButton } from './LockedModelButton';
import { ModelCredential } from './ModelCredential';
import { ModelCredentialSummary } from './ModelCredentialSummary';
import { ModelProviderMark } from './ModelProviderMark';
import { useOrganizationScopedFactory } from './useOrganizationScopedFactory';
import { ModelThinkingGroup } from './ModelThinkingGroup';
import { SessionThinkingBars } from './SessionThinkingBars';
import { SessionThinkingSettings } from './SessionThinkingSettings';

function groupByProvider(models: AvailableModelOption[]): [string, AvailableModelOption[]][] {
  const groups = new Map<string, AvailableModelOption[]>();
  for (const model of models) {
    const group = groups.get(model.provider);
    if (group) group.push(model);
    else groups.set(model.provider, [model]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** The shared picker keys models within their provider, so drop the provider prefix. */
const withinProvider = (provider: string, modelId: string) =>
  modelId.startsWith(`${provider}/`) ? modelId.slice(provider.length + 1) : modelId;

function canSwitchModel({
  kind,
  draftSessionId,
  sessionEnabled,
  modelLockedReason,
}: Pick<ChatSessionContextApi, 'kind' | 'draftSessionId' | 'sessionEnabled' | 'modelLockedReason'>): boolean {
  if (modelLockedReason) return false;
  if (kind === 'user' && draftSessionId) return true;
  return sessionEnabled;
}

function useModelSwitch() {
  const chatSession = useChatSessionContext();
  const { activeModelId, defaultModelId, pendingModelId, setModel } = useChatModels();
  const { catalogTarget, modelScope, scopeLoading } = useChatModelScope();
  const modelsQuery = useAvailableModelsQuery(catalogTarget);

  const selectedModelId = pendingModelId ?? activeModelId;
  const busy = Boolean(pendingModelId);

  const pickModel = (modelId: string) => {
    if (busy || modelId === activeModelId) return;
    void setModel(modelId).catch((cause: unknown) => {
      toast.error(cause instanceof Error ? cause.message : 'Failed to switch model');
    });
  };

  return {
    modelsQuery,
    activeModelId,
    selectedModelId,
    defaultModelId,
    scopeLoading,
    busy,
    switchable: canSwitchModel(chatSession),
    locked: busy || modelsQuery.isPending || scopeLoading,
    canReset:
      chatSession.kind === 'user' &&
      modelScope !== 'factory' &&
      Boolean(defaultModelId) &&
      selectedModelId !== defaultModelId &&
      Boolean(modelsQuery.data?.some(model => model.id === defaultModelId)),
    pickModel,
  };
}

type ModelSwitch = ReturnType<typeof useModelSwitch>;

interface ModelMenuProps {
  modelSwitch: ModelSwitch;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
  /** Controls under the model list, e.g. the thinking level. */
  settings?: ReactNode;
  children: ReactNode;
}

const renderProviderIcon = (provider: string) => (
  <ProviderBrandIcon provider={provider} fallback={<KeyRound className="size-3.5" />} />
);

function ModelMenu({
  modelSwitch,
  triggerClassName,
  triggerAriaLabel,
  side,
  align,
  settings,
  children,
}: ModelMenuProps) {
  const { modelsQuery, selectedModelId, defaultModelId, canReset, locked, pickModel } = modelSwitch;
  const location = useLocation();
  const { factoryId, modelScope } = useChatModelScope();
  const organizationScoped = useOrganizationScopedFactory();
  const providers: ModelPickerProvider[] = groupByProvider(modelsQuery.data ?? []).map(([provider, models]) => ({
    id: provider,
    name: providerDisplayName(provider),
    models: models.map(model => ({ id: withinProvider(provider, model.id), releaseDate: model.releaseDate })),
  }));
  const defaultProvider = modelsQuery.data?.find(option => option.id === defaultModelId)?.provider;
  const toModelId = (provider: string, model: string) =>
    modelsQuery.data?.find(
      option => option.provider === provider && (option.id === `${provider}/${model}` || option.id === model),
    )?.id;
  const selected = modelsQuery.data?.find(option => option.id === selectedModelId);
  const selectedProvider = selected?.provider ?? selectedModelId?.split('/')[0];
  const selectedModel =
    selectedModelId && selectedProvider ? withinProvider(selectedProvider, selectedModelId) : undefined;

  return (
    <SharedModelPicker
      providers={providers}
      value={selectedModel && selectedProvider ? { provider: selectedProvider, model: selectedModel } : undefined}
      onValueChange={({ provider, model }) => {
        const modelId = toModelId(provider, model);
        if (modelId) pickModel(modelId);
      }}
      defaultModel={
        defaultModelId && defaultProvider
          ? { provider: defaultProvider, model: withinProvider(defaultProvider, defaultModelId) }
          : undefined
      }
      renderProviderIcon={renderProviderIcon}
      header={<ModelCredentialSummary modelId={selectedModelId} />}
      settings={settings}
      addProvider={
        factoryId
          ? {
              // Only organization credentials feed this list, so a personal connection would not show up in it.
              label: organizationScoped ? 'Add an organization credential' : 'Connect a provider',
              render: (
                <Link
                  to={settingsSectionPath(factoryId, 'models', sessionDefaultsAnchor(modelScope))}
                  state={{ from: location }}
                />
              ),
            }
          : undefined
      }
      resetLabel={canReset ? 'Reset to your default' : undefined}
      busy={locked}
      side={side}
      align={align}
      triggerClassName={triggerClassName}
      aria-label={triggerAriaLabel}
      title={selectedModelId}
    >
      {children}
    </SharedModelPicker>
  );
}

export function ModelPicker() {
  const modelSwitch = useModelSwitch();
  const { modelsQuery, activeModelId, selectedModelId, scopeLoading, switchable, busy } = modelSwitch;
  const { modelLockedReason } = useChatSessionContext();
  const { status } = useChatConnection();
  const { isLoading, error } = useChatModels();
  const { factoryId } = useParams<{ factoryId: string }>();
  const organizationScoped = useOrganizationScopedFactory();

  if (!selectedModelId && (isLoading || status === 'connecting')) {
    return <Skeleton aria-label="Loading model" className="h-3.5 w-24" />;
  }
  if (!selectedModelId && error) {
    return (
      <span className="text-destructive-foreground" aria-label="Model unavailable" title={error.message}>
        Model unavailable
      </span>
    );
  }

  if (modelLockedReason && activeModelId) {
    return (
      <>
        <ModelCredential />
        <ModelThinkingGroup modelId={activeModelId} lockedReason={modelLockedReason}>
          <LockedModelButton modelId={activeModelId} reason={modelLockedReason} />
        </ModelThinkingGroup>
      </>
    );
  }

  const label = selectedModelId ? formatModelName(selectedModelId) : 'No model';
  const notConfigured =
    !scopeLoading &&
    Boolean(selectedModelId) &&
    modelsQuery.isSuccess &&
    !modelsQuery.data.some(model => model.id === selectedModelId);

  const noModelsToOffer = !modelsQuery.isPending && !modelsQuery.data?.length;
  if (modelsQuery.isError && noModelsToOffer) {
    const unavailableLabel = `${label}: model list unavailable`;
    return (
      <span className="text-destructive-foreground" aria-label={unavailableLabel} title={modelsQuery.error.message}>
        <Metadata>
          <Metadata.Item>{label}</Metadata.Item>
          <Metadata.Item>model list unavailable</Metadata.Item>
        </Metadata>
      </span>
    );
  }
  if (!switchable || noModelsToOffer) {
    if (notConfigured && organizationScoped && factoryId) {
      return (
        <span className="text-destructive-foreground" title={selectedModelId}>
          <Metadata>
            <Metadata.Item>{label}</Metadata.Item>
            <Metadata.Item>
              <Link to={settingsSectionPath(factoryId, 'models')} className="underline underline-offset-2">
                needs an organization credential
              </Link>
            </Metadata.Item>
          </Metadata>
        </span>
      );
    }
    return (
      <>
        <ModelCredential />
        <span
          className={notConfigured ? 'text-destructive-foreground' : 'text-muted-foreground'}
          aria-label={notConfigured ? `${label} is not configured` : undefined}
          title={selectedModelId}
        >
          <Metadata>
            <Metadata.Item>{label}</Metadata.Item>
            {notConfigured && <Metadata.Item>not configured</Metadata.Item>}
          </Metadata>
        </span>
      </>
    );
  }

  return (
    <ModelMenu
      modelSwitch={modelSwitch}
      triggerAriaLabel={notConfigured ? `Session model, ${label} is not configured` : 'Session model'}
      triggerClassName={notConfigured ? 'text-destructive-foreground' : undefined}
      settings={<SessionThinkingSettings modelId={activeModelId} switchingModel={busy} />}
    >
      <ModelProviderMark modelId={selectedModelId} provider={selectedModelId?.split('/')[0]} />
      <Metadata singleLine className="max-w-48 max-sm:max-w-28">
        <Metadata.Item>{label}</Metadata.Item>
        {notConfigured && <Metadata.Item className="shrink-0">not configured</Metadata.Item>}
      </Metadata>
      <SessionThinkingBars modelId={activeModelId} switchingModel={busy} />
    </ModelMenu>
  );
}

export function ChangeModelAction() {
  const modelSwitch = useModelSwitch();
  if (!modelSwitch.switchable || !modelSwitch.modelsQuery.data?.length) return null;
  return (
    <ModelMenu modelSwitch={modelSwitch} side="bottom" align="start">
      Change model
    </ModelMenu>
  );
}
