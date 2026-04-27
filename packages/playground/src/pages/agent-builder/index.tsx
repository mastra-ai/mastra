import { Spinner } from '@mastra/playground-ui';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';

export const AgentBuilderRoot = () => {
  const navigate = useNavigate();
  const { data: draftAgentsData, isLoading: isLoadingDraftAgents } = useStoredAgents({ status: 'draft' });
  const { data: publishedAgentsData, isLoading: isLoadingPublishedAgents } = useStoredAgents({ status: 'published' });

  const draftAgents = draftAgentsData?.agents ?? [];
  const publishedAgents = publishedAgentsData?.agents ?? [];

  const hasAgents = draftAgents.length > 0 || publishedAgents.length > 0;
  const isLoading = isLoadingDraftAgents || isLoadingPublishedAgents;

  useEffect(() => {
    if (isLoading) return;

    if (hasAgents) {
      void navigate('/agent-builder/agents');
    } else {
      void navigate('/agent-builder/agents/create');
    }
  }, [isLoading, hasAgents, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return null;
};
