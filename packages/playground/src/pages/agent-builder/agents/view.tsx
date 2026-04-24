import { IconButton } from '@mastra/playground-ui';
import { PencilIcon } from 'lucide-react';
import { useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { AgentChatPanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-chat-panel';
import { AgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import type { AgentConfig } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { WorkspaceLayout } from '@/domains/agent-builder/components/agent-builder-edit/workspace-layout';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

interface AvailableTool {
  id: string;
  description?: string;
}

type ToolsData = NonNullable<ReturnType<typeof useTools>['data']>;

export default function AgentBuilderAgentView() {
  const { id } = useParams<{ id: string }>();
  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent(id);
  const { data: toolsData, isPending: isToolsPending } = useTools();
  const isReady = Boolean(id) && !isStoredAgentLoading && !isToolsPending;

  return (
    <AgentBuilderAgentViewPage
      key={isReady ? 'ready' : 'loading'}
      id={id}
      storedAgent={storedAgent}
      toolsData={toolsData}
      isReady={isReady}
    />
  );
}

interface PageProps {
  id: string | undefined;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData | undefined;
  isReady: boolean;
}

const extractWorkspaceId = (workspace: StoredAgent['workspace']): string | undefined => {
  if (workspace && typeof workspace === 'object' && 'type' in workspace && (workspace as { type: string }).type === 'id') {
    const wsId = (workspace as { workspaceId?: unknown }).workspaceId;
    return typeof wsId === 'string' ? wsId : undefined;
  }
  return undefined;
};

const AgentBuilderAgentViewPage = ({ id, storedAgent, toolsData, isReady }: PageProps) => {
  const formMethods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: storedAgent?.name ?? '',
      instructions: typeof storedAgent?.instructions === 'string' ? storedAgent.instructions : '',
      tools: Object.fromEntries(Object.keys(storedAgent?.tools ?? {}).map(k => [k, true])),
      skills: Object.keys(storedAgent?.skills ?? {}),
      workspaceId: extractWorkspaceId(storedAgent?.workspace),
    },
  });

  return (
    <FormProvider {...formMethods}>
      {!isReady || !id ? (
        <AgentBuilderAgentViewSkeleton />
      ) : (
        <AgentBuilderAgentViewReady id={id} storedAgent={storedAgent} toolsData={toolsData ?? {}} />
      )}
    </FormProvider>
  );
};

const AgentBuilderAgentViewSkeleton = () => (
  <WorkspaceLayout
    isLoading
    defaultExpanded={false}
    chat={null}
    configure={
      <AgentConfigurePanel
        agent={{ id: '', name: '', systemPrompt: '' }}
        onAgentChange={() => {}}
        editable={false}
        isLoading
        availableTools={[]}
      />
    }
  />
);

interface AgentBuilderAgentViewReadyProps {
  id: string;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData;
}

const AgentBuilderAgentViewReady = ({ id, storedAgent, toolsData }: AgentBuilderAgentViewReadyProps) => {
  const navigate = useNavigate();

  const availableTools = useMemo<AvailableTool[]>(
    () =>
      Object.entries(toolsData).map(([toolId, tool]) => ({
        id: toolId,
        description: (tool as { description?: string }).description,
      })),
    [toolsData],
  );

  const agent = useMemo<AgentConfig>(
    () => ({
      id: storedAgent?.id ?? id ?? '',
      name: storedAgent?.name ?? '',
      systemPrompt: typeof storedAgent?.instructions === 'string' ? storedAgent.instructions : '',
    }),
    [storedAgent, id],
  );

  return (
    <WorkspaceLayout
      isLoading={false}
      defaultExpanded={false}
      toolbarAction={
        <IconButton
          tooltip="Edit agent"
          className="rounded-full"
          onClick={() => navigate(`/agent-builder/agents/${id}/edit`, { viewTransition: true })}
          data-testid="agent-builder-view-edit"
        >
          <PencilIcon />
        </IconButton>
      }
      chat={<AgentChatPanel agentId={id} />}
      configure={
        <AgentConfigurePanel
          agent={agent}
          onAgentChange={() => {}}
          editable={false}
          isLoading={false}
          availableTools={availableTools}
        />
      }
    />
  );
};
