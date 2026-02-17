import { Badge } from '@/ds/components/Badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { SkillIcon } from '@/ds/icons/SkillIcon';
import { MemoryIcon } from '@/ds/icons/MemoryIcon';
import { useLinkComponent } from '@/lib/framework';
import { GetToolResponse, GetWorkflowResponse } from '@mastra/client-js';
import { AgentMetadataSection } from './agent-metadata-section';
import { AgentMetadataList, AgentMetadataListEmpty, AgentMetadataListItem } from './agent-metadata-list';
import { AgentMetadataWrapper } from './agent-metadata-wrapper';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { ProcessorIcon } from '@/ds/icons/ProcessorIcon';
import { useScorers } from '@/domains/scores';
import { AgentIcon } from '@/ds/icons';
import { GaugeIcon, Folder } from 'lucide-react';
import { AgentMetadataModelList, AgentMetadataModelListProps } from './agent-metadata-model-list';
import { LoadingBadge } from '@/lib/ai-ui/tools/badges/loading-badge';
import { WORKSPACE_TOOLS_PREFIX } from '@/domains/workspace/constants';
import { Alert, AlertTitle, AlertDescription } from '@/ds/components/Alert';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { githubDarkInit } from '@uiw/codemirror-theme-github';
import { extractPrompt } from '../../utils/extractPrompt';
import { useReorderModelList, useUpdateModelInModelList } from '../../hooks/use-agents';
import { useAgent } from '../../hooks/use-agent';
import { Skeleton } from '@/ds/components/Skeleton';
import { useMemory } from '@/domains/memory/hooks';
import { useActivatedSkills } from '../../context/activated-skills-context';

export interface AgentMetadataProps {
  agentId: string;
}

export interface AgentMetadataNetworkListProps {
  agents: { id: string; name: string }[];
}

