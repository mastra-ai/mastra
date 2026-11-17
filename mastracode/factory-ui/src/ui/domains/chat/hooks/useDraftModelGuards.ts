import { useFallbackModelQuery } from '../../../../hooks/useAvailableModels';
import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { isConnectedAt } from '../../settings/components/provider-credential';
import { sessionDefaultsAnchor } from '../../settings/settingsSections';
import type { ModelDefaultsAnchor } from '../../settings/settingsSections';
import type { FactoryProject } from '../../workspaces/services/github';
import type { ChatSessionContextApi } from '../context/ChatSessionContext';
import { newChatCatalogTarget, routedDefaultModelId } from '../context/chatDefaultModel';

export interface MissingCredentialGuard {
  modelId: string;
  provider: string;
}

export interface DraftModelGuards {
  activeFactory: FactoryProject | undefined;
  defaultsAnchor: ModelDefaultsAnchor;
  missingModel: boolean;
  missingCredential: MissingCredentialGuard | undefined;
  configurationError: Error | undefined;
}

/** A hybrid Factory bills a person's own chats to them and card sessions to the Factory. */
export function useDraftModelGuards(
  factoryId: string | undefined,
  kind: ChatSessionContextApi['kind'],
): DraftModelGuards {
  const factoryQuery = useFactoryQuery(factoryId);
  const activeFactory = factoryQuery.data;
  const projectQuery = useFactoryProjectQuery(activeFactory?.id);
  const personalDefaultQuery = useDefaultModelQuery();
  const providersQuery = useProvidersQuery();
  const storedScope = projectQuery.data?.modelScope;
  const draftScope = storedScope === 'hybrid' ? kind : storedScope;
  const routedToFactory = draftScope === 'factory';
  const chosenModelId = routedDefaultModelId(draftScope, {
    factory: projectQuery.data?.defaultModelId,
    personal: personalDefaultQuery.data?.modelId,
  });
  const fallbackModelQuery = useFallbackModelQuery({
    ...newChatCatalogTarget(routedToFactory ? 'factory' : 'user', activeFactory?.id),
    enabled: projectQuery.isSuccess,
  });
  const chatModelId = chosenModelId ?? fallbackModelQuery.data;
  const chatModelSettled =
    Boolean(activeFactory) &&
    projectQuery.isSuccess &&
    (routedToFactory || personalDefaultQuery.isSuccess) &&
    (Boolean(chosenModelId) || fallbackModelQuery.isSuccess);
  const chatModelProvider = chatModelId
    ? providersQuery.data?.find(entry => entry.provider === chatModelId.split('/')[0])
    : undefined;
  const missingCredential =
    chatModelSettled &&
    chatModelId &&
    chatModelProvider &&
    !isConnectedAt(chatModelProvider, routedToFactory ? 'org' : 'user')
      ? { modelId: chatModelId, provider: chatModelProvider.provider }
      : undefined;
  const configurationError =
    projectQuery.error ??
    (routedToFactory ? null : personalDefaultQuery.error) ??
    (chosenModelId ? null : fallbackModelQuery.error) ??
    providersQuery.error ??
    undefined;

  return {
    activeFactory,
    defaultsAnchor: sessionDefaultsAnchor(draftScope),
    missingModel: chatModelSettled && !chatModelId,
    missingCredential,
    configurationError,
  };
}
