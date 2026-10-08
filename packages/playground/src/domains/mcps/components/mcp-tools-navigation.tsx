import type { McpServerInfo } from '@mastra/client-js';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { useMCPServerTools } from '@mastra/react/hooks/mcps';
import { Hexagon } from 'lucide-react';
import { NavigationQueryState } from '@/components/ui/navigation-query-state';
import { useToolDrawerParam } from '@/domains/tools/hooks/use-tool-drawer-param';

export function McpToolsNavigation({ server, search }: { server: McpServerInfo; search: string }) {
  const { toolId } = useToolDrawerParam();
  const { data, isLoading, error } = useMCPServerTools({ selectedServer: server });
  const tools = Object.values(data ?? {}).filter(tool => tool.name.toLowerCase().includes(search));
  return (
    <Sidebar.NavSection>
      <Sidebar.NavHeader state="default">{server.name} tools</Sidebar.NavHeader>
      <NavigationQueryState isLoading={isLoading} hasError={Boolean(error)} isEmpty={tools.length === 0}>
        <Sidebar.NavList>
          {tools.map(tool => (
            <Sidebar.NavLink
              key={tool.name}
              state="default"
              isActive={tool.name === toolId}
              link={{
                name: tool.name,
                url: `/mcps/${encodeURIComponent(server.id)}?${new URLSearchParams({ tool: tool.name })}`,
                icon: <Hexagon />,
              }}
            />
          ))}
        </Sidebar.NavList>
      </NavigationQueryState>
    </Sidebar.NavSection>
  );
}
