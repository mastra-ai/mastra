import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { CommandGroup, CommandItem, CommandSeparator } from '@mastra/playground-ui/components/Command';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import { ModelMenu } from '../../../../ui/ModelMenu';
import { useChatConnection } from '../../context/useChatConnection';
import { useChatModelScope } from '../../context/useChatModelScope';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { useChatModels } from '../../context/useChatModels';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { settingsSectionPath } from '../../../settings/settingsSections';
import { ModelScopeFooter, useOrganizationScopedFactory } from './ModelScopeFooter';
import { SessionThinkingControl } from './SessionThinkingControl';

function canSwitchModel(kind: ChatSessionContextApi['kind'], isDraft: boolean, sessionEnabled: boolean): boolean {
  if (kind === 'user' && isDraft) return true;
  return sessionEnabled;
}

export function ModelPicker() {
  const { kind, sessionEnabled, draftSessionId } = useChatSessionContext();
  const { status } = useChatConnection();
  const { activeModelId, defaultModelId, setModel, isLoading, error } = useChatModels();
  const { factoryId } = useParams<{ factoryId: string }>();
  const { catalogTarget, modelScope, scopeLoading } = useChatModelScope();
  const modelsQuery = useAvailableModelsQuery(catalogTarget);
  const organizationScoped = useOrganizationScopedFactory();
  const [open, setOpen] = useState(false);
  const [pendingModelId, setPendingModelId] = useState<string>();

  const selectedModelId = pendingModelId ?? activeModelId;
  const busy = Boolean(pendingModelId);

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
  const switchable = canSwitchModel(kind, Boolean(draftSessionId), sessionEnabled);
  const canReset =
    kind === 'user' &&
    modelScope !== 'factory' &&
    Boolean(defaultModelId) &&
    selectedModelId !== defaultModelId &&
    modelsQuery.data?.some(model => model.id === defaultModelId);

  const noModelsToOffer = !modelsQuery.isPending && !modelsQuery.data?.length;
  if (modelsQuery.isError && noModelsToOffer) {
    const unavailableLabel = `${label} · model list unavailable`;
    return (
      <span className="text-destructive-foreground" aria-label={unavailableLabel} title={modelsQuery.error.message}>
        {unavailableLabel}
      </span>
    );
  }
  if (!switchable || noModelsToOffer) {
    if (notConfigured && organizationScoped && factoryId) {
      return (
        <span className="text-destructive-foreground" title={selectedModelId}>
          {label} ·{' '}
          <Link to={settingsSectionPath(factoryId, 'models')} className="underline underline-offset-2">
            needs an organization credential
          </Link>
        </span>
      );
    }
    return (
      <span
        className={notConfigured ? 'text-destructive-foreground' : 'text-muted-foreground'}
        aria-label={notConfigured ? `${label} is not configured` : undefined}
        title={selectedModelId}
      >
        {label}
        {notConfigured ? ' · not configured' : null}
      </span>
    );
  }

  const runAction = (action: Promise<void>, failure: string) => {
    void action.then(
      () => setPendingModelId(undefined),
      (cause: unknown) => {
        setPendingModelId(undefined);
        toast.error(cause instanceof Error ? cause.message : failure);
      },
    );
  };

  const pickModel = (modelId: string) => {
    if (busy) return;
    setOpen(false);
    if (modelId === activeModelId) return;
    setPendingModelId(modelId);
    runAction(setModel(modelId), 'Failed to switch model');
  };
  const modelMenuLocked = busy || modelsQuery.isPending || scopeLoading;

  return (
    <ButtonsGroup size="sm" aria-label="Model and thinking">
      <ModelMenu
        models={modelsQuery.data ?? []}
        selectedModelId={selectedModelId}
        placeholder="No model"
        ariaLabel="Session model"
        open={open}
        onOpenChange={setOpen}
        onSelect={pickModel}
        locked={modelMenuLocked}
        notConfigured={notConfigured}
        defaultModelId={defaultModelId}
        footer={organizationScoped && factoryId ? <ModelScopeFooter factoryId={factoryId} /> : null}
        extraCommandGroups={
          canReset && defaultModelId ? (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="action:reset"
                  keywords={['reset', 'default', 'model']}
                  onSelect={() => pickModel(defaultModelId)}
                >
                  <RotateCcw aria-hidden />
                  <span>Reset to your default</span>
                </CommandItem>
              </CommandGroup>
            </>
          ) : null
        }
      />
      {activeModelId ? <SessionThinkingControl modelId={activeModelId} switchingModel={busy} /> : null}
    </ButtonsGroup>
  );
}
