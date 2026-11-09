import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsNoticeRow, SettingsSkeleton } from '@mastra/playground-ui/new/settings';

import { useDefaultModelQuery } from '../../../../../../hooks/use-default-model';
import { useFallbackModelQuery, usePersonalAvailableModelsQuery } from '../../../../../../hooks/useAvailableModels';
import { PersonalDefaultModelPicker } from './PersonalDefaultModelPicker';

export function PersonalDefaultModel() {
  const defaultModelQuery = useDefaultModelQuery();
  const modelsQuery = usePersonalAvailableModelsQuery();
  const fallbackModelQuery = useFallbackModelQuery({ scope: 'user' });

  if (defaultModelQuery.isPending) {
    return <SettingsSkeleton label="Loading your default model" rows={2} />;
  }
  if (defaultModelQuery.error) {
    return (
      <SettingsNoticeRow>
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {defaultModelQuery.error.message}
        </Txt>
      </SettingsNoticeRow>
    );
  }

  return (
    <PersonalDefaultModelPicker
      savedModelId={defaultModelQuery.data.modelId ?? undefined}
      savedThinkingLevel={defaultModelQuery.data.thinkingLevel}
      models={modelsQuery.data}
      fallbackModelId={fallbackModelQuery.data}
    />
  );
}
