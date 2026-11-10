import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { useParams } from 'react-router';

import { useFactoryThinkingDefaultQuery } from '../../../../hooks/use-thinking';
import { useModelReasoningOptions } from '../../../../hooks/useAvailableModels';
import type { AvailableModelsTarget } from '../../../../hooks/useAvailableModels';
import type { FactoryModelScope } from '../../workspaces/services/github';
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
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryDefaultQuery = useFactoryThinkingDefaultQuery(factoryId);
  const reasoningOptions = useModelReasoningOptions(modelId, catalogTarget);
  const thinkingDefault = routedThinkingDefault(modelScope, personalDefault, factoryDefaultQuery.data);
  const level = resolveEffectiveThinkingLevel({ modelId, reasoningOptions, override, thinkingDefault });
  const loadError = factoryDefaultQuery.error ?? personalDefaultError ?? undefined;
  return { level, thinkingDefault, loadError: level ? undefined : loadError };
}
