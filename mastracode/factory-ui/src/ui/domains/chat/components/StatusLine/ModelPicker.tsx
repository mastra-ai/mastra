import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { ModelPicker as SharedModelPicker } from '@mastra/playground-ui/domains/llm';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import { fromPickerValue, toPickerProviders, toPickerValue } from '../../services/modelPickerCatalog';
import { useChatConnection } from '../../context/useChatConnection';
import { useChatModelScope } from '../../context/useChatModelScope';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { useChatModels } from '../../context/useChatModels';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { ProviderBrandIcon } from '../../../workspaces/components/ProviderBrandIcon';
import { sessionDefaultsAnchor, settingsSectionPath } from '../../../settings/settingsSections';
import { ModelCredential } from './ModelCredential';
import { ModelCredentialSummary } from './ModelCredentialSummary';
import { ModelProviderMark } from './ModelProviderMark';
import { useOrganizationScopedFactory } from './useOrganizationScopedFactory';
import { SessionThinkingIcon } from './SessionThinkingIcon';
import { SessionThinkingSettings } from './SessionThinkingSettings';
import { useSessionThinking } from './useSessionThinking';
import { IconKey2 } from '@mastra/playground-ui/icons/central/IconKey2';

function canSwitchModel({
  draftSessionId,
  sessionEnabled,
  modelLockedReason,
}: Pick<ChatSessionContextApi, 'draftSessionId' | 'sessionEnabled' | 'modelLockedReason'>): boolean {
  if (modelLockedReason) return false;
  if (draftSessionId) return true;
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
  /** Keeps the trigger's look but disables it, explaining why in its tooltip. */
  unavailableReason?: string;
  children: ReactNode;
}

const renderProviderIcon = (provider: string) => (
  <ProviderBrandIcon provider={provider} fallback={<IconKey2 className="size-icon-sm" />} />
);

function ModelMenu({
  modelSwitch,
  triggerClassName,
  triggerAriaLabel,
  side,
  align,
  settings,
  unavailableReason,
  children,
}: ModelMenuProps) {
  const { modelsQuery, selectedModelId, defaultModelId, canReset, locked, pickModel } = modelSwitch;
  const location = useLocation();
  const { factoryId, modelScope } = useChatModelScope();
  const organizationScoped = useOrganizationScopedFactory();
  const models = modelsQuery.data ?? [];
  const providers = toPickerProviders(models);
  const selectedValue = toPickerValue(models, selectedModelId);
  const defaultValue = models.some(option => option.id === defaultModelId)
    ? toPickerValue(models, defaultModelId)
    : undefined;

  return (
    <SharedModelPicker
      providers={providers}
      value={selectedValue}
      onValueChange={value => {
        const modelId = fromPickerValue(models, value);
        if (models.some(option => option.id === modelId)) pickModel(modelId);
      }}
      defaultModel={defaultValue}
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
      reset={
        canReset && defaultModelId
          ? { label: 'Reset to your default', onClick: () => pickModel(defaultModelId) }
          : undefined
      }
      busy={locked}
      unavailableReason={unavailableReason}
      side={side}
      align={align}
      triggerClassName={triggerClassName}
      aria-label={triggerAriaLabel}
    >
      {children}
    </SharedModelPicker>
  );
}

function LockedModelMenu({
  modelSwitch,
  lockedReason,
  modelAriaLabel,
  triggerClassName,
  children,
}: Pick<ModelMenuProps, 'modelSwitch' | 'triggerClassName' | 'children'> & {
  lockedReason: string;
  modelAriaLabel: string;
}) {
  const { summary } = useSessionThinking(modelSwitch.activeModelId, modelSwitch.busy);
  return (
    <>
      <ModelCredential />
      <ModelMenu
        modelSwitch={modelSwitch}
        triggerAriaLabel={`${modelAriaLabel}. Thinking: ${summary}`}
        triggerClassName={triggerClassName}
        unavailableReason={lockedReason}
      >
        {children}
      </ModelMenu>
    </>
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

  const label = selectedModelId ? formatModelName(selectedModelId) : 'No model';
  const notConfigured =
    !scopeLoading &&
    Boolean(selectedModelId) &&
    modelsQuery.isSuccess &&
    !modelsQuery.data.some(model => model.id === selectedModelId);
  const trigger = (
    <>
      <ModelProviderMark modelId={selectedModelId} provider={selectedModelId?.split('/')[0]} />
      <Metadata singleLine className="max-w-48 max-sm:max-w-28">
        <Metadata.Item>{label}</Metadata.Item>
        {notConfigured && <Metadata.Item className="shrink-0">not configured</Metadata.Item>}
      </Metadata>
      <SessionThinkingIcon modelId={activeModelId} switchingModel={busy} />
    </>
  );

  if (modelLockedReason && selectedModelId) {
    return (
      <LockedModelMenu
        modelSwitch={modelSwitch}
        lockedReason={modelLockedReason}
        modelAriaLabel={notConfigured ? `Session model, ${label} is not configured` : `Session model: ${label}`}
        triggerClassName={notConfigured ? 'text-destructive-foreground' : undefined}
      >
        {trigger}
      </LockedModelMenu>
    );
  }

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
      {trigger}
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
