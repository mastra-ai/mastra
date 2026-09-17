import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Card } from '@mastra/playground-ui/components/Card';
import { codeLanguages, useCodemirrorTheme } from '@mastra/playground-ui/components/CodeEditor';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { useAgent } from '../../hooks/use-agent';
import { useReorderModelList, useUpdateModelInModelList } from '../../hooks/use-agents';
import { useChannelPlatforms } from '../../hooks/use-channels';
import { extractPrompt } from '../../utils/extractPrompt';
import { AgentChannels } from '../agent-channels/agent-channels';
import {
  AgentMetadataBrowserToolsList,
  AgentMetadataCombinedProcessorList,
  AgentMetadataNetworkList,
  AgentMetadataScorerList,
  AgentMetadataSkillList,
  AgentMetadataToolList,
  AgentMetadataWorkflowList,
  AgentMetadataWorkspaceToolsList,
} from '../agent-metadata/agent-metadata-lists';
import { AgentMetadataModelList } from '../agent-metadata/agent-metadata-model-list';
import { AgentMetadataSection } from '../agent-metadata/agent-metadata-section';
import { AgentMemoryConfig } from '../agent-settings/agent-memory-config';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useRouteSidePanel } from '@/lib/route-side-panel';

export interface AgentOverviewPanelProps {
  agentId: string;
}

/**
 * Read-only "quick scan" of an agent (models, capabilities, prompt, memory,
 * channels) rendered in the Studio side panel next to the main frame.
 */
export function AgentOverviewPanel({ agentId }: AgentOverviewPanelProps) {
  const { isCollapsed } = useRouteSidePanel();

  return (
    <Card
      data-testid="agent-overview-panel"
      className="rounded-studio-frame grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden"
    >
      {/* The header route action owns the close control (see AgentDetailHeaderActions). */}
      <div className="border-border1 flex h-10 min-h-10 items-center border-b px-4">
        <Txt as="h2" variant="ui-md" className="text-neutral6 font-medium">
          Config
        </Txt>
      </div>

      <ScrollArea className="min-h-0" viewPortClassName="h-full" mask={{ top: false }}>
        {/* Skip the sections (and their data fetching) while the panel is collapsed. */}
        <div className="p-4">{!isCollapsed && <AgentOverviewSections agentId={agentId} />}</div>
      </ScrollArea>
    </Card>
  );
}

