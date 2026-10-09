import { Button } from '@mastra/playground-ui/components/Button';
import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import type { OnboardingSource } from './OnboardingPreview';
import { OnboardingLinearConnection } from './OnboardingLinearConnection';
import { OnboardingPlatformConnection } from './OnboardingPlatformConnection';

export interface ProjectManagementFactoryStepProps {
  onConnect: () => void;
  onContinue: () => void;
  onPreviewSource?: (source: OnboardingSource) => void;
}

/**
 * The optional tracker step in onboarding. Linear, Jira, and incident.io are
 * equivalent, side-by-side choices; providers connect headlessly in place
 * (no redirect), so the wizard state survives the whole flow.
 */
export function ProjectManagementFactoryStep({
  onConnect,
  onContinue,
  onPreviewSource,
}: ProjectManagementFactoryStepProps) {
  const linearStatus = useLinearStatusQuery();
  const jiraConnections = usePlatformConnectionsQuery('jira');
  const incidentConnections = usePlatformConnectionsQuery('incident-io');
  const linearConnected = linearStatus.data?.connected === true;
  const jiraConnected = jiraConnections.data?.some(connection => connection.status === 'active') ?? false;
  const incidentConnected = incidentConnections.data?.some(connection => connection.status === 'active') ?? false;
  const anyConnected = linearConnected || jiraConnected || incidentConnected;
  return (
    <section aria-label="Project management connections" className="w-full">
      <div className="space-y-1">
        <div onMouseEnter={() => onPreviewSource?.('linear')} onFocus={() => onPreviewSource?.('linear')}>
          <OnboardingLinearConnection onConnect={onConnect} />
        </div>
        <div onMouseEnter={() => onPreviewSource?.('jira')} onFocus={() => onPreviewSource?.('jira')}>
          <OnboardingPlatformConnection provider="jira" />
        </div>
        <div onMouseEnter={() => onPreviewSource?.('incident-io')} onFocus={() => onPreviewSource?.('incident-io')}>
          <OnboardingPlatformConnection provider="incident-io" />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-2">
        <Button variant={anyConnected ? 'primary' : 'ghost'} size="lg" onClick={onContinue}>
          {anyConnected ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </section>
  );
}
