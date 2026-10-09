import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowRight, GitBranch, LayoutList, Sparkles } from 'lucide-react';

export interface InitialFactoryStepProps {
  onContinue: () => void;
}

export function InitialFactoryStep({ onContinue }: InitialFactoryStepProps) {
  return (
    <div className="flex flex-col items-start gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <GitBranch className="text-muted-foreground size-4" aria-hidden="true" />
          <Txt variant="caption" tone="muted">
            Connect your repository
          </Txt>
        </div>
        <div className="flex items-center gap-3">
          <LayoutList className="text-muted-foreground size-4" aria-hidden="true" />
          <Txt variant="caption" tone="muted">
            Bring in your work
          </Txt>
        </div>
        <div className="flex items-center gap-3">
          <Sparkles className="text-muted-foreground size-4" aria-hidden="true" />
          <Txt variant="caption" tone="muted">
            Choose your model
          </Txt>
        </div>
      </div>
      <Button variant="primary" size="lg" className="group/onboarding-action" onClick={onContinue}>
        Create my first factory
        <ArrowRight
          className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/onboarding-action:translate-x-0.5"
          aria-hidden="true"
        />
      </Button>
    </div>
  );
}
