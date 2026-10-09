import { Txt } from '@mastra/playground-ui/components/Txt';
import { useProviderModels } from '../hooks/useProviderModels';

/** Share the picker’s suggested model until the user makes an explicit choice. */
export function OnboardingModelLabel({
  providerId,
  model,
  emptyLabel = 'Your default model',
}: {
  providerId?: string;
  model?: string;
  emptyLabel?: string;
}) {
  const catalog = useProviderModels(providerId);
  const label = model ?? catalog.suggestedModelId ?? emptyLabel;
  return (
    <Txt key={label} variant="meta" tone="muted" className="onboarding-context truncate">
      {label}
    </Txt>
  );
}
