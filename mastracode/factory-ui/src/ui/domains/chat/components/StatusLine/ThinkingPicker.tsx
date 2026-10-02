import { resolveThinkingLevelForModel } from '@mastra/code-sdk/thinking';
import { ThinkingLevelBars, ThinkingLevelPicker } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';

import { THINKING_LEVEL_OPTIONS, thinkingLevelOptionsForModel } from '../../../settings/services/thinkingLevels';
import { useChatModels } from '../../context/useChatModels';
import { formatModelName } from './modelName';

function useModelThinking(modelId: string | undefined) {
  const { thinkingLevel } = useChatModels();
  if (!modelId || !thinkingLevel) return undefined;
  const options = thinkingLevelOptionsForModel(modelId);
  return {
    options,
    level: resolveThinkingLevelForModel(modelId, thinkingLevel),
    canThink: options.some(option => option.value !== 'off'),
  };
}

export function ModelThinkingBars({ modelId }: { modelId: string | undefined }) {
  const thinking = useModelThinking(modelId);
  if (!thinking?.canThink) return null;
  return <ThinkingLevelBars options={thinking.options} value={thinking.level} />;
}

export function ThinkingPicker({ modelId }: { modelId: string }) {
  const { setThinkingLevel } = useChatModels();
  const thinking = useModelThinking(modelId);
  if (!thinking) return null;

  return (
    <ThinkingLevelPicker
      options={thinking.canThink ? thinking.options : THINKING_LEVEL_OPTIONS}
      value={thinking.level}
      label="Thinking"
      unavailableReason={thinking.canThink ? undefined : `${formatModelName(modelId)} has no thinking levels`}
      description="More thinking answers harder problems, slower and at a higher cost."
      onChange={level =>
        setThinkingLevel(level).catch((cause: unknown) => {
          toast.error(cause instanceof Error ? cause.message : 'Failed to change thinking level');
        })
      }
    />
  );
}
