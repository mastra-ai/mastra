import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitBranch } from 'lucide-react';
import type { OnboardingPreviewProps } from './OnboardingPreview';
import { OnboardingAnnotation } from './OnboardingAnnotation';

export function OnboardingCodebasePreview({ repository }: Pick<OnboardingPreviewProps, 'repository' | 'factoryName'>) {
  return (
    <section aria-label="Codebase preview" className="relative h-full">
      <OnboardingAnnotation x={147} y={57} width={160}>
        <Txt variant="meta" tone="muted">
          Your Factory, built on your code
        </Txt>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={38} y={310} width={246}>
        <Txt variant="caption" className="truncate">
          {repository?.fullName ?? 'Your repository'}
        </Txt>
        <div className="text-muted-foreground mt-2 flex items-center gap-2">
          <GitBranch className="size-3 shrink-0" />
          <Txt variant="meta" tone="muted">
            {repository?.defaultBranch ?? 'Selected branch'}
          </Txt>
        </div>
      </OnboardingAnnotation>
    </section>
  );
}
