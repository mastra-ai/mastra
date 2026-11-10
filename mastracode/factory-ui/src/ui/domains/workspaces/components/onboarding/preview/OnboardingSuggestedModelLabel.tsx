import { Txt } from '@mastra/playground-ui/components/Txt';
import { useProviderModels } from '../../../hooks/useProviderModels';

export function OnboardingSuggestedModelLabel({ providerId, scope }: { providerId: string; scope: 'org' | 'user' }) {
  const catalog = useProviderModels(providerId, scope);
  return (
    <Txt variant="meta" tone="muted" className="truncate">
      {catalog.suggestedModelId ?? 'Choose a model'}
    </Txt>
  );
}
