import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { useParams } from 'react-router';

import { useFactoryThinkingDefaultQuery } from '../../../../hooks/use-thinking';
import { useModelReasoningOptions } from '../../../../hooks/useAvailableModels';
import type { AvailableModelsTarget } from '../../../../hooks/useAvailableModels';
import { resolveEffectiveThinkingLevel } from '../services/thinkingLevels';
import type { EffectiveThinkingLevel } from '../services/thinkingLevels';

export function useEffectiveThinkingLevel(
  modelId: string | undefined,
  override: ThinkingLevelSetting | undefined,
  catalogTarget?: AvailableModelsTarget,
): { level: EffectiveThinkingLevel | undefined; loadError: Error | undefined } {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryDefaultQuery = useFactoryThinkingDefaultQuery(factoryId);
  const reasoningOptions = useModelReasoningOptions(modelId, catalogTarget);
  const level = resolveEffectiveThinkingLevel({
    modelId,
    reasoningOptions,
    override,
    factoryDefault: factoryDefaultQuery.data,
  });
  const loadError = factoryDefaultQuery.error ?? undefined;
  return { level, loadError: level ? undefined : loadError };
}
