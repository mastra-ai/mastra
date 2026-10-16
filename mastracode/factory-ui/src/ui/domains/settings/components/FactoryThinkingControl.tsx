import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { runThinkingLevel } from '@mastra/code-sdk/thinking';
import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useFactoryThinkingDefaultQuery, useSetFactoryThinkingDefaultMutation } from '../../../../hooks/use-thinking';
import { thinkingLevelOptionsForModel } from '../../chat/services/thinkingLevels';

function thinkingWriteFailureMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Failed to change thinking level';
  if ('status' in error && error.status === 403) return 'Only organization admins can change the thinking level';
  return error.message;
}

interface FactoryThinkingControlProps {
  factoryId: string;
  modelId: string;
  models: AvailableModelOption[];
  modelsLoaded: boolean;
}

export function FactoryThinkingControl({ factoryId, modelId, models, modelsLoaded }: FactoryThinkingControlProps) {
  const levelQuery = useFactoryThinkingDefaultQuery(factoryId);
  const setLevel = useSetFactoryThinkingDefaultMutation(factoryId);
  const reasoningOptions = models.find(model => model.id === modelId)?.reasoningOptions;
  const options = thinkingLevelOptionsForModel(modelId, reasoningOptions);

  if (levelQuery.isError) {
    return (
      <ThinkingLevelUnavailable options={options} label="Thinking" reason="The thinking level couldn't be loaded." />
    );
  }
  if (levelQuery.data === undefined) {
    return (
      <ThinkingLevelUnavailable options={options} label="Thinking" reason="The thinking level isn't loaded yet." />
    );
  }
  if (!modelsLoaded) {
    return (
      <ThinkingLevelUnavailable
        options={options}
        label="Thinking"
        reason="The default model's thinking levels aren't available."
      />
    );
  }

  return (
    <ThinkingLevelPicker
      options={options}
      value={runThinkingLevel(modelId, levelQuery.data, reasoningOptions)}
      label="Thinking"
      description="Used by every session and work-item run in this Factory until it picks its own level."
      onChange={(level: ThinkingLevelSetting) =>
        setLevel.mutateAsync(level).catch(error => toast.error(thinkingWriteFailureMessage(error)))
      }
    />
  );
}
