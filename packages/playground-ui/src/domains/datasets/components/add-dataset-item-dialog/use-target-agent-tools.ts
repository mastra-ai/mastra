import { useAgents } from '@mastra/react/hooks/agents';
import { useDataset } from '@mastra/react/hooks/datasets';

/** The tool names of the agents a dataset targets, sorted and deduped. Empty unless the dataset targets agents. */
export function useTargetAgentTools(datasetId: string, { enabled }: { enabled: boolean }) {
  const { data: dataset } = useDataset({ datasetId, queryOptions: { enabled: enabled && Boolean(datasetId) } });
  const targetsAgents = dataset?.targetType === 'agent';
  const { data: agents, isLoading } = useAgents({ queryOptions: { enabled: enabled && targetsAgents } });

  const toolNames = targetsAgents
    ? [...new Set((dataset.targetIds ?? []).flatMap(id => Object.keys(agents?.[id]?.tools ?? {})))].sort()
    : [];

  return { toolNames, isLoading: targetsAgents && isLoading };
}
