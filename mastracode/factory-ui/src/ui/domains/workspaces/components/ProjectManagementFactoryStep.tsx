import { Button } from '@mastra/playground-ui/components/Button';
import { useWorkSourceConnections } from '../hooks/useWorkSourceConnections';
import type { WorkSource } from '../hooks/useWorkSourceConnections';
import { OnboardingLinearConnection } from './onboarding/OnboardingLinearConnection';
import { OnboardingPlatformConnection } from './onboarding/OnboardingPlatformConnection';

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
    <div className="w-full">
      <section aria-label="Project management connections" className="space-y-1">
        <div onMouseEnter={() => onPreviewSource?.('linear')} onFocus={() => onPreviewSource?.('linear')}>
          <OnboardingLinearConnection onConnect={onConnect} />
        </div>
        <div onMouseEnter={() => onPreviewSource?.('jira')} onFocus={() => onPreviewSource?.('jira')}>
          <OnboardingPlatformConnection provider="jira" />
        </div>
        <div onMouseEnter={() => onPreviewSource?.('incident-io')} onFocus={() => onPreviewSource?.('incident-io')}>
          <OnboardingPlatformConnection provider="incident-io" />
        </div>
      </section>
      <div className="mt-8 flex items-center gap-2">
        <Button variant={anyConnected ? 'primary' : 'ghost'} size="lg" onClick={onContinue}>
          {anyConnected ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}
