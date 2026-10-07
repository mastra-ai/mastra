import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';

import { useModelReasoningOptions } from '../../../../../hooks/useAvailableModels';
import { useChatModels } from '../../context/useChatModels';
import { thinkingLevelOptionsForModel } from '../../services/thinkingLevels';

interface SessionThinkingControlProps {
  modelId: string;
  switchingModel: boolean;
}

export function SessionThinkingControl({ modelId, switchingModel }: SessionThinkingControlProps) {
  const { effectiveThinkingLevel, setThinkingLevel } = useChatModels();
  const reasoningOptions = useModelReasoningOptions(modelId);
  const options = thinkingLevelOptionsForModel(modelId, reasoningOptions);

  if (!effectiveThinkingLevel) {
    return (
      <ThinkingLevelUnavailable options={options} label="Thinking" reason="The thinking level isn't loaded yet." />
    );
  }
  if (switchingModel) {
    return <ThinkingLevelUnavailable options={options} label="Thinking" reason="Switching model…" />;
  }

  return (
    <ThinkingLevelPicker
      options={options}
      value={effectiveThinkingLevel}
      label="Thinking"
      description="More thinking answers harder problems, slower and at a higher cost."
      onChange={level =>
        setThinkingLevel(level).catch((cause: unknown) =>
          toast.error(cause instanceof Error ? cause.message : 'Failed to change thinking level'),
        )
      }
    />
  );
}