function AgentOverviewSections({ agentId }: AgentOverviewPanelProps) {
  const { data: agent, isLoading } = useAgent(agentId);
  const { mutate: reorderModelList } = useReorderModelList(agentId);
  const { mutateAsync: updateModelInModelList } = useUpdateModelInModelList(agentId);
  const codemirrorTheme = useCodemirrorTheme();
  const { isCmsAvailable, isLoading: isCmsLoading } = useIsCmsAvailable();
  const { data: channelPlatforms } = useChannelPlatforms();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" data-testid="agent-overview-panel-skeleton">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-16" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (!agent) {
    return (
      <Txt variant="ui-md" className="text-neutral3">
        Agent not found
      </Txt>
    );
  }

  const networkAgentsMap = agent.agents ?? {};
  const networkAgents = Object.keys(networkAgentsMap).map(key => ({ ...networkAgentsMap[key], id: key }));
  const agentTools = agent.tools ?? {};
  const tools = Object.keys(agentTools).map(key => agentTools[key]);
  const agentWorkflows = agent.workflows ?? {};
  const workflows = Object.keys(agentWorkflows).map(key => ({ id: key, ...agentWorkflows[key] }));
  const skills = agent.skills ?? [];
  const workspaceTools = agent.workspaceTools ?? [];
  const browserTools = agent.browserTools ?? [];
  const inputProcessors = agent.inputProcessors ?? [];
  const outputProcessors = agent.outputProcessors ?? [];
  const hasChannels = Boolean(channelPlatforms?.length);

  return (
    <>
      {agent.modelList && (
        <AgentMetadataSection title="Models">
          <AgentMetadataModelList
            modelList={agent.modelList}
            updateModelInModelList={updateModelInModelList}
            reorderModelList={reorderModelList}
          />
        </AgentMetadataSection>
      )}

      {networkAgents.length > 0 && (
        <AgentMetadataSection
          title={<SectionTitleWithCount title="Agents" count={networkAgents.length} />}
          hint={{ link: 'https://mastra.ai/en/docs/agents/overview', title: 'Agents documentation' }}
        >
          <AgentMetadataNetworkList agents={networkAgents} />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection
        title={<SectionTitleWithCount title="Tools" count={tools.length} />}
        hint={{
          link: 'https://mastra.ai/en/docs/agents/using-tools-and-mcp',
          title: 'Using Tools and MCP documentation',
        }}
      >
        <AgentMetadataToolList tools={tools} agentId={agentId} />
      </AgentMetadataSection>

      <AgentMetadataSection
        title={<SectionTitleWithCount title="Workflows" count={workflows.length} />}
        hint={{ link: 'https://mastra.ai/en/docs/workflows/overview', title: 'Workflows documentation' }}
      >
        <AgentMetadataWorkflowList workflows={workflows} />
      </AgentMetadataSection>

      {workspaceTools.length > 0 && (
        <AgentMetadataSection
          title={<SectionTitleWithCount title="Workspace Tools" count={workspaceTools.length} />}
          hint={{
            link: 'https://mastra.ai/en/reference/workspace/workspace-class#agent-tools',
            title: 'Workspace tools documentation',
          }}
        >
          <AgentMetadataWorkspaceToolsList tools={workspaceTools} />
        </AgentMetadataSection>
      )}

      {browserTools.length > 0 && (
        <AgentMetadataSection
          title={<SectionTitleWithCount title="Browser Tools" count={browserTools.length} />}
          hint={{
            link: 'https://mastra.ai/en/docs/agents/adding-browser-control',
            title: 'Browser tools documentation',
          }}
        >
          <AgentMetadataBrowserToolsList tools={browserTools} />
        </AgentMetadataSection>
      )}

      {(inputProcessors.length > 0 || outputProcessors.length > 0) && (
        <AgentMetadataSection
          title="Processors"
          hint={{ link: 'https://mastra.ai/docs/agents/processors', title: 'Processors documentation' }}
        >
          <AgentMetadataCombinedProcessorList inputProcessors={inputProcessors} outputProcessors={outputProcessors} />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection
        title={<SectionTitleWithCount title="Skills" count={skills.length} />}
        hint={{ link: 'https://mastra.ai/en/docs/workspace/skills', title: 'Skills documentation' }}
      >
        <AgentMetadataSkillList skills={skills} agentId={agentId} workspaceId={agent.workspaceId} />
      </AgentMetadataSection>

      <AgentMetadataSection title="Scorers">
        <AgentMetadataScorerList entityId={agent.name} entityType="AGENT" />
      </AgentMetadataSection>

      <AgentMetadataSection title="Memory">
        <AgentMemoryConfig agentId={agentId} />
      </AgentMetadataSection>

      {hasChannels && (
        <AgentMetadataSection title="Channels">
          <AgentChannels agentId={agentId} />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection title="System Prompt">
        <CodeMirror
          className="border-border1 rounded-md border"
          value={extractPrompt(agent.instructions)}
          editable={false}
          extensions={[markdown({ base: markdownLanguage, codeLanguages }), EditorView.lineWrapping]}
          theme={codemirrorTheme}
        />
        {!isCmsLoading && !isCmsAvailable && (
          <Notice variant="warning" title="Read-only">
            <Notice.Message>
              To edit the system prompt in Studio, add <code className="font-medium">@mastra/editor</code> to your
              project. See the{' '}
              <a
                href="https://mastra.ai/docs/editor/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                documentation
              </a>
              .
            </Notice.Message>
          </Notice>
        )}
      </AgentMetadataSection>
    </>
  );
}

const SectionTitleWithCount = ({ title, count }: { title: string; count: number }) => (
  <span className="flex items-center gap-1.5">
    {title}
    <Badge variant="neutral">{count}</Badge>
  </span>
);
