import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { useFallbackModelQuery } from '../../../../hooks/useAvailableModels';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { newChatCatalogTarget } from '../../chat/context/chatDefaultModel';
import { isConnectedAt } from '../../settings/components/provider-credential';

export interface MemberModelStep {
  /** Every lookup the step depends on has answered. */
  settled: boolean;
  /** The member has to connect a model of their own before a session can start here. */
  needsModel: boolean;
}

/**
 * Whether the member has a model of their own for this Factory's sessions. Only a Factory that bills sessions
 * to people (`user`, or `hybrid` for interactive sessions) asks; the scope comes from the Factory list the
 * layout already loaded, so any other Factory costs no request. Same rule as a new chat's guard
 * (`useDraftModelGuards`): the personal default, else the server's personal fallback, on a provider the member
 * is connected to. A lookup that fails asks for nothing, leaving the inline step to explain.
 */
export function useMemberModelStep(factoryId: string | undefined): MemberModelStep {
  const factory = useFactoryQuery(factoryId);
  const modelScope = factory.data?.modelScope;
  const personal = modelScope === 'user' || modelScope === 'hybrid';
  const personalDefault = useDefaultModelQuery({ enabled: personal });
  const chosenModelId = personalDefault.data?.modelId ?? undefined;
  const fallback = useFallbackModelQuery({
    ...newChatCatalogTarget('user', factoryId),
    enabled: personal && personalDefault.isSuccess && !chosenModelId,
  });
  const modelId = chosenModelId ?? fallback.data;
  const providers = useProvidersQuery({ enabled: personal && Boolean(modelId) });
  const answer = (settled: boolean, needsModel = false): MemberModelStep => ({ settled, needsModel });

  if (!factory.isSuccess) return answer(!factory.isPending);
  if (!personal) return answer(true);
  if (personalDefault.isError || fallback.isError || providers.isError) return answer(true);
  if (!personalDefault.isSuccess || (!chosenModelId && !fallback.isSuccess)) return answer(false);
  if (!modelId) return answer(true, true);
  if (!providers.isSuccess) return answer(false);
  // A provider missing from the list (a custom one, say) is the chat guard's business, not setup's.
  const provider = providers.data.find(entry => entry.provider === modelId.split('/')[0]);
  return answer(true, provider !== undefined && !isConnectedAt(provider, 'user'));
}
