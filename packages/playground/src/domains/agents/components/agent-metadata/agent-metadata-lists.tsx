import type { GetToolResponse, GetWorkflowResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { LoadingBadge } from '@mastra/playground-ui/domains/chat/components/loading-badge';
import { WORKSPACE_TOOLS_PREFIX } from '@mastra/playground-ui/domains/chat/tools/workspace-tool-constants';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { ProcessorIcon } from '@mastra/playground-ui/icons/ProcessorIcon';
import { SkillIcon } from '@mastra/playground-ui/icons/SkillIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { GaugeIcon, Folder, Globe } from 'lucide-react';
import { useActivatedSkills } from '../../context/activated-skills-context';
import { AgentMetadataExpandableList } from './agent-metadata-expandable-list';
import { AgentMetadataList, AgentMetadataListEmpty, AgentMetadataListItem } from './agent-metadata-list';
import { useScorers } from '@/domains/scores';
import { useLinkComponent } from '@/lib/framework';

export interface AgentMetadataNetworkListProps {
  agents: { id: string; name: string }[];
}

export const AgentMetadataNetworkList = ({ agents }: AgentMetadataNetworkListProps) => {
  const { Link, paths } = useLinkComponent();

  if (agents.length === 0) {
    return <AgentMetadataListEmpty>No agents</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataExpandableList
      items={agents}
      getKey={agent => agent.id}
      renderItem={agent => (
        <Badge
          render={<Link href={paths.agentLink(agent.id)} data-testid="agent-badge" />}
          variant="green"
          icon={<AgentIcon />}
        >
          {agent.name}
        </Badge>
      )}
    />
  );
};

export interface AgentMetadataToolListProps {
  tools: GetToolResponse[];
  agentId: string;
}

export const AgentMetadataToolList = ({ tools, agentId }: AgentMetadataToolListProps) => {
  const { Link, paths } = useLinkComponent();

  if (tools.length === 0) {
    return <AgentMetadataListEmpty>No tools</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataExpandableList
      items={tools}
      getKey={tool => tool.id}
      renderItem={tool => (
        <Badge
          render={<Link href={paths.agentToolLink(agentId, tool.id)} data-testid="tool-badge" />}
          icon={<ToolsIcon className="text-accent6" />}
        >
          {tool.id}
        </Badge>
      )}
    />
  );
};

export interface AgentMetadataWorkflowListProps {
  workflows: Array<{ id: string } & GetWorkflowResponse>;
}

export const AgentMetadataWorkflowList = ({ workflows }: AgentMetadataWorkflowListProps) => {
  const { Link, paths } = useLinkComponent();

  if (workflows.length === 0) {
    return <AgentMetadataListEmpty>No workflows</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataExpandableList
      items={workflows}
      getKey={workflow => workflow.id}
      renderItem={workflow => (
        <Badge
          render={<Link href={paths.workflowLink(workflow.id)} data-testid="workflow-badge" />}
          icon={<WorkflowIcon className="text-accent3" />}
        >
          {workflow.name}
        </Badge>
      )}
    />
  );
};

interface AgentMetadataScorerListProps {
  entityId: string;
  entityType: string;
}

export const AgentMetadataScorerList = ({ entityId, entityType }: AgentMetadataScorerListProps) => {
  const { Link, paths } = useLinkComponent();
  const { data: scorers = {}, isLoading } = useScorers();

  const scorerList = Object.keys(scorers)
    .filter(scorerKey => {
      const scorer = scorers[scorerKey];
      if (entityType === 'AGENT') {
        return scorer.agentNames?.includes?.(entityId);
      }

      return scorer.workflowIds.includes(entityId);
    })
    .map(scorerKey => ({ ...scorers[scorerKey], id: scorerKey }));

  if (isLoading) {
    return <LoadingBadge />;
  }

  if (scorerList.length === 0) {
    return <AgentMetadataListEmpty>No Scorers</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataExpandableList
      items={scorerList}
      getKey={scorer => scorer.id}
      renderItem={scorer => (
        <Badge
          render={<Link href={paths.scorerLink(scorer.id)} data-testid="scorer-badge" />}
          icon={<GaugeIcon className="text-neutral3" />}
        >
          {scorer.scorer.config.name}
        </Badge>
      )}
    />
  );
};

export interface AgentMetadataSkillListProps {
  skills: Array<{
    name: string;
    description: string;
    license?: string;
    path: string;
  }>;
  agentId: string;
  workspaceId?: string;
}

export const AgentMetadataSkillList = ({ skills, agentId, workspaceId }: AgentMetadataSkillListProps) => {
  const { Link, paths } = useLinkComponent();
  const { isSkillActivated } = useActivatedSkills();

  if (skills.length === 0) {
    return <AgentMetadataListEmpty>No skills</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataExpandableList
      items={skills}
      getKey={skill => skill.path}
      renderItem={skill => {
        const isActivated = isSkillActivated(skill.name);
        const badge = (
          <Badge
            render={
              <Link
                href={paths.agentSkillLink(agentId, skill.name, skill.path, workspaceId)}
                data-testid="skill-badge"
              />
            }
            icon={<SkillIcon className={`h-3 w-3 ${isActivated ? 'text-green-400' : 'text-accent2'}`} />}
            variant={isActivated ? 'green' : 'neutral'}
          >
            {skill.name}
            {isActivated && <span className="sr-only">Active</span>}
          </Badge>
        );

        return isActivated ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={badge} />
              <TooltipContent className="bg-surface3 text-neutral6 border-border1 border">Active</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          badge
        );
      }}
    />
  );
};

