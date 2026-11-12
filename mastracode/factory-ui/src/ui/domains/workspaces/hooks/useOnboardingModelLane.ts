import { useState } from 'react';
import type { ProviderInfo } from '../../../../api/types';
import type { OnboardingDraftModel } from '../services/onboardingFlow';
import { useProviderConnection } from './useProviderConnection';
import type { ProviderConnection, ProviderSelection } from './useProviderConnection';
import { useProviderModels } from './useProviderModels';
import type { ProviderModels } from './useProviderModels';

/** One account (company or personal) with its connected provider and chosen model. */
export interface OnboardingModelLane {
  connection: ProviderConnection;
  connectedProvider?: ProviderInfo;
  catalog: ProviderModels;
  /** The model shown in the picker: the saved pick while it still exists, else the suggestion. */
  modelId?: string;
  /** What Create submits for this lane, once a provider is connected and a model resolves. */
  choice?: OnboardingDraftModel;
  /** The restored provider and method no longer connect, so the saved choice cannot be used as is. */
  lostConnection: boolean;
  /** The saved model is gone from the connected provider's catalog. */
  pickUnavailable: boolean;
  pickModel: (modelId: string) => void;
}

/** The model the user explicitly picked for this provider, if any. */
function savedPick(saved: OnboardingDraftModel | undefined, providerId: string | undefined): string | undefined {
  if (!saved?.modelId) return undefined;
  if (saved.providerId !== providerId) return undefined;
  return saved.modelId;
}

function resolveModelId(catalog: ProviderModels, pickedId: string | undefined): string | undefined {
  if (!pickedId) return catalog.suggestedModelId;
  return catalog.models.find(model => model.id === pickedId)?.id;
}

/** Only a finished choice (provider plus model) can be lost; a provider picked but never connected just reopens the picker. */
function isLostConnection(restored: OnboardingDraftModel | undefined, connection: ProviderConnection): boolean {
  if (!restored?.modelId) return false;
  if (connection.isPending || connection.connected) return false;
  return connection.provider?.provider === restored.providerId && connection.method === restored.method;
}

export function useOnboardingModelLane({
  scope,
  saved,
  onSave,
}: {
  scope: 'org' | 'user';
  saved?: OnboardingDraftModel;
  onSave: (next?: OnboardingDraftModel) => void;
}): OnboardingModelLane {
  const [restored] = useState(saved);
  const connection = useProviderConnection({
    scope,
    initialSelection: saved,
    // A new provider starts without an explicit model, so the catalog suggestion applies.
    onSelectionChange: next => onSave(next && { ...next, modelId: '' }),
  });
  const connectedProvider = connection.connected ? connection.provider : undefined;
  const catalog = useProviderModels(connectedProvider?.provider, scope);
  const pickedId = savedPick(saved, connectedProvider?.provider);
  const modelId = resolveModelId(catalog, pickedId);
  const selection: ProviderSelection | undefined =
    connectedProvider && connection.method
      ? { providerId: connectedProvider.provider, method: connection.method }
      : undefined;

  return {
    connection,
    connectedProvider,
    catalog,
    modelId,
    choice: selection && modelId ? { ...selection, modelId } : undefined,
    lostConnection: isLostConnection(restored, connection),
    pickUnavailable: Boolean(pickedId) && !catalog.isPending && !modelId,
    pickModel: id => {
      if (selection) onSave({ ...selection, modelId: id });
    },
  };
}
