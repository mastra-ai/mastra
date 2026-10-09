import { Txt } from '@mastra/playground-ui/components/Txt';
import { Sparkles } from 'lucide-react';
import type { OnboardingPreviewProps } from './OnboardingPreview';
import { OnboardingModelLabel } from './OnboardingModelLabel';
import { ProviderBrandIcon } from './ProviderBrandIcon';
import { OnboardingAccountLabels } from './OnboardingAccountLabels';
import { OnboardingSessionLabels } from './OnboardingSessionLabels';

export function OnboardingModelPreview({
  repository,
  model,
  providerId,
  connectionMethod,
}: Pick<OnboardingPreviewProps, 'repository' | 'model' | 'providerId' | 'connectionMethod'>) {
  const provider = providerId ?? model?.split('/')[0];
  const method = connectionMethod === 'oauth' ? 'Provider sign-in' : 'API key';
  return (
    <section aria-label="Default model preview" className="relative h-full">
      <div className="absolute inset-x-8 top-3 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-4 shrink-0">
            {provider ? (
              <ProviderBrandIcon provider={provider} />
            ) : (
              <Sparkles className="text-muted-foreground size-4" />
            )}
          </span>
          <OnboardingModelLabel providerId={providerId} model={model} />
        </div>
        <Txt variant="meta" tone="muted" className="shrink-0">
          Organization account
        </Txt>
      </div>
      <OnboardingAccountLabels />
      <OnboardingSessionLabels />
      <div className="onboarding-scene-detail absolute inset-x-7 top-[89%]" style={{ animationDelay: '160ms' }}>
        <Txt variant="caption">
          {repository?.name ? `Power the work in ${repository.name}` : 'One model for your Factory work'}
        </Txt>
        <Txt variant="meta" tone="muted" className="mt-2">
          {provider ? `${method} · shared Factory default` : 'Choose a provider to connect your model.'}
        </Txt>
      </div>
    </section>
  );
}
