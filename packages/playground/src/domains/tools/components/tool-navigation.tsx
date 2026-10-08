import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useAgents } from '@mastra/react/hooks/agents';
import { useTools } from '@mastra/react/hooks/tools';
import { useState } from 'react';
import { useParams } from 'react-router';
import { prepareToolsTable } from '../utils/prepareToolsTable';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';
import { NavigationQueryState } from '@/components/ui/navigation-query-state';
import { SidebarSearchInput } from '@/components/ui/sidebar-search-input';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

/** Browse the same deduplicated catalog as the collection without leaving the selected tool. */
export function ToolNavigation() {
  const { toolId } = useParams();
  const { paths, Link } = useLinkComponent();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canReadAgents = !permissionsLoading && hasPermission('agents:read');
  const {
    data: agents = {},
    isLoading: agentsLoading,
    error: agentsError,
  } = useAgents({ queryOptions: { enabled: canReadAgents } });
  const { data: tools = {}, isLoading, error } = useTools();
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const catalog = prepareToolsTable(tools, canReadAgents ? agents : {});
  const items = catalog.filter(tool => `${tool.id} ${tool.description ?? ''}`.toLowerCase().includes(search));
  return (
    <>
      <SidebarSearchInput label="Search tools" placeholder="Search tools…" value={query} onValueChange={setQuery} />
      <NavigationQueryState
        isLoading={isLoading || permissionsLoading || (canReadAgents && agentsLoading)}
        hasError={Boolean(error || (canReadAgents && agentsError))}
        isEmpty={items.length === 0}
      >
        <ContextualSidebarSection>
          <ul aria-label="Tools" className="space-y-1">
            {items.map(tool => (
              <Sidebar.NavLink
                key={tool.id}
                state="default"
                LinkComponent={Link}
                isActive={tool.id === toolId}
                link={{ name: tool.id, url: paths.toolLink(tool.id), icon: <ToolsIcon /> }}
              />
            ))}
          </ul>
        </ContextualSidebarSection>
      </NavigationQueryState>
    </>
  );
}
