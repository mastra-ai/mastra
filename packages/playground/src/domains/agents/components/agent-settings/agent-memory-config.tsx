import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { AgentMemorySettings } from '@mastra/playground-ui/domains/agents/config/agent-memory-settings';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useMemoryConfig } from '@mastra/react/hooks/memory';

export function AgentMemoryConfig({ agentId }: { agentId: string }) {
  const { data, isLoading, isError, isFetching, refetch } = useMemoryConfig({
    agentId,
    requestContext: useEntityRequestContext('agent', agentId)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });

  if (isLoading) return <Skeleton className="h-28 w-full" />;

  if (isError && !data) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <Txt variant="caption" tone="muted">
          Unable to load memory configuration
        </Txt>
        <Button size="sm" disabled={isFetching} onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data?.config)
    return (
      <Txt variant="caption" tone="muted">
        No memory configuration available
      </Txt>
    );

  return <AgentMemorySettings config={data.config} />;
}
