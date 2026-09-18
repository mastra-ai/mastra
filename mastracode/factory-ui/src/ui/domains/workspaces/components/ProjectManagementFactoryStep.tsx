import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';

import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { isPlatformConnectUnavailableError } from '../../factory/services/platformConnect';
import type { PlatformProviderConnection } from '../../factory/services/platformConnect';
import { ProviderConnectControl } from '../../settings/components/PlatformProviderConnections';
import { IncidentIoIcon, JiraIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';

export interface ProjectManagementFactoryStepProps {
  onConnect: () => void;
  onContinue: () => void;
}

function accountSummary(connections: PlatformProviderConnection[], fallback: string): string {
  const active = connections.filter(connection => connection.status === 'active');
  if (active.length === 1) return `Connected to ${active[0]?.accountLabel ?? fallback}.`;
  return `${active.length} accounts connected.`;
}

function LinearPane({ onConnect }: { onConnect: () => void }) {
  const linearStatus = useLinearStatusQuery();
  if (linearStatus.isPending) {
    return <SkeletonRows label="Loading Linear status" rows={2} rowClassName="h-12 w-full rounded-xl" />;
  }
  if (linearStatus.data?.connected) {
    return (
      <EmptyState
        className="py-8"
        iconSlot={<LinearIcon className="text-icon3 size-10" />}
        titleSlot="Linear connected"
        descriptionSlot={`Connected to ${linearStatus.data.workspace?.name ?? 'Linear'}.`}
      />
    );
  }
  return (
    <EmptyState
      className="py-8"
      iconSlot={<LinearIcon className="text-icon3 size-10" />}
      titleSlot="Connect Linear"
      descriptionSlot="Give your Factory the issue context and priorities behind your code."
      actionSlot={
        linearStatus.data?.reason !== 'missing_config' &&
        linearStatus.data?.reason !== 'organization_required' && (
          <Button variant="primary" onClick={onConnect}>
            <LinearIcon className="size-4" />
            {linearStatus.data?.reason === 'not_connected' ? 'Connect Linear' : 'Reconnect Linear'}
          </Button>
        )
      }
    />
  );
}

function JiraPane({ connections, onRetry }: { connections: PlatformProviderConnection[]; onRetry?: () => void }) {
  if (onRetry) {
    return (
      <EmptyState
        className="py-8"
        iconSlot={<JiraIcon className="text-icon3" size={40} />}
        titleSlot="Connect Jira"
        descriptionSlot="Couldn't load Jira connections."
        actionSlot={
          <Button variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }
  const hasActive = connections.some(connection => connection.status === 'active');
  if (hasActive) {
    return (
      <EmptyState
        className="py-8"
        iconSlot={<JiraIcon className="text-icon3" size={40} />}
        titleSlot="Jira connected"
        descriptionSlot={accountSummary(connections, 'Jira')}
      />
    );
  }
  return (
    <EmptyState
      className="py-8"
      iconSlot={<JiraIcon className="text-icon3" size={40} />}
      titleSlot="Connect Jira"
      descriptionSlot="Give your Factory the issue context and priorities behind your code."
      actionSlot={
        <ProviderConnectControl
          provider="jira"
          label="Connect Jira"
          variant="primary"
          size="md"
          icon={<JiraIcon size={16} />}
        />
      }
    />
  );
}

function IncidentIoPane({ connections, onRetry }: { connections: PlatformProviderConnection[]; onRetry?: () => void }) {
  if (onRetry) {
    return (
      <EmptyState
        className="py-8"
        iconSlot={<IncidentIoIcon className="text-icon3" size={40} />}
        titleSlot="Connect incident.io"
        descriptionSlot="Couldn't load incident.io connections."
        actionSlot={
          <Button variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }
  const hasActive = connections.some(connection => connection.status === 'active');
  if (hasActive) {
    return (
      <EmptyState
        className="py-8"
        iconSlot={<IncidentIoIcon className="text-icon3" size={40} />}
        titleSlot="incident.io connected"
        descriptionSlot={accountSummary(connections, 'incident.io')}
      />
    );
  }
  return (
    <EmptyState
      className="py-8"
      iconSlot={<IncidentIoIcon className="text-icon3" size={40} />}
      titleSlot="Connect incident.io"
      descriptionSlot="Route incident follow-ups into your Factory. Incidents themselves stay out of intake."
      actionSlot={
        <ProviderConnectControl
          provider="incident-io"
          label="Connect incident.io"
          variant="primary"
          size="md"
          icon={<IncidentIoIcon size={16} />}
        />
      }
    />
  );
}

/**
 * The optional tracker step in onboarding. Linear, Jira, and incident.io are
 * equivalent, side-by-side choices; providers connect headlessly in place
 * (no redirect), so the wizard state survives the whole flow.
 */
export function ProjectManagementFactoryStep({ onConnect, onContinue }: ProjectManagementFactoryStepProps) {
  const linearStatus = useLinearStatusQuery();
  const jiraConnections = usePlatformConnectionsQuery('jira');
  const incidentConnections = usePlatformConnectionsQuery('incident-io');
  // A provider pane is hidden only when the server says the feature isn't
  // offered here (403/404 — auth off, no Platform credentials). A transient
  // failure keeps the pane visible with a retry, so a flaky request doesn't
  // silently demote onboarding to the Linear-only step.
  const jiraOffered =
    jiraConnections.isSuccess || (jiraConnections.isError && !isPlatformConnectUnavailableError(jiraConnections.error));
  const incidentOffered =
    incidentConnections.isSuccess ||
    (incidentConnections.isError && !isPlatformConnectUnavailableError(incidentConnections.error));
  const linearConnected = linearStatus.data?.connected === true;
  const jiraConnected = jiraConnections.data?.some(connection => connection.status === 'active') ?? false;
  const incidentConnected = incidentConnections.data?.some(connection => connection.status === 'active') ?? false;
  const anyConnected = linearConnected || jiraConnected || incidentConnected;
  const paneCount = 1 + (jiraOffered ? 1 : 0) + (incidentOffered ? 1 : 0);

  return (
    <section
      aria-label="Project management connections"
      className={`border-border1 bg-surface2/80 rounded-2xl border p-5 ${paneCount === 3 ? 'max-w-5xl' : paneCount === 2 ? 'max-w-3xl' : 'max-w-xl'}`}
    >
      {paneCount > 1 ? (
        <div className={`divide-border1 grid divide-x ${paneCount === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div className="pr-6">
            <LinearPane onConnect={onConnect} />
          </div>
          {jiraOffered && (
            <div className={incidentOffered ? 'px-6' : 'pl-6'}>
              <JiraPane
                connections={jiraConnections.data ?? []}
                {...(jiraConnections.isError ? { onRetry: () => void jiraConnections.refetch() } : {})}
              />
            </div>
          )}
          {incidentOffered && (
            <div className="pl-6">
              <IncidentIoPane
                connections={incidentConnections.data ?? []}
                {...(incidentConnections.isError ? { onRetry: () => void incidentConnections.refetch() } : {})}
              />
            </div>
          )}
        </div>
      ) : (
        <LinearPane onConnect={onConnect} />
      )}
      <div className="mt-4 flex items-center justify-center gap-2">
        {anyConnected ? (
          <Button variant="primary" onClick={onContinue}>
            Continue
          </Button>
        ) : (
          <Button variant="ghost" onClick={onContinue}>
            Skip for now
          </Button>
        )}
      </div>
    </section>
  );
}
