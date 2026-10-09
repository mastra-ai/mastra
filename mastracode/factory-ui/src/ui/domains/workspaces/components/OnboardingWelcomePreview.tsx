import { Txt } from '@mastra/playground-ui/components/Txt';
import { OnboardingAnnotation } from './OnboardingAnnotation';

export function OnboardingWelcomePreview() {
  return (
    <section aria-label="Welcome illustration" className="relative h-full">
      <OnboardingAnnotation x={20} y={300} width={112}>
        <Txt variant="meta" tone="muted">
          Issues & ideas
        </Txt>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={147} y={57} width={126}>
        <Txt variant="meta" tone="muted">
          Build & review
        </Txt>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={288} y={300} width={110}>
        <Txt variant="meta" tone="muted">
          Ready to ship
        </Txt>
      </OnboardingAnnotation>
    </section>
  );
}
