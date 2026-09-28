import type { GetToolResponse, GetWorkflowResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { LoadingBadge } from '@mastra/playground-ui/domains/chat/components/loading-badge';
import { WORKSPACE_TOOLS_PREFIX } from '@mastra/playground-ui/domains/chat/tools/workspace-tool-constants';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useActivatedSkills } from '../../context/activated-skills-context';
import { AgentMetadataExpandableList } from './agent-metadata-expandable-list';
import { AgentMetadataList, AgentMetadataListEmpty, AgentMetadataListItem } from './agent-metadata-list';
import { useScorers } from '@/domains/scores';

const metadataLinkClassName =
  'pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:justify-center';

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
        <Link href={paths.agentLink(agent.id)} data-testid="agent-badge" className={metadataLinkClassName}>
          <Badge>{agent.name}</Badge>
        </Link>
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
        <Link href={paths.agentToolLink(agentId, tool.id)} data-testid="tool-badge" className={metadataLinkClassName}>
          <Badge>{tool.id}</Badge>
        </Link>
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
        <Link href={paths.workflowLink(workflow.id)} data-testid="workflow-badge" className={metadataLinkClassName}>
          <Badge>{workflow.name}</Badge>
        </Link>
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
        <Link href={paths.scorerLink(scorer.id)} data-testid="scorer-badge" className={metadataLinkClassName}>
          <Badge>{scorer.scorer.config.name}</Badge>
        </Link>
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
          <Badge variant={isActivated ? 'green' : 'neutral'}>
            {skill.name}
            {isActivated && <span className="sr-only">Active</span>}
          </Badge>
        );

        return isActivated ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={paths.agentSkillLink(agentId, skill.name, skill.path, workspaceId)}
                  data-testid="skill-badge"
                  className={metadataLinkClassName}
                >
                  {badge}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Active</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Link
            href={paths.agentSkillLink(agentId, skill.name, skill.path, workspaceId)}
            data-testid="skill-badge"
            className={metadataLinkClassName}
          >
            {badge}
          </Link>
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
      renderItem={tool => <Badge>{formatWorkspaceToolName(tool)}</Badge>}
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

  return <AgentMetadataExpandableList items={tools} getKey={tool => tool} renderItem={tool => <Badge>{tool}</Badge>} />;
};

export interface AgentMetadataCombinedProcessorListProps {
  inputProcessors: Array<{ id: string; name?: string }>;
  outputProcessors: Array<{ id: string; name?: string }>;
}

export const AgentMetadataCombinedProcessorList = ({
  inputProcessors,
  outputProcessors,
}: AgentMetadataCombinedProcessorListProps) => {
  const { Link, paths } = useLinkComponent();

  if (inputProcessors.length === 0 && outputProcessors.length === 0) {
    return <AgentMetadataListEmpty>No processors</AgentMetadataListEmpty>;
  }

  // Use the first processor's ID for the link (they're grouped into a single workflow per type)
  const inputProcessorId = inputProcessors[0]?.id;
  const outputProcessorId = outputProcessors[0]?.id;

  return (
    <AgentMetadataList>
      {inputProcessors.length > 0 && inputProcessorId && (
        <AgentMetadataListItem>
          <Link
            href={`${paths.workflowLink(inputProcessorId)}/graph`}
            data-testid="processor-badge"
            className={metadataLinkClassName}
          >
            <Badge>input</Badge>
          </Link>
        </AgentMetadataListItem>
      )}
      {outputProcessors.length > 0 && outputProcessorId && (
        <AgentMetadataListItem>
          <Link
            href={`${paths.workflowLink(outputProcessorId)}/graph`}
            data-testid="processor-badge"
            className={metadataLinkClassName}
          >
            <Badge>output</Badge>
          </Link>
        </AgentMetadataListItem>
      )}
    </AgentMetadataList>
  );
};
