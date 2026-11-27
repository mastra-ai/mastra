import type { ModelPack, ModelSelectionRequest } from '@mastra/factory/model-packs';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { ModelPicker as SharedModelPicker } from '@mastra/playground-ui/domains/llm';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import { catalogModelPickerValue, findPickerModel, modelPickerProviders } from '../../../../lib/modelPickerCatalog';
import { useChatConnection } from '../../context/useChatConnection';
import { useChatModelScope } from '../../context/useChatModelScope';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { useChatModels } from '../../context/useChatModels';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { useChatThinking } from '../../context/useChatThinking';
import { useModelCredential } from '../../hooks/useModelCredential';
import { ProviderBrandIcon } from '../../../workspaces/components/ProviderBrandIcon';
import { sessionDefaultsAnchor, settingsSectionPath } from '../../../settings/settingsSections';
import { ModelCredential } from './ModelCredential';
import { ModelCredentialSummary } from './ModelCredentialSummary';
import { ModelPackSection } from './ModelPackSection';
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
  const { activeModelId, modelPacks, defaultModelPack, selectedPack, switching, select } = useChatModels();
  const thinking = useChatThinking();
  const { catalogTarget, modelScope, scopeLoading } = useChatModelScope();
  const modelsQuery = useAvailableModelsQuery(catalogTarget);
  const defaultPackModelId = defaultModelPack?.models[0]?.modelId;

  const pick = (selection: ModelSelectionRequest, fallbackMessage: string) => {
    if (switching) return;
    void select(selection).catch((cause: unknown) => {
      toast.error(cause instanceof Error ? cause.message : fallbackMessage);
    });
  };

  return {
    modelsQuery,
    activeModelId,
    modelPacks,
    defaultModelPack,
    selectedPack,
    scopeLoading,
    busy: switching,
    switchable: canSwitchModel(chatSession),
    locked: switching || modelsQuery.isPending || scopeLoading,
    canReset:
      chatSession.kind === 'user' &&
      modelScope !== 'factory' &&
      defaultModelPack !== undefined &&
      selectedPack?.id !== defaultModelPack.id &&
      Boolean(modelsQuery.data?.some(model => model.id === defaultPackModelId)),
    pickModel: (modelId: string) => {
      if (selectedPack || modelId !== activeModelId) {
        pick({ kind: 'model', modelId, thinkingLevel: thinking.override }, 'Failed to switch model');
      }
    },
    pickPack: (pack: ModelPack) => {
      if (pack.id !== selectedPack?.id) pick({ kind: 'pack', packId: pack.id }, 'Failed to switch model pack');
    },
    resetToDefault: () => pick({ kind: 'default' }, 'Failed to switch model'),
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
  const { modelsQuery, activeModelId, selectedPack, modelPacks, defaultModelPack, canReset, locked } = modelSwitch;
  const location = useLocation();
  const { factoryId, modelScope } = useChatModelScope();
  const organizationScoped = useOrganizationScopedFactory();
  const catalog = modelsQuery.data ?? [];
  const selected = catalog.find(option => option.id === activeModelId);
  const selectedProvider = selected?.provider ?? activeModelId?.split('/')[0];
  const value =
    !selectedPack && activeModelId && selectedProvider
      ? catalogModelPickerValue({ id: activeModelId, provider: selectedProvider })
      : undefined;

  return (
    <SharedModelPicker
      providers={modelPickerProviders(catalog)}
      value={value}
      onValueChange={({ provider, model }) => {
        const modelId = findPickerModel(catalog, { provider, model })?.id;
        if (modelId) modelSwitch.pickModel(modelId);
      }}
      renderProviderIcon={renderProviderIcon}
      header={
        <>
          <ModelCredentialSummary modelId={activeModelId} />
          <ModelPackSection
            packs={modelPacks}
            selectedPackId={selectedPack?.id}
            defaultPackId={defaultModelPack?.id}
            disabled={locked}
            onPick={modelSwitch.pickPack}
            renderProviderIcon={renderProviderIcon}
          />
        </>
      }
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
      reset={canReset ? { label: 'Reset to your default', onClick: modelSwitch.resetToDefault } : undefined}
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
  const modelCredential = useModelCredential(modelSwitch.activeModelId);
  const credentialNote =
    modelCredential &&
    (modelCredential.warning ?? `${modelCredential.credential}: ${modelCredential.holderDescription}`);
  return (
    <ModelMenu
      modelSwitch={modelSwitch}
      triggerAriaLabel={`${modelAriaLabel}. Thinking: ${summary}`}
      triggerClassName={triggerClassName}
      unavailableReason={credentialNote ? `${lockedReason} ${credentialNote}.` : lockedReason}
    >
      {children}
    </ModelMenu>
  );
}

export function ModelPicker() {
  const modelSwitch = useModelSwitch();
  const { modelsQuery, activeModelId, selectedPack, scopeLoading, switchable, busy } = modelSwitch;
  const { modelLockedReason } = useChatSessionContext();
  const { status } = useChatConnection();
  const { isLoading, error } = useChatModels();
  const { factoryId } = useParams<{ factoryId: string }>();
  const organizationScoped = useOrganizationScopedFactory();

  if (!activeModelId && (isLoading || status === 'connecting')) {
    return (
      <div role="status" aria-label="Loading model" className="flex items-center gap-1.5">
        <Skeleton className="size-4 rounded-full motion-reduce:before:animate-none" />
        <Skeleton data-composer-line-hidden className="h-3.5 w-20 motion-reduce:before:animate-none" />
      </div>
    );
  }
  if (!activeModelId && error) {
    return (
      <span className="text-destructive-foreground" aria-label="Model unavailable" title={error.message}>
        Model unavailable
      </span>
    );
  }

  const label = activeModelId ? formatModelName(activeModelId) : 'No model';
  const notConfigured =
    !scopeLoading &&
    Boolean(activeModelId) &&
    modelsQuery.isSuccess &&
    !modelsQuery.data.some(model => model.id === activeModelId);
  const trigger = (
    <>
      <ModelProviderMark modelId={activeModelId} provider={activeModelId?.split('/')[0]} />
      <Metadata
        singleLine
        className="max-w-48 max-sm:max-w-28"
        data-composer-line-hidden={notConfigured ? undefined : ''}
      >
        {selectedPack && <Metadata.Item className="shrink-0">{selectedPack.name}</Metadata.Item>}
        <Metadata.Item>{label}</Metadata.Item>
        {notConfigured && <Metadata.Item className="shrink-0">not configured</Metadata.Item>}
      </Metadata>
      <span className="flex shrink-0" data-composer-line-hidden>
        <SessionThinkingIcon modelId={activeModelId} switchingModel={busy} />
      </span>
    </>
  );

  if (modelLockedReason && activeModelId) {
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
        <span className="text-destructive-foreground" title={activeModelId}>
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
          title={activeModelId}
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
