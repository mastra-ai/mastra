import { Searchbar } from '@/components/ui/searchbar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Entity, EntityContent, EntityDescription, EntityIcon, EntityName } from '@/ds/components/Entity';
import { Txt } from '@/ds/components/Txt';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { Icon } from '@/ds/icons/Icon';
import { ToolCoinIcon } from '@/ds/icons/ToolCoinIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { useLinkComponent } from '@/lib/framework';
import { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { SearchIcon } from 'lucide-react';
import { startTransition, useMemo, useRef, useState } from 'react';

export interface ToolListProps {
  isLoading: boolean;
  tools: Record<string, GetToolResponse>;
  agents: Record<string, GetAgentResponse>;
  computeLink: (toolId: string, agentId?: string) => string;
  computeAgentLink: (toolId: string, agentId: string) => string;
}

interface ToolWithAgents {
  id: string;
  description: string;
  agents: Array<{ id: string; name: string }>;
}

export const ToolList = ({ tools, agents, isLoading, computeLink, computeAgentLink }: ToolListProps) => {
  const toolsWithAgents = useMemo(() => prepareAgents(tools, agents), [tools, agents]);

  if (isLoading)
    return (
      <div className="max-w-5xl w-full mx-auto px-4 pt-8">
        <ToolListSkeleton />
      </div>
    );

  return (
    <ToolListInner toolsWithAgents={toolsWithAgents} computeLink={computeLink} computeAgentLink={computeAgentLink} />
  );
};

const ToolListInner = ({
  toolsWithAgents,
  computeLink,
  computeAgentLink,
}: {
  toolsWithAgents: ToolWithAgents[];
  computeLink: (toolId: string, agentId?: string) => string;
  computeAgentLink: (toolId: string, agentId: string) => string;
}) => {
  const [filteredTools, setFilteredTools] = useState<ToolWithAgents[]>(toolsWithAgents);
  const [value, setValue] = useState('');

  if (filteredTools.length === 0 && !value) return <ToolListEmpty />;

  const handleSearch = (value: string) => {
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
    <div>
      <div className="max-w-5xl w-full mx-auto px-4 pt-8">
        <Searchbar onSearch={handleSearch} label="Search for a tool" placeholder="Search for a tool" />

        {filteredTools.length === 0 && (
          <Txt as="p" className="text-icon3 py-2">
            No tools found matching your search.
          </Txt>
        )}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl mx-auto py-8">
        {filteredTools.map(tool => (
          <ToolEntity key={tool.id} tool={tool} computeLink={computeLink} computeAgentLink={computeAgentLink} />
        ))}
      </div>
    </div>
  );
};

interface ToolEntityProps {
  tool: ToolWithAgents;
  computeLink: (toolId: string, agentId?: string) => string;
  computeAgentLink: (toolId: string, agentId: string) => string;
}

const ToolEntity = ({ tool, computeLink, computeAgentLink }: ToolEntityProps) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const { Link } = useLinkComponent();

  return (
    <Entity onClick={() => linkRef.current?.click()}>
      <EntityIcon>
        <ToolsIcon className="group-hover/entity:text-[#ECB047]" />
      </EntityIcon>

      <EntityContent>
        <EntityName>
          <Link ref={linkRef} href={computeLink(tool.id, tool.agents[0]?.id)}>
            {tool.id}
          </Link>
        </EntityName>
        <EntityDescription>{tool.description}</EntityDescription>

        <div className="inline-flex flex-wrap gap-2 pt-4">
          {tool.agents.map(agent => {
            return (
              <Link
                href={computeAgentLink(tool.id, agent.id)}
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

export const ToolListSkeleton = () => {
  return (
    <div>
      <div className="max-w-5xl w-full mx-auto px-4 pt-8">
        <Skeleton className="h-10 w-full" />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl mx-auto py-8">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
};

export const ToolListEmpty = () => {
  return (
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
  );
};

const prepareAgents = (
  tools: Record<string, GetToolResponse>,
  agents: Record<string, GetAgentResponse>,
): ToolWithAgents[] => {
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
