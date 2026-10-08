import { coreFeatures } from '@mastra/core/features';
import { EntityType } from '@mastra/core/observability';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useAgent } from '@mastra/react/hooks/agents';
import { useAgentRunsKpiMetrics, useMetricsQueryFilters, useTotalTokensKpiMetrics } from '@mastra/react/hooks/metrics';
import { ArrowUpRight } from 'lucide-react';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

export function AgentSidebarActivity({ agentId }: { agentId: string }) {
  const { hasPermission, isLoading } = usePermissions();
  const { hasObservability } = useHasObservability();
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { data: agent } = useAgent({ agentId, requestContext });
  if (!agent || isLoading || !hasPermission('observability:read') || !coreFeatures.has('datasets')) return null;
  return (
    <section aria-label="Agent activity" className="mt-auto shrink-0 border-t border-border p-4">
      {hasObservability ? (
        <ActivityStorageGate agentId={agentId} agentName={agent.name} />
      ) : (
        <Txt variant="caption" tone="muted">
          Enable observability to see this agent’s activity.
        </Txt>
      )}
    </section>
  );
}

function ActivityStorageGate({ agentId, agentName }: { agentId: string; agentName: string }) {
  const { supportsMetrics, isLoading, error } = useObservabilityStorageCapabilities();
  if (isLoading) return <Skeleton className="h-16" />;
  if (error)
    return (
      <Txt variant="caption" tone="muted">
        Activity is temporarily unavailable.
      </Txt>
    );
  if (!supportsMetrics)
    return (
      <Txt variant="caption" tone="muted">
        Activity metrics are not available with this storage.
      </Txt>
    );
  return <ActivityMetrics agentId={agentId} agentName={agentName} />;
}

function ActivityMetrics({ agentId, agentName }: { agentId: string; agentName: string }) {
  const { Link } = useLinkComponent();
  const dimensionalFilter = { rootEntityType: EntityType.AGENT, entityName: agentName };
  const filters = useMetricsQueryFilters({
    datePreset: '24h',
    customRange: undefined,
    dimensionalFilter,
    dimensionalFilterKey: JSON.stringify(dimensionalFilter),
  });
  const runs = useAgentRunsKpiMetrics(filters);
  const tokens = useTotalTokensKpiMetrics(filters);
  const formatValue = (value: number | null | undefined) => (value == null ? '—' : value.toLocaleString());
  return (
    <div className="grid gap-3">
      <Link
        href={`/agents/${encodeURIComponent(agentId)}/metrics`}
        className="text-ui-sm flex items-center justify-between gap-2 hover:underline"
      >
        <Txt as="span" variant="label">
          Activity{' '}
          <Txt as="span" variant="caption" tone="muted">
            · Last 24h
          </Txt>
        </Txt>
        <ArrowUpRight className="size-4 shrink-0" />
      </Link>
      {runs.isLoading || tokens.isLoading ? (
        <Skeleton className="h-12" />
      ) : (
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt>
              <Txt variant="caption" tone="muted">
                Runs
              </Txt>
            </dt>
            <dd>
              <Txt variant="subheading" className="break-words tabular-nums">
                {runs.isError ? '—' : formatValue(runs.data?.value)}
              </Txt>
            </dd>
          </div>
          <div>
            <dt>
              <Txt variant="caption" tone="muted">
                Tokens
              </Txt>
            </dt>
            <dd>
              <Txt variant="subheading" className="break-words tabular-nums">
                {tokens.isError ? '—' : formatValue(tokens.data?.value)}
              </Txt>
            </dd>
          </div>
        </dl>
      )}
      {(runs.isError || tokens.isError) && (
        <Txt variant="caption" tone="muted">
          Some activity metrics could not be loaded.
        </Txt>
      )}
    </div>
  );
}
