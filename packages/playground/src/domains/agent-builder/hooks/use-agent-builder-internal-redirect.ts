import { useStoredAgents } from '@mastra/react/hooks/agents';

export function useAgentBuilderInternalRedirect() {
  const { data: draftAgentsData, isLoading: isLoadingDraftAgents } = useStoredAgents({ status: 'draft' });
  const { data: publishedAgentsData, isLoading: isLoadingPublishedAgents } = useStoredAgents({ status: 'published' });

  const draftAgents = draftAgentsData?.agents ?? [];
  const publishedAgents = publishedAgentsData?.agents ?? [];

  const hasAgents = draftAgents.length > 0 || publishedAgents.length > 0;
  const isLoading = isLoadingDraftAgents || isLoadingPublishedAgents;

  return { isLoading, hasAgents };
}
