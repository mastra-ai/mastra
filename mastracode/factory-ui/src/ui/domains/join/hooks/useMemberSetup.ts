import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { useFallbackModelQuery } from '../../../../hooks/useAvailableModels';
import { useChannelAccountsQuery } from '../../../../hooks/useChannelAccounts';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { newChatCatalogTarget } from '../../chat/context/chatDefaultModel';
import { isConnectedAt } from '../../settings/components/provider-credential';
import type { ConnectedChannelAccount } from '../../settings/services/channelAccounts';
import type { FactoryModelScope } from '../../workspaces/services/github';

/** `needed`: the member has to act. `done`: nothing to do. `none`: this Factory doesn't ask for it. */
export type MemberSetupStepState = 'needed' | 'done' | 'none';

export interface MemberModelStep {
  /** Every lookup the step depends on has answered. */
  settled: boolean;
  modelScope: FactoryModelScope | undefined;
  /** A model the member's own sessions can run on: their personal default, or a connected provider's. */
  model: MemberSetupStepState;
}

/**
 * Whether the member has a model of their own for this Factory's sessions. Only a Factory that bills sessions
 * to people (`user`, or `hybrid` for interactive sessions) asks; the scope comes from the Factory list the
 * layout already loaded, so any other Factory costs no request. Same rule as a new chat's guard
 * (`useDraftModelGuards`): the personal default, else the server's personal fallback, on a provider the member
 * is connected to. A lookup that fails settles as nothing to ask, leaving the inline step to explain.
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

  if (!factory.isSuccess) return { settled: !factory.isPending, modelScope, model: 'none' };
  if (!personal) return { settled: true, modelScope, model: 'none' };
  if (personalDefault.isError || fallback.isError || providers.isError) {
    return { settled: true, modelScope, model: 'none' };
  }
  if (!personalDefault.isSuccess || (!chosenModelId && !fallback.isSuccess)) {
    return { settled: false, modelScope, model: 'none' };
  }
  if (!modelId) return { settled: true, modelScope, model: 'needed' };
  if (!providers.isSuccess) return { settled: false, modelScope, model: 'none' };
  const provider = providers.data.find(entry => entry.provider === modelId.split('/')[0]);
  // A provider missing from the list (a custom one, say) is the chat guard's business, not setup's.
  const connected = !provider || isConnectedAt(provider, 'user');
  return { settled: true, modelScope, model: connected ? 'done' : 'needed' };
}

export interface MemberSetup extends MemberModelStep {
  /** Their Slack account linked, so a mention runs as them. Optional: never blocks working in the Factory. */
  slack: MemberSetupStepState;
  slackAccount: ConnectedChannelAccount | undefined;
  /** Something the member must do before a session can start. */
  needsSetup: boolean;
}

/** What a member still has to do before they can work in this Factory: their own model, then (optional) Slack. */
export function useMemberSetup(factoryId: string | undefined): MemberSetup {
  const model = useMemberModelStep(factoryId);
  const channels = useChannelAccountsQuery();
  const slackAccount = channels.data?.accounts.find(account => account.platform === 'slack');
  const slack: MemberSetupStepState = slackAccount ? 'done' : channels.data?.canConnect ? 'needed' : 'none';
  return {
    ...model,
    settled: model.settled && !channels.isPending,
    slack,
    slackAccount,
    needsSetup: model.model === 'needed',
  };
}
