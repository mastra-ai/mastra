import type { ThinkingLevelSetting } from '@mastra/core/llm/reasoning';
import { DEFAULT_THINKING_LEVEL } from '@internal/factory-contract';

import { useSessionHost } from '../context/SessionHostContext';
import { useModelReasoningOptions } from '@mastra/react/hooks/factory';
import type { AvailableModelsTarget } from '@mastra/react/hooks/factory';
import type { FactoryModelScope } from '@internal/factory-contract';
import { resolveEffectiveThinkingLevel, routedThinkingDefault } from '../services/thinkingLevels';
import type { EffectiveThinkingLevel, PersonalThinkingDefault, ThinkingDefault } from '../services/thinkingLevels';

export function useEffectiveThinkingLevel({
  modelId,
  modelScope,
  override,
  catalogTarget,
  personalDefault,
  personalDefaultError,
}: {
  modelId: string | undefined;
  modelScope: FactoryModelScope | undefined;
  override: ThinkingLevelSetting | undefined;
  catalogTarget: AvailableModelsTarget | undefined;
  personalDefault: PersonalThinkingDefault;
  personalDefaultError: Error | null;
}): {
  level: EffectiveThinkingLevel | undefined;
  thinkingDefault: ThinkingDefault | undefined;
  loadError: Error | undefined;
} {
  const { factoryProjectId: factoryId, data } = useSessionHost();
  const projectQuery = data.useProjectSettings(factoryId);
  const factoryDefault = projectQuery.data
    ? (projectQuery.data.defaultThinkingLevel ?? DEFAULT_THINKING_LEVEL)
    : undefined;
  const reasoningOptions = useModelReasoningOptions(modelId, catalogTarget);
  const thinkingDefault = routedThinkingDefault(modelScope, personalDefault, factoryDefault);
  const level = resolveEffectiveThinkingLevel({ modelId, reasoningOptions, override, thinkingDefault });
  const loadError = projectQuery.error ?? personalDefaultError ?? undefined;
  return { level, thinkingDefault, loadError: level ? undefined : loadError };
}
