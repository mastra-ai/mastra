import { useAgentVersions } from '@mastra/react/hooks/agents';
import { VersionHistoryPanel } from '@/domains/cms/components/version-history-panel';
import type { VersionHistoryPanelProps } from '@/domains/cms/components/version-history-panel';

export interface AgentVersionPanelProps extends Omit<VersionHistoryPanelProps, 'versions' | 'isLoading'> {
  agentId: string;
}

export function AgentVersionPanel({ agentId, ...panelProps }: AgentVersionPanelProps) {
  const { data, isLoading } = useAgentVersions({
    agentId,
    params: { orderBy: { direction: 'DESC' } },
    queryOptions: { enabled: Boolean(agentId) },
  });

  return <VersionHistoryPanel versions={data?.versions ?? []} isLoading={isLoading} {...panelProps} />;
}