export interface AgentMetadataWorkspaceToolsListProps {
  tools: string[];
}

function formatWorkspaceToolName(toolName: string): string {
  const prefix = `${WORKSPACE_TOOLS_PREFIX}_`;
  if (toolName.startsWith(prefix)) {
    return toolName.slice(prefix.length);
  }
  return toolName;
}

export const AgentMetadataWorkspaceToolsList = ({ tools }: AgentMetadataWorkspaceToolsListProps) => {
  if (tools.length === 0) {
    return <AgentMetadataListEmpty>No workspace tools</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataExpandableList
      items={tools}
      getKey={tool => tool}
      renderItem={tool => <Badge icon={<Folder className="text-accent1" />}>{formatWorkspaceToolName(tool)}</Badge>}
    />
  );
};

export interface AgentMetadataBrowserToolsListProps {
  tools: string[];
}

export const AgentMetadataBrowserToolsList = ({ tools }: AgentMetadataBrowserToolsListProps) => {
  if (tools.length === 0) {
    return <AgentMetadataListEmpty>No browser tools</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataExpandableList
      items={tools}
      getKey={tool => tool}
      renderItem={tool => <Badge icon={<Globe className="text-cyan-500" />}>{tool}</Badge>}
    />
  );
};

export interface AgentMetadataCombinedProcessorListProps {
  inputProcessors: Array<{ id: string; name: string }>;
  outputProcessors: Array<{ id: string; name: string }>;
}

export const AgentMetadataCombinedProcessorList = ({
  inputProcessors,
  outputProcessors,
}: AgentMetadataCombinedProcessorListProps) => {
  const { Link, paths } = useLinkComponent();

  if (inputProcessors.length === 0 && outputProcessors.length === 0) {
    return <AgentMetadataListEmpty>No processors</AgentMetadataListEmpty>;
  }

  const inputProcessorId = inputProcessors[0]?.id;
  const outputProcessorId = outputProcessors[0]?.id;

  return (
    <AgentMetadataList>
      {inputProcessors.length > 0 && inputProcessorId && (
        <AgentMetadataListItem>
          <Badge
            render={<Link href={`${paths.workflowLink(inputProcessorId)}/graph`} data-testid="processor-badge" />}
            icon={<ProcessorIcon className="text-accent4" />}
          >
            input
          </Badge>
        </AgentMetadataListItem>
      )}
      {outputProcessors.length > 0 && outputProcessorId && (
        <AgentMetadataListItem>
          <Badge
            render={<Link href={`${paths.workflowLink(outputProcessorId)}/graph`} data-testid="processor-badge" />}
            icon={<ProcessorIcon className="text-accent5" />}
          >
            output
          </Badge>
        </AgentMetadataListItem>
      )}
    </AgentMetadataList>
  );
};
