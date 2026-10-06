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

const BUTTON_LAYOUT = 'whitespace-nowrap max-sm:min-h-11 max-sm:w-full max-sm:justify-start';

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
        className="items-stretch text-left"
        iconSlot={<LinearIcon />}
        titleSlot="Linear connected"
        descriptionSlot={`Connected to ${linearStatus.data.workspace?.name ?? 'Linear'}.`}
      />
    );
  }
  return (
    <EmptyState
      className="items-stretch text-left"
      iconSlot={<LinearIcon />}
      titleSlot="Connect Linear"
      descriptionSlot="Give your Factory the issue context and priorities behind your code."
      actionSlot={
        linearStatus.data?.reason !== 'missing_config' &&
        linearStatus.data?.reason !== 'organization_required' && (
          <Button variant="primary" icon={<LinearIcon />} className={BUTTON_LAYOUT} onClick={onConnect}>
            {linearStatus.data?.reason === 'not_connected' ? 'Connect Linear' : 'Reconnect Linear'}
          </Button>
        )
      }
    />
  );
}

function JiraPane({ connections, onRetry }: { connections: PlatformProviderConnection[]; onRetry?: () => void }) {
  const hasActiveConnection = connections.some(connection => connection.status === 'active');
  // A failed refetch retains the last successful data; keep showing the
  // connected summary rather than replacing it with a retry state.
  if (onRetry && !hasActiveConnection) {
    return (
      <EmptyState
        className="items-stretch text-left"
        iconSlot={<JiraIcon />}
        titleSlot="Connect Jira"
        descriptionSlot="Couldn't load Jira connections."
        actionSlot={
          <Button variant="ghost" className={BUTTON_LAYOUT} onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }
  if (hasActiveConnection) {
    return (
      <EmptyState
        className="items-stretch text-left"
        iconSlot={<JiraIcon />}
        titleSlot="Jira connected"
        descriptionSlot={accountSummary(connections, 'Jira')}
      />
    );
  }
  return (
    <EmptyState
      className="items-stretch text-left"
      iconSlot={<JiraIcon />}
      titleSlot="Connect Jira"
      descriptionSlot="Give your Factory the issue context and priorities behind your code."
      actionSlot={
        <ProviderConnectControl
          provider="jira"
          label="Connect Jira"
          variant="primary"
          size="md"
          className={BUTTON_LAYOUT}
          icon={<JiraIcon size={16} />}
        />
      }
    />
  );
}

function IncidentIoPane({ connections, onRetry }: { connections: PlatformProviderConnection[]; onRetry?: () => void }) {
  const hasActiveConnection = connections.some(connection => connection.status === 'active');
  // A failed refetch retains the last successful data; keep showing the
  // connected summary rather than replacing it with a retry state.
  if (onRetry && !hasActiveConnection) {
    return (
      <EmptyState
        className="items-stretch text-left"
        iconSlot={<IncidentIoIcon />}
        titleSlot="Connect incident.io"
        descriptionSlot="Couldn't load incident.io connections."
        actionSlot={
          <Button variant="ghost" className={BUTTON_LAYOUT} onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }
  if (hasActiveConnection) {
    return (
      <EmptyState
        className="items-stretch text-left"
        iconSlot={<IncidentIoIcon />}
        titleSlot="incident.io connected"
        descriptionSlot={accountSummary(connections, 'incident.io')}
      />
    );
  }
  return (
    <EmptyState
      className="items-stretch text-left"
      iconSlot={<IncidentIoIcon />}
      titleSlot="Connect incident.io"
      descriptionSlot="Route incident follow-ups into your Factory. Incidents themselves stay out of intake."
      actionSlot={
        <ProviderConnectControl
          provider="incident-io"
          label="Connect incident.io"
          variant="primary"
          size="md"
          className={BUTTON_LAYOUT}
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
      className={`border-border bg-background/80 @container rounded-2xl border p-5 ${paneCount === 3 ? 'max-w-5xl' : paneCount === 2 ? 'max-w-3xl' : 'max-w-xl'}`}
    >
      {paneCount > 1 ? (
        // Size columns against the panel: the desktop artwork also narrows it.
        // Three panes need 39rem to fit their padding and the incident.io label.
        <div
          className={`divide-border grid grid-cols-1 divide-y ${paneCount === 3 ? '@min-[39rem]:grid-cols-3 @min-[39rem]:divide-x @min-[39rem]:divide-y-0' : '@lg:grid-cols-2 @lg:divide-x @lg:divide-y-0'}`}
        >
          <div className="min-w-0">
            <LinearPane onConnect={onConnect} />
          </div>
          {jiraOffered && (
            <div className="min-w-0">
              <JiraPane
                connections={jiraConnections.data ?? []}
                {...(jiraConnections.isError ? { onRetry: () => void jiraConnections.refetch() } : {})}
              />
            </div>
          )}
          {incidentOffered && (
            <div className="min-w-0">
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
      <div className="mt-4 flex items-center gap-2 px-4">
        {anyConnected ? (
          <Button variant="primary" className={BUTTON_LAYOUT} onClick={onContinue}>
            Continue
          </Button>
        ) : (
          <Button variant="ghost" className={BUTTON_LAYOUT} onClick={onContinue}>
            Skip for now
          </Button>
        )}
      </div>
    </section>
  );
}
