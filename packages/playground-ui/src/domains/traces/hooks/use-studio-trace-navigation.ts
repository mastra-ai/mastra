import { useMemo } from 'react';
import type { TraceNavigation } from '../components/trace-navigation';
import { useKnowledgeLinksContext } from '@/domains/chat/knowledge/knowledge-links-context';
import { useLinkComponent } from '@/lib/framework';

/**
 * A callback that navigates to a Studio route, or none when the app has no such route (its builder
 * returns `''`), so the parts show text instead of a button that goes nowhere.
 */
function route(navigate: (path: string) => void, toPath: (id: string) => string) {
  if (!toPath('_')) return undefined;
  return (id: string) => {
    const href = toPath(id);
    if (href) navigate(href);
  };
}

/**
 * Studio's navigation for the detail panels: each callback goes to the Studio page through its router
 * (`LinkComponentProvider`). Pass the result as `navigation` to `TracePanel`, `ThreadTrace` or `SpanDataPanel`.
 */
export function useStudioTraceNavigation(): TraceNavigation {
  const { navigate, paths } = useLinkComponent();
  const knowledge = useKnowledgeLinksContext();
  return useMemo(
    () => ({
      onOpenTrace: route(navigate, traceId => paths.traceLink(traceId)),
      onOpenAgent: route(navigate, agentId => paths.agentLink(agentId)),
      onOpenWorkflow: route(navigate, workflowId => paths.workflowLink(workflowId)),
      onOpenTool: route(navigate, toolId => paths.toolLink(toolId)),
      onOpenWorkspace: ({ workspaceId, path }) => {
        const query = path ? `?path=${encodeURIComponent(path)}` : '';
        navigate(workspaceId ? `/workspaces/${workspaceId}${query}` : '/workspaces');
      },
      onOpenKnowledgePage: target => {
        const href =
          target.pageId !== undefined ? knowledge.pageHref(target.pageId) : knowledge.refHref?.(target.pageRef);
        if (href) navigate(href);
      },
    }),
    [navigate, paths, knowledge],
  );
}
