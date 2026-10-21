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
    <div className="flex min-h-0 w-full flex-col">
      <section aria-label="Project management connections" className="-mx-3 min-h-0 space-y-1 overflow-y-auto px-3">
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
      <div className="mt-8 flex shrink-0 items-center gap-2">
        <Button variant={anyConnected ? 'primary' : 'ghost'} size="lg" onClick={onContinue}>
          {anyConnected ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}
