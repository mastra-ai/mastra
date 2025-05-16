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
} from '@mastra/playground-ui';
import { Link } from 'react-router';
import { startTransition, useMemo, useRef, useState } from 'react';
import { GetAgentResponse } from '@mastra/client-js';
import { SearchIcon } from 'lucide-react';

interface ToolWithAgents {
  id: string;
  description: string;
  agents: Array<{ id: string; name: string }>;
}

const prepareAgents = (agents: Record<string, GetAgentResponse>) => {
  const tools = new Map<string, ToolWithAgents>();
  const agentsKeys = Object.keys(agents);

  for (const k of agentsKeys) {
    const agent = agents[k];
    const agentToolsDict = agent.tools;
    const agentToolsKeys = Object.keys(agentToolsDict);

    for (const key of agentToolsKeys) {
      const tool = agentToolsDict[key];

      if (!tools.has(tool.id)) {
        tools.set(tool.id, {
          ...tool,
          agents: [],
        });
      }

      tools.get(tool.id)!.agents.push({ id: k, name: agent.name });
    }
  }

  return Array.from(tools.values());
};

const Tools = () => {
  const { agents: agentsRecord, isLoading: isLoadingAgents } = useAgents();

  const memoizedToolsWithAgents = useMemo(() => prepareAgents(agentsRecord), [agentsRecord]);

  if (isLoadingAgents) return null;

  return <ToolsInner toolsWithAgents={memoizedToolsWithAgents} />;
};

const ToolsInner = ({ toolsWithAgents }: { toolsWithAgents: ToolWithAgents[] }) => {
  const [filteredTools, setFilteredTools] = useState<ToolWithAgents[]>(toolsWithAgents);
  const [value, setValue] = useState('');

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

  return (
    <>
      <Header>
        <HeaderTitle>Tools</HeaderTitle>
      </Header>

      <div className="pt-12 overflow-y-scroll h-[calc(100%-32px)]">
        <div className="max-w-2xl mx-auto px-4">
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
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl mx-auto px-4 py-8">
          {filteredTools.map(tool => (
            <ToolEntity key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </>
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
          <Link ref={linkRef} to={`/tools/all/${tool.id}`}>
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
