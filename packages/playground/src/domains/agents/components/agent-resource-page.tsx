import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Navigate, useLocation, useParams } from 'react-router';
import { agentConfigurationSections } from './agent-configuration-sections';

/** Keep bookmarks and tool drawers working after consolidating resource pages. */
export function AgentResourcePage() {
  const { agentId = '', resource } = useParams();
  const { search } = useLocation();
  if (!agentConfigurationSections.some(section => section.id === resource))
    return <EmptyState titleSlot="Resource not found" />;
  return <Navigate replace to={`/agents/${encodeURIComponent(agentId)}/overview${search}#${resource}`} />;
}
