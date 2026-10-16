import { useAgent } from '@mastra/react/hooks/agents';
import { useQueryClient } from '@tanstack/react-query';

export function AgentName({ agentId }: { agentId: string }) {
  const { data } = useAgent({ agentId });
  const queryClient = useQueryClient();
  return <p data-shared-client={String(Boolean(queryClient))}>{data?.name}</p>;
}
