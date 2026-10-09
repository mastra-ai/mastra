import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitBranch, Paperclip } from 'lucide-react';
import type { OnboardingPreviewProps } from './OnboardingPreview';
import { OnboardingAnnotation } from './OnboardingAnnotation';

export function OnboardingCodebasePreview({ repository }: Pick<OnboardingPreviewProps, 'repository' | 'factoryName'>) {
  return (
    <section aria-label="Codebase preview" className="relative h-full">
      <OnboardingAnnotation x={20} y={282} width={158}>
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
      <OnboardingAnnotation x={232} y={282} width={164}>
        <Txt variant="caption">Agent session</Txt>
        <div className="text-muted-foreground mt-2 flex items-center gap-2">
          <Paperclip className="size-3 shrink-0" />
          <Txt variant="meta" tone="muted" className="truncate">
            {repository?.name ?? 'Repository'} attached
          </Txt>
        </div>
      </OnboardingAnnotation>
    </section>
  );
}
