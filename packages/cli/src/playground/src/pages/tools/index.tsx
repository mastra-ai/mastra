import { useAgents } from '@/hooks/use-agents';

import {
  EntityName,
  EntityDescription,
  Entity,
  EntityContent,
  Header,
  HeaderTitle,
  EntityIcon,
  ToolsIcon,
  Badge,
  AgentIcon,
  Icon,
  Txt,
  ToolCoinIcon,
  EmptyState,
  Button,
  MainContentLayout,
  MainContentContent,
  MainLayout,
  MainContent,
  MainHeader,
  MainHeaderTitle,
  MainList,
  StackOfElements,
} from '@mastra/playground-ui';
import { Link } from 'react-router';
import { startTransition, useMemo, useRef, useState } from 'react';
import { GetAgentResponse } from '@mastra/client-js';
import { SearchIcon } from 'lucide-react';
import { useTools } from '@/hooks/use-all-tools';
import { Tool } from '@mastra/core/tools';
import { useNewUI } from '@/hooks/use-new-ui';

interface ToolWithAgents {
  id: string;
  description: string;
  agents: Array<{ id: string; name: string }>;
}

const prepareAgents = (tools: Record<string, Tool>, agents: Record<string, GetAgentResponse>) => {
  const toolsWithAgents = new Map<string, ToolWithAgents>();
  const agentsKeys = Object.keys(agents);

  // Assemble tools from agents
  for (const k of agentsKeys) {
    const agent = agents[k];
    const agentToolsDict = agent.tools;
    const agentToolsKeys = Object.keys(agentToolsDict);

    for (const key of agentToolsKeys) {
      const tool = agentToolsDict[key];

      if (!toolsWithAgents.has(tool.id)) {
        toolsWithAgents.set(tool.id, {
          ...tool,
          agents: [],
        });
      }

      toolsWithAgents.get(tool.id)!.agents.push({ id: k, name: agent.name });
    }
  }

  // Assemble discovered tools
  for (const [_, tool] of Object.entries(tools)) {
    if (!toolsWithAgents.has(tool.id)) {
      toolsWithAgents.set(tool.id, {
        ...tool,
        agents: [],
      });
    }
  }

  return Array.from(toolsWithAgents.values());
};

const Tools = () => {
  const { agents: agentsRecord, isLoading: isLoadingAgents } = useAgents();
  const { tools, isLoading: isLoadingTools } = useTools();

  const memoizedToolsWithAgents = useMemo(() => prepareAgents(tools, agentsRecord), [agentsRecord, tools]);

  if (isLoadingAgents || isLoadingTools) return null;

  return <ToolsInner toolsWithAgents={memoizedToolsWithAgents} />;
};

const ToolsInner = ({ toolsWithAgents }: { toolsWithAgents: ToolWithAgents[] }) => {
  const [filteredTools, setFilteredTools] = useState<ToolWithAgents[]>(toolsWithAgents);
  const [value, setValue] = useState('');
  const newUIEnabled = useNewUI();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValue(value);

    startTransition(() => {
      setFilteredTools(
        toolsWithAgents.filter(
          tool =>
            tool.id.toLowerCase().includes(value.toLowerCase()) ||
            tool.description.toLowerCase().includes(value.toLowerCase()) ||
            tool.agents.some(
              agent =>
                agent.name.toLowerCase().includes(value.toLowerCase()) ||
                agent.id.toLowerCase().includes(value.toLowerCase()),
            ),
        ),
      );
    });
  };

  const agentListColumns = [{ key: 'agents', label: 'Agents', minWidth: '5rem' }];

  const toolListItems = filteredTools.map(tool => {
    const agents = (tool.agents || []).map(agent => {
      return (
        <Link to={'/'}>
          <AgentIcon />
          {agent.name}
        </Link>
      );
    });

    return {
      id: tool.id,
      icon: <ToolsIcon />,
      name: tool.id,
      to: tool.agents.length > 0 ? `/tools/${tool.agents[0].id}/${tool.id}` : `/tools`,
      description: tool.description,
      columns: [tool.agents.length],
      collapsible: (
        <StackOfElements title="Used with agents:" variant="mainListCollapsible">
          {agents}
        </StackOfElements>
      ),
    };
  });

  return newUIEnabled ? (
    <MainLayout>
      <MainHeader>
        <MainHeaderTitle>Tools</MainHeaderTitle>
      </MainHeader>
      <MainContent>
        <MainList
          items={toolListItems}
          linkComponent={Link}
          columns={agentListColumns}
          emptyStateFor="tools"
          withCollapsible={true}
        />
      </MainContent>
    </MainLayout>
  ) : (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Tools</HeaderTitle>
      </Header>
      {filteredTools.length === 0 && !value ? (
        <MainContentContent isCentered={true}>
          <EmptyState
            iconSlot={<ToolCoinIcon />}
            titleSlot="Configure Tools"
            descriptionSlot="Mastra tools are not configured yet. You can find more information in the documentation."
            actionSlot={
              <Button
                size="lg"
                className="w-full"
                variant="light"
                as="a"
                href="https://mastra.ai/en/docs/agents/using-tools-and-mcp"
                target="_blank"
              >
                <Icon>
                  <ToolsIcon />
                </Icon>
                Docs
              </Button>
            }
          />
        </MainContentContent>
      ) : (
        <MainContentContent className="max-w-5xl mx-auto px-4 pt-4">
          <div className="px-4 flex items-center gap-2 rounded-lg bg-surface5 focus-within:ring-2 focus-within:ring-accent3">
            <Icon>
              <SearchIcon />
            </Icon>

            <input
              type="text"
              placeholder="Search for a tool"
              className="w-full py-2 bg-transparent text-icon3 focus:text-icon6 placeholder:text-icon3 outline-none"
              value={value}
              onChange={handleSearch}
            />
          </div>

          {filteredTools.length === 0 && (
            <Txt as="p" className="text-icon3 py-2">
              No tools found matching your search.
            </Txt>
          )}

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl mx-auto  py-8">
            {filteredTools.map(tool => (
              <ToolEntity key={tool.id} tool={tool} />
            ))}
          </div>
        </MainContentContent>
      )}
    </MainContentLayout>
  );
};

interface ToolEntityProps {
  tool: ToolWithAgents;
}

const ToolEntity = ({ tool }: ToolEntityProps) => {
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <Entity onClick={() => linkRef.current?.click()}>
      <EntityIcon>
        <ToolsIcon className="group-hover/entity:text-[#ECB047]" />
      </EntityIcon>

      <EntityContent>
        <EntityName>
          <Link
            ref={linkRef}
            to={tool.agents.length > 0 ? `/tools/${tool.agents[0].id}/${tool.id}` : `/tools/all/${tool.id}`}
          >
            {tool.id}
          </Link>
        </EntityName>
        <EntityDescription>{tool.description}</EntityDescription>

        <div className="inline-flex flex-wrap gap-2 pt-4">
          {tool.agents.map(agent => {
            return (
              <Link
                to={`/agents/${agent.id}/chat`}
                onClick={e => e.stopPropagation()}
                key={agent.id}
                className="group/link"
              >
                <Badge icon={<AgentIcon className="group-hover/link:text-accent3" />} className="bg-surface5 ">
                  {agent.name}
                </Badge>
              </Link>
            );
          })}
        </div>
      </EntityContent>
    </Entity>
  );
};

export default Tools;
