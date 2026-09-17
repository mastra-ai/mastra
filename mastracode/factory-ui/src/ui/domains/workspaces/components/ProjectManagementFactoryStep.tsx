import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';

import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { PLATFORM_CONNECT_PROVIDERS } from '../../factory/services/platformConnect';
import type { PlatformConnectProviderId, PlatformProviderConnection } from '../../factory/services/platformConnect';
import { ProviderConnectControl } from '../../settings/components/PlatformProviderConnections';
import { SkeletonRows } from '../../../ui/SkeletonRows';

export interface ProjectManagementFactoryStepProps {
  onConnect: () => void;
  onContinue: () => void;
}

function providerSummary(meta: { displayName: string }, connections: PlatformProviderConnection[]): string {
  const active = connections.filter(connection => connection.status === 'active');
  if (active.length === 1) return active[0]?.accountLabel ?? `${meta.displayName} connected`;
  return `${active.length} accounts connected`;
}

/**
 * One optional tracker row in onboarding. Providers connect headlessly in
 * place (no redirect), so the wizard state survives the whole flow.
 */
function PlatformProviderOption({
  provider,
  connections,
}: {
  provider: PlatformConnectProviderId;
  connections: PlatformProviderConnection[];
}) {
  const meta = PLATFORM_CONNECT_PROVIDERS[provider];
  const hasActive = connections.some(connection => connection.status === 'active');
  return (
    <li className="flex items-center justify-between gap-2 py-1">
      <Txt as="span" variant="ui-sm" className="text-icon5">
        {meta.displayName}
      </Txt>
      {hasActive ? (
        <span className="flex items-center gap-2">
          <Txt as="span" variant="ui-sm" className="text-icon3">
            {providerSummary(meta, connections)}
          </Txt>
          <ProviderConnectControl provider={provider} label="Connect another" size="xs" variant="ghost" />
        </span>
      ) : (
        <ProviderConnectControl provider={provider} label="Connect" size="xs" variant="ghost" />
      )}
    </li>
  );
}

export function ProjectManagementFactoryStep({ onConnect, onContinue }: ProjectManagementFactoryStepProps) {
  const linearStatus = useLinearStatusQuery();
  const jiraConnections = usePlatformConnectionsQuery('jira');
  const incidentConnections = usePlatformConnectionsQuery('incident-io');
  // Only providers whose connect routes are mounted (queries succeed) are
  // offered; a server without Platform credentials shows the Linear-only step.
  const platformProviders: Array<{ provider: PlatformConnectProviderId; connections: PlatformProviderConnection[] }> = [
    { provider: 'jira' as const, query: jiraConnections },
    { provider: 'incident-io' as const, query: incidentConnections },
  ].flatMap(({ provider, query }) => (query.isSuccess ? [{ provider, connections: query.data }] : []));

  return (
    <section aria-label="Linear connection" className="border-border1 bg-surface2/80 max-w-xl rounded-2xl border p-5">
      {linearStatus.isPending ? (
        <SkeletonRows label="Loading Linear status" rows={2} rowClassName="h-12 w-full rounded-xl" />
      ) : linearStatus.data?.connected ? (
        <div className="flex flex-col gap-4">
          <Txt as="p" variant="ui-md" className="text-icon5 m-0">
            Connected to {linearStatus.data.workspace?.name ?? 'Linear'}.
          </Txt>
          <Button variant="primary" onClick={onContinue}>
            Continue
          </Button>
        </div>
      ) : (
        <EmptyState
          className="py-8"
          iconSlot={<LinearIcon className="text-icon3 size-10" />}
          titleSlot="Connect Linear"
          descriptionSlot="Give your Factory the issue context and priorities behind your code."
          actionSlot={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {linearStatus.data?.reason !== 'missing_config' &&
                linearStatus.data?.reason !== 'organization_required' && (
                  <Button variant="primary" onClick={onConnect}>
                    <LinearIcon className="size-4" />
                    {linearStatus.data?.reason === 'not_connected' ? 'Connect Linear' : 'Reconnect Linear'}
                  </Button>
                )}
              <Button variant="ghost" onClick={onContinue}>
                Skip for now
              </Button>
            </div>
          }
        />
      )}
      {platformProviders.length > 0 && (
        <div className="border-border1 mt-4 border-t pt-4">
          <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
            Also sync issues from
          </Txt>
          <ul className="mt-2 flex flex-col">
            {platformProviders.map(({ provider, connections }) => (
              <PlatformProviderOption key={provider} provider={provider} connections={connections} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
