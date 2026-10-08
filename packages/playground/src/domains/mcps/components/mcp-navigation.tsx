import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { useMCPServers } from '@mastra/react/hooks/mcps';
import { List, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { McpToolsNavigation } from './mcp-tools-navigation';
import { NavigationQueryState } from '@/components/ui/navigation-query-state';
import { ResourceNavigationLayout } from '@/components/ui/resource-navigation-layout';
import { SidebarSearchInput } from '@/components/ui/sidebar-search-input';

export function McpNavigation() {
  const { serverId, toolId } = useParams();
  const [search, setSearch] = useState('');
  const { data: servers = [], isLoading, error } = useMCPServers();
  const term = search.trim().toLowerCase();
  const filteredServers = servers.filter(server => server.name.toLowerCase().includes(term));
  const selectedServer = servers.find(server => server.id === serverId);
  return (
    <ResourceNavigationLayout
      title="MCP Servers"
      label="MCP navigation"
      search={
        <SidebarSearchInput
          label="Search servers and tools"
          placeholder="Search servers and tools…"
          value={search}
          onValueChange={setSearch}
        />
      }
    >
      <Sidebar.Nav aria-label="MCP collection">
        <Sidebar.NavList>
          <Sidebar.NavLink
            state="default"
            isActive={!serverId}
            link={{ name: 'All servers', url: '/mcps', icon: <List /> }}
          />
        </Sidebar.NavList>
        <Sidebar.NavSection>
          <Sidebar.NavHeader state="default">Servers</Sidebar.NavHeader>
          <NavigationQueryState isLoading={isLoading} hasError={Boolean(error)} isEmpty={filteredServers.length === 0}>
            <Sidebar.NavList>
              {filteredServers.map(server => (
                <Sidebar.NavLink
                  key={server.id}
                  state="default"
                  isActive={server.id === serverId && !toolId}
                  link={{ name: server.name, url: `/mcps/${encodeURIComponent(server.id)}`, icon: <Paperclip /> }}
                />
              ))}
            </Sidebar.NavList>
          </NavigationQueryState>
        </Sidebar.NavSection>
        {selectedServer && <McpToolsNavigation key={selectedServer.id} server={selectedServer} search={term} />}
      </Sidebar.Nav>
    </ResourceNavigationLayout>
  );
}
