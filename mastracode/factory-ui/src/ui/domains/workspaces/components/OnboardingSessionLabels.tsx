import { Txt } from '@mastra/playground-ui/components/Txt';
import { OnboardingAnnotation } from './OnboardingAnnotation';

/** Labels sit outside the drawing and never move with the session sheets. */
export function OnboardingSessionLabels({ individual = false }: { individual?: boolean }) {
  return (
    <>
      <OnboardingAnnotation x={28} y={260} width={104}>
        <Txt variant="meta" tone="muted">
          {individual ? 'Teammate' : 'Factory work'}
        </Txt>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={148} y={260} width={104}>
        <Txt variant="meta" tone="muted">
          {individual ? 'Teammate' : 'Team sessions'}
        </Txt>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={268} y={260} width={104}>
        <Txt variant="meta" tone="muted">
          Your sessions
        </Txt>
      </OnboardingAnnotation>
    </>
  );
}
