import { Txt } from '@mastra/playground-ui/components/Txt';
import { OnboardingSuggestedModelLabel } from './OnboardingSuggestedModelLabel';

export function OnboardingModelLabel({
  providerId,
  model,
  scope,
}: {
  providerId?: string;
  model?: string;
  scope: 'org' | 'user';
}) {
  if (!model && providerId) return <OnboardingSuggestedModelLabel providerId={providerId} scope={scope} />;
  return (
    <Txt variant="meta" tone="muted" className="truncate">
      {model ?? 'Choose a model'}
    </Txt>
  );
}
