import { useState } from 'react';
import type { ProviderInfo } from '../../../../api/types';
import type { OnboardingDraftModel } from '../services/onboardingFlow';
import { useProviderConnection } from './useProviderConnection';
import type { ProviderConnection, ProviderSelection } from './useProviderConnection';
import { useProviderModels } from './useProviderModels';
import type { ProviderModels } from './useProviderModels';

/** A restored choice that no longer resolves: its provider's connection changed, or the provider is gone. */
export interface OnboardingLostConnection {
  providerId: string;
  /** The provider left the provider list (e.g. a deleted custom provider), so it can't be connected again. */
  removed: boolean;
}

/** One account (company or personal) with its connected provider and chosen model. */
export interface OnboardingModelLane {
  connection: ProviderConnection;
  connectedProvider?: ProviderInfo;
  catalog: ProviderModels;
  /** The model shown in the picker: the saved pick while it still exists, else the suggestion. */
  modelId?: string;
  /** What Create submits for this lane, once a provider is connected and a model resolves. */
  choice?: OnboardingDraftModel;
  /** Set while the lane still holds a restored choice that no longer connects, so it can be explained. */
  lostConnection?: OnboardingLostConnection;
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

/**
 * Only a saved choice can be lost, and only while the lane still holds it: once the user picks or clears a
 * provider, the old choice is no longer theirs to explain. A choice is saved only after it connected, so a
 * saved provider that no longer connects (or left the list) always changed since the user chose it.
 */
function lostConnection(
  restored: OnboardingDraftModel | undefined,
  connection: ProviderConnection,
): OnboardingLostConnection | undefined {
  if (!restored || connection.isPending || connection.catalogError || connection.connected) return undefined;
  const stillRestored = connection.selectedProviderId === restored.providerId && connection.method === restored.method;
  if (!stillRestored) return undefined;
  return { providerId: restored.providerId, removed: !connection.provider };
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
    // A new provider starts without an explicit model, so the catalog suggestion applies; re-picking the
    // lane's own provider and method keeps the model the user chose for it.
    onSelectionChange: next => {
      if (!next) return onSave(undefined);
      const repicked = next.providerId === saved?.providerId && next.method === saved.method;
      onSave({ ...next, modelId: repicked ? saved.modelId : '' });
    },
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
    lostConnection: lostConnection(restored, connection),
    pickUnavailable: Boolean(pickedId) && !catalog.isPending && !modelId,
    pickModel: id => {
      if (selection) onSave({ ...selection, modelId: id });
    },
  };
}
