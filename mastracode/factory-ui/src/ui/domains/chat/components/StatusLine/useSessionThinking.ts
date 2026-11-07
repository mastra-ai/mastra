import { toast } from '@mastra/playground-ui/components/Toaster';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { useAvailableModelsQuery, useModelReasoningOptions } from '../../../../../hooks/useAvailableModels';
import { useChatModelScope } from '../../context/useChatModelScope';
import type { ChatThinkingApi } from '../../context/ChatThinkingContext';
import { useChatThinking } from '../../context/useChatThinking';
import { DEFAULT_SOURCE_LABELS, thinkingLevelOptionsForModel } from '../../services/thinkingLevels';
import type { EffectiveThinkingLevel } from '../../services/thinkingLevels';

export type SessionThinkingState =
  | { unavailableReason: string; lockedLevel?: ThinkingLevelSetting }
  | { effective: EffectiveThinkingLevel; source: string };

function sessionThinkingState(
  catalogPending: boolean,
  thinking: ChatThinkingApi,
  switchingModel: boolean,
  lockedReason: string | undefined,
): SessionThinkingState {
  if (catalogPending) return { unavailableReason: "This model's thinking levels aren't loaded yet." };
  if (thinking.loadError) return { unavailableReason: "The thinking level couldn't be loaded." };
  if (!thinking.level) return { unavailableReason: "The thinking level isn't loaded yet." };
  if (switchingModel) return { unavailableReason: 'Switching model…' };
  if (lockedReason) return { unavailableReason: lockedReason, lockedLevel: thinking.level.level };
  const { origin } = thinking.level;
  return {
    effective: thinking.level,
    source: origin === 'session' ? 'this session' : DEFAULT_SOURCE_LABELS[origin],
  };
}

function showFailure(fallback: string) {
  return (cause: unknown) => toast.error(cause instanceof Error ? cause.message : fallback);
}

/** The session's thinking level for `modelId`, shared by the controls beside and inside the model picker. */
export function useSessionThinking(modelId: string, switchingModel: boolean, lockedReason?: string) {
  const thinking = useChatThinking();
  const { catalogTarget } = useChatModelScope();
  const catalog = useAvailableModelsQuery(catalogTarget);
  const reasoningOptions = useModelReasoningOptions(modelId, catalogTarget);
  const options = thinkingLevelOptionsForModel(modelId, reasoningOptions);

  const state = sessionThinkingState(catalog.isPending, thinking, switchingModel, lockedReason);

  return {
    options,
    state,
    setLevel: (next: ThinkingLevelSetting) =>
      thinking.setLevel(next).catch(showFailure('Failed to change thinking level')),
    resetLevel: () => thinking.resetLevel().catch(showFailure('Failed to reset thinking level')),
  };
}