export const AgentMetadataNetworkList = ({ agents }: AgentMetadataNetworkListProps) => {
  const { Link, paths } = useLinkComponent();

  if (agents.length === 0) {
    return <AgentMetadataListEmpty>No agents</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataList>
      {agents.map(agent => (
        <AgentMetadataListItem key={agent.id}>
          <Link href={paths.agentLink(agent.id)} data-testid="agent-badge">
            <Badge variant="success" icon={<AgentIcon />}>
              {agent.name}
            </Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};

export const AgentMetadata = ({ agentId }: AgentMetadataProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { mutate: reorderModelList } = useReorderModelList(agentId);
  const { mutateAsync: updateModelInModelList } = useUpdateModelInModelList(agentId);
  const hasMemoryEnabled = Boolean(memory?.result);

  if (isLoading || isMemoryLoading) {
    return <Skeleton className="h-full" />;
  }

  if (!agent) {
    return <div>Agent not found</div>;
  }

  const networkAgentsMap = agent.agents ?? {};
  const networkAgents = Object.keys(networkAgentsMap).map(key => ({ ...networkAgentsMap[key], id: key }));

  const agentTools = agent.tools ?? {};
  const tools = Object.keys(agentTools).map(key => agentTools[key]);

  const agentWorkflows = agent.workflows ?? {};
  const workflows = Object.keys(agentWorkflows).map(key => ({ id: key, ...agentWorkflows[key] }));

  const skills = agent.skills ?? [];
  const workspaceTools = agent.workspaceTools ?? [];
  const workspaceId = agent.workspaceId;
  const inputProcessors = agent.inputProcessors ?? [];
  const outputProcessors = agent.outputProcessors ?? [];

  return (
    <AgentMetadataWrapper>
      {agent?.description && (
        <AgentMetadataSection title="Description">
          <p className="text-sm text-neutral6">{agent.description}</p>
        </AgentMetadataSection>
      )}
      {agent.modelList && (
        <AgentMetadataSection title="Models">
          <AgentMetadataModelList
            modelList={agent.modelList}
            updateModelInModelList={updateModelInModelList}
            reorderModelList={reorderModelList}
          />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection
        title="Memory"
        hint={{
          link: 'https://mastra.ai/en/docs/agents/agent-memory',
          title: 'Agent Memory documentation',
        }}
      >
        {hasMemoryEnabled ? (
          <Badge icon={<MemoryIcon />} variant="success" className="font-medium">
            <span className="sr-only">Memory is enabled</span>
            <span aria-hidden="true">On</span>
          </Badge>
        ) : (
          <Alert variant="warning">
            <AlertTitle as="h5">Memory not enabled</AlertTitle>
            <AlertDescription as="p">
              Thread messages will not be stored. To activate memory, see the{' '}
              <a
                href="https://mastra.ai/en/docs/agents/agent-memory"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                documentation
              </a>
              .
            </AlertDescription>
          </Alert>
        )}
      </AgentMetadataSection>

      {networkAgents.length > 0 && (
        <AgentMetadataSection
          title="Agents"
          hint={{
            link: 'https://mastra.ai/en/docs/agents/overview',
            title: 'Agents documentation',
          }}
        >
          <AgentMetadataNetworkList agents={networkAgents} />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection
        title="Tools"
        hint={{
          link: 'https://mastra.ai/en/docs/agents/using-tools-and-mcp',
          title: 'Using Tools and MCP documentation',
        }}
      >
        <AgentMetadataToolList tools={tools} agentId={agentId} />
      </AgentMetadataSection>

      <AgentMetadataSection
        title="Workflows"
        hint={{
          link: 'https://mastra.ai/en/docs/workflows/overview',
          title: 'Workflows documentation',
        }}
      >
        <AgentMetadataWorkflowList workflows={workflows} />
      </AgentMetadataSection>

      <AgentMetadataSection
        title="Skills"
        hint={{
          link: 'https://mastra.ai/en/docs/workspace/skills',
          title: 'Skills documentation',
        }}
      >
        <AgentMetadataSkillList skills={skills} agentId={agentId} workspaceId={workspaceId} />
      </AgentMetadataSection>

      {workspaceTools.length > 0 && (
        <AgentMetadataSection
          title="Workspace Tools"
          hint={{
            link: 'https://mastra.ai/en/reference/workspace/workspace-class#agent-tools',
            title: 'Workspace tools documentation',
          }}
        >
          <AgentMetadataWorkspaceToolsList tools={workspaceTools} />
        </AgentMetadataSection>
      )}

      {(inputProcessors.length > 0 || outputProcessors.length > 0) && (
        <AgentMetadataSection
          title="Processors"
          hint={{
            link: 'https://mastra.ai/docs/agents/processors',
            title: 'Processors documentation',
          }}
        >
          <AgentMetadataCombinedProcessorList inputProcessors={inputProcessors} outputProcessors={outputProcessors} />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection title="Scorers">
        <AgentMetadataScorerList entityId={agent.name} entityType="AGENT" />
      </AgentMetadataSection>
      <AgentMetadataSection title="System Prompt">
        <CodeMirror
          value={extractPrompt(agent.instructions)}
          editable={false}
          extensions={[markdown({ base: markdownLanguage, codeLanguages: languages }), EditorView.lineWrapping]}
          theme={githubDarkInit({
            settings: {
              caret: '#c6c6c6',
              fontFamily: 'monospace',
              background: 'transparent',
              gutterBackground: 'transparent',
              gutterForeground: '#939393',
              gutterBorder: 'none',
            },
          })}
        />
      </AgentMetadataSection>
    </AgentMetadataWrapper>
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
    <AgentMetadataList>
      {tools.map(tool => (
        <AgentMetadataListItem key={tool.id}>
          <Link href={paths.agentToolLink(agentId, tool.id)} data-testid="tool-badge">
            <Badge icon={<ToolsIcon className="text-accent6" />}>{tool.id}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
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
    <AgentMetadataList>
      {workflows.map(workflow => (
        <AgentMetadataListItem key={workflow.id}>
          <Link href={paths.workflowLink(workflow.id)} data-testid="workflow-badge">
            <Badge icon={<WorkflowIcon className="text-accent3" />}>{workflow.name}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
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
    <AgentMetadataList>
      {scorerList.map(scorer => (
        <AgentMetadataListItem key={scorer.id}>
          <Link href={paths.scorerLink(scorer.id)} data-testid="scorer-badge">
            <Badge icon={<GaugeIcon className="text-neutral3" />}>{scorer.scorer.config.name}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};

export interface AgentMetadataSkillListProps {
  skills: Array<{
    name: string;
    description: string;
    license?: string;
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
    <AgentMetadataList>
      {skills.map(skill => {
        const isActivated = isSkillActivated(skill.name);
        const badge = (
          <Badge
            icon={<SkillIcon className={`h-3 w-3 ${isActivated ? 'text-green-400' : 'text-accent2'}`} />}
            variant={isActivated ? 'success' : 'default'}
          >
            {skill.name}
            {isActivated && <span className="sr-only">Active</span>}
          </Badge>
        );

        return (
          <AgentMetadataListItem key={skill.name}>
            {isActivated ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={paths.agentSkillLink(agentId, skill.name, workspaceId)} data-testid="skill-badge">
                      {badge}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent className="bg-surface3 text-icon6 border border-border1">Active</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Link href={paths.agentSkillLink(agentId, skill.name, workspaceId)} data-testid="skill-badge">
                {badge}
              </Link>
            )}
          </AgentMetadataListItem>
        );
      })}
    </AgentMetadataList>
  );
};

export interface AgentMetadataWorkspaceToolsListProps {
  tools: string[];
}

/**
 * Format a workspace tool name for display.
 * Converts "mastra_workspace_read_file" to "read_file"
 */
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
    <AgentMetadataList>
      {tools.map(tool => (
        <AgentMetadataListItem key={tool}>
          <Badge icon={<Folder className="h-3 w-3 text-accent1" />}>{formatWorkspaceToolName(tool)}</Badge>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
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

  // Use the first processor's ID for the link (they're grouped into a single workflow per type)
  const inputProcessorId = inputProcessors[0]?.id;
  const outputProcessorId = outputProcessors[0]?.id;

  return (
    <AgentMetadataList>
      {inputProcessors.length > 0 && inputProcessorId && (
        <AgentMetadataListItem>
          <Link href={`${paths.workflowLink(inputProcessorId)}/graph`} data-testid="processor-badge">
            <Badge icon={<ProcessorIcon className="text-accent4" />}>input</Badge>
          </Link>
        </AgentMetadataListItem>
      )}
      {outputProcessors.length > 0 && outputProcessorId && (
        <AgentMetadataListItem>
          <Link href={`${paths.workflowLink(outputProcessorId)}/graph`} data-testid="processor-badge">
            <Badge icon={<ProcessorIcon className="text-accent5" />}>output</Badge>
          </Link>
        </AgentMetadataListItem>
      )}
    </AgentMetadataList>
  );
};
