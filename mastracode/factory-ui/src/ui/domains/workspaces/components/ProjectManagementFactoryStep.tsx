import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useWorkSourceConnections } from '../hooks/useWorkSourceConnections';
import type { WorkSource } from '../hooks/useWorkSourceConnections';
import { OnboardingInset } from './onboarding/OnboardingInset';
import { OnboardingLinearConnection } from './onboarding/OnboardingLinearConnection';
import { OnboardingPlatformConnection } from './onboarding/OnboardingPlatformConnection';
import { OnboardingStepCard } from './onboarding/OnboardingStepCard';

export interface ProjectManagementFactoryStepProps {
  onConnect: () => void;
  onContinue: () => void;
  onPreviewSource?: (source: WorkSource) => void;
}

export function ProjectManagementFactoryStep({
  onConnect,
  onContinue,
  onPreviewSource,
}: ProjectManagementFactoryStepProps) {
  const anyConnected = Object.values(useWorkSourceConnections()).some(Boolean);
  return (
    <OnboardingStepCard
      section="project-management"
      headerEnd={
        <Txt variant="meta" tone="muted">
          Where new issues come from
        </Txt>
      }
      note={anyConnected ? 'You’ll choose which issues to bring in after setup' : undefined}
      primary={
        <Button variant={anyConnected ? 'primary' : 'ghost'} onClick={onContinue}>
          {anyConnected ? 'Continue' : 'Skip for now'}
        </Button>
      }
    >
      <OnboardingInset>
        <div onMouseEnter={() => onPreviewSource?.('linear')} onFocus={() => onPreviewSource?.('linear')}>
          <OnboardingLinearConnection onConnect={onConnect} />
        </div>
        <div onMouseEnter={() => onPreviewSource?.('jira')} onFocus={() => onPreviewSource?.('jira')}>
          <OnboardingPlatformConnection provider="jira" />
        </div>
        <div onMouseEnter={() => onPreviewSource?.('incident-io')} onFocus={() => onPreviewSource?.('incident-io')}>
          <OnboardingPlatformConnection provider="incident-io" />
        </div>
      </OnboardingInset>
    </OnboardingStepCard>
  );
}
