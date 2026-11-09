import { toast } from '@mastra/playground-ui/components/Toaster';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { useAvailableModelsQuery, useModelReasoningOptions } from '../../../../../hooks/useAvailableModels';
import { useChatModelScope } from '../../context/useChatModelScope';
import type { ChatThinkingApi } from '../../context/ChatThinkingContext';
import { useChatThinking } from '../../context/useChatThinking';
import {
  ALL_THINKING_LEVEL_OPTIONS,
  DEFAULT_SOURCE_LABELS,
  thinkingLevelOptionsForModel,
} from '../../services/thinkingLevels';
import type { EffectiveThinkingLevel } from '../../services/thinkingLevels';

type SessionThinkingState =
  | { unavailableReason: string; loading: boolean }
  | { effective: EffectiveThinkingLevel; source: string };

function sessionThinkingState(
  modelId: string | undefined,
  catalogPending: boolean,
  thinking: ChatThinkingApi,
  switchingModel: boolean,
): SessionThinkingState {
  if (catalogPending) return { unavailableReason: "This model's thinking levels aren't loaded yet.", loading: true };
  if (thinking.loadError) return { unavailableReason: "The thinking level couldn't be loaded.", loading: false };
  if (!thinking.level) return { unavailableReason: "The thinking level isn't loaded yet.", loading: true };
  if (switchingModel) return { unavailableReason: 'Switching model…', loading: true };
  if (!modelId) return { unavailableReason: 'Pick a model first.', loading: false };
  const { origin } = thinking.level;
  return {
    effective: thinking.level,
    source: origin === 'session' ? 'this session' : DEFAULT_SOURCE_LABELS[origin],
  };
}

function showFailure(fallback: string) {
  return (cause: unknown) => toast.error(cause instanceof Error ? cause.message : fallback);
}

/** The session's thinking level for `modelId`, shared by the controls on and inside the model picker. */
export function useSessionThinking(modelId: string | undefined, switchingModel: boolean) {
  const thinking = useChatThinking();
  const { catalogTarget } = useChatModelScope();
  const catalog = useAvailableModelsQuery(catalogTarget);
  const reasoningOptions = useModelReasoningOptions(modelId, catalogTarget);
  const options = modelId ? thinkingLevelOptionsForModel(modelId, reasoningOptions) : ALL_THINKING_LEVEL_OPTIONS;

  const state = sessionThinkingState(modelId, catalog.isPending, thinking, switchingModel);

  return {
    options,
    state,
    setLevel: (next: ThinkingLevelSetting) =>
      thinking.setLevel(next).catch(showFailure('Failed to change thinking level')),
    resetLevel: () => thinking.resetLevel().catch(showFailure('Failed to reset thinking level')),
  };
}
