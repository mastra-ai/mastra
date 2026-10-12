import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useMatch } from 'react-router';

const viewsKeptAcrossAgents = new Set(['overview', 'editor', 'metrics', 'traces']);

/** Switching agents keeps the open view, so comparing two agents’ traces or overviews takes one click. */
export function useAgentLinkInCurrentView() {
  const { paths } = useLinkComponent();
  const view = useMatch('/agents/:agentId/:view/*')?.params.view;
  return (agentId: string) =>
    view && viewsKeptAcrossAgents.has(view)
      ? `/agents/${encodeURIComponent(agentId)}/${view}`
      : paths.agentLink(agentId);
}
