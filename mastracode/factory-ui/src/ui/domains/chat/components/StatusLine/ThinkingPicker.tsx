import { ThinkingLevelBars, ThinkingLevelPicker } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';

import { clampThinkingLevel, thinkingLevelOptionsForModel } from '../../../settings/services/thinkingLevels';
import { useChatModels } from '../../context/useChatModels';

function useModelThinking(modelId: string | undefined) {
  const { thinkingLevel } = useChatModels();
  if (!modelId || !thinkingLevel) return undefined;
  return {
    options: thinkingLevelOptionsForModel(modelId),
    level: clampThinkingLevel(modelId, thinkingLevel),
  };
}

export function ModelThinkingBars({ modelId }: { modelId: string | undefined }) {
  const thinking = useModelThinking(modelId);
  if (!thinking) return null;
  return <ThinkingLevelBars options={thinking.options} value={thinking.level} />;
}

export function ThinkingPicker({ modelId }: { modelId: string }) {
  const { switchModel, switching } = useChatModels();
  const thinking = useModelThinking(modelId);
  if (!thinking) return null;

  return (
    <ThinkingLevelPicker
      options={thinking.options}
      value={thinking.level}
      label="Thinking"
      unavailableReason={switching ? 'Switching model…' : undefined}
      description="More thinking answers harder problems, slower and at a higher cost."
      onChange={thinkingLevel =>
        switchModel({ thinkingLevel }).catch((cause: unknown) => {
          toast.error(cause instanceof Error ? cause.message : 'Failed to change thinking level');
        })
      }
    />
  );
}
