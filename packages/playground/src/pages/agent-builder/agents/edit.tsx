import { Button, IconButton } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { MessageSquareIcon, SaveIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { EditableAgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import type { ActiveDetail, AgentConfig } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { ConversationPanel } from '@/domains/agent-builder/components/agent-builder-edit/conversation-panel';
import type { AvailableWorkspace } from '@/domains/agent-builder/components/agent-builder-edit/hooks/use-agent-builder-tool';
import { useStarterUserMessage } from '@/domains/agent-builder/components/agent-builder-edit/hooks/use-starter-user-message';
import { WorkspaceLayout } from '@/domains/agent-builder/components/agent-builder-edit/workspace-layout';
import { useSaveAgent } from '@/domains/agent-builder/hooks/use-save-agent';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkspaces } from '@/domains/workspace/hooks';

interface AvailableTool {
  id: string;
  description?: string;
}

type ToolsData = NonNullable<ReturnType<typeof useTools>['data']>;

const extractWorkspaceId = (workspace: StoredAgent['workspace']): string | undefined => {
  if (
    workspace &&
    typeof workspace === 'object' &&
    'type' in workspace &&
    (workspace as { type: string }).type === 'id'
  ) {
    const id = (workspace as { workspaceId?: unknown }).workspaceId;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
};

export default function AgentBuilderAgentEdit() {
  const { id } = useParams<{ id: string }>();
  const initialUserMessage = useStarterUserMessage();
  const fromStarter = initialUserMessage !== undefined;
  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent(id, { enabled: !fromStarter });
  const { data: toolsData, isPending: isToolsPending } = useTools();
  const { data: workspacesData } = useWorkspaces();
  const isReady = Boolean(id) && (fromStarter || !isStoredAgentLoading) && !isToolsPending;

  const availableWorkspaces = useMemo<AvailableWorkspace[]>(
    () => (workspacesData?.workspaces ?? []).map(ws => ({ id: ws.id, name: ws.name })),
    [workspacesData],
  );

  return (
    <AgentBuilderAgentEditPage
      id={id}
      storedAgent={storedAgent}
      toolsData={toolsData}
      availableWorkspaces={availableWorkspaces}
      isReady={isReady}
      initialUserMessage={initialUserMessage}
      fromStarter={fromStarter}
    />
  );
}

interface PageProps {
  id: string | undefined;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData | undefined;
  availableWorkspaces: AvailableWorkspace[];
  isReady: boolean;
  initialUserMessage: string | undefined;
  fromStarter: boolean;
}

const AgentBuilderAgentEditPage = ({
  id,
  storedAgent,
  toolsData,
  availableWorkspaces,
  isReady,
  initialUserMessage,
  fromStarter,
}: PageProps) => {
  const formMethods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: storedAgent?.name ?? '',
      description: storedAgent?.description ?? '',
      instructions: typeof storedAgent?.instructions === 'string' ? storedAgent.instructions : '',
      tools: Object.fromEntries(Object.keys(storedAgent?.tools ?? {}).map(k => [k, true])),
      skills: Object.keys(storedAgent?.skills ?? {}),
      workspaceId: extractWorkspaceId(storedAgent?.workspace),
    },
  });

  return (
    <FormProvider {...formMethods}>
      {!isReady || !id ? (
        <AgentBuilderAgentEditSkeleton />
      ) : (
        <AgentBuilderAgentEditReady
          id={id}
          storedAgent={storedAgent}
          toolsData={toolsData ?? {}}
          availableWorkspaces={availableWorkspaces}
          initialUserMessage={initialUserMessage}
          fromStarter={fromStarter}
        />
      )}
    </FormProvider>
  );
};

const AgentBuilderAgentEditSkeleton = () => (
  <WorkspaceLayout
    isLoading
    mode="build"
    chat={null}
    primaryAction={
      <Button size="sm" variant="primary" disabled data-testid="agent-builder-edit-save">
        <SaveIcon /> Save
      </Button>
    }
    configure={
      <EditableAgentConfigurePanel
        agent={{ id: '', name: '', systemPrompt: '' }}
        onAgentChange={() => {}}
        availableTools={[]}
        isLoading
      />
    }
  />
);

interface AgentBuilderAgentEditReadyProps {
  id: string;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData;
  availableWorkspaces: AvailableWorkspace[];
  initialUserMessage: string | undefined;
  fromStarter: boolean;
}

const AgentBuilderAgentEditReady = ({
  id,
  storedAgent,
  toolsData,
  availableWorkspaces,
  initialUserMessage,
  fromStarter,
}: AgentBuilderAgentEditReadyProps) => {
  const navigate = useNavigate();
  const features = useBuilderAgentFeatures();
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  const availableTools = useMemo<AvailableTool[]>(
    () =>
      Object.entries(toolsData).map(([toolId, tool]) => ({
        id: toolId,
        description: (tool as { description?: string }).description,
      })),
    [toolsData],
  );

  const [agent, setAgent] = useState<AgentConfig>({
    id: id ?? '',
    name: storedAgent?.name ?? '',
    systemPrompt: typeof storedAgent?.instructions === 'string' ? storedAgent.instructions : '',
  });

  const [activeDetail, setActiveDetail] = useState<ActiveDetail>(null);

  const mode: 'create' | 'edit' = storedAgent ? 'edit' : 'create';
  const { save, isSaving } = useSaveAgent({ agentId: id, mode, availableTools });

  const handleSaveSuccess = async (values: AgentBuilderEditFormValues) => {
    await save(values);
    void navigate(`/agent-builder/agents`, { viewTransition: true });
  };
  const handleSave = formMethods.handleSubmit(handleSaveSuccess);

  return (
    <WorkspaceLayout
      isLoading={false}
      mode="build"
      detailOpen={activeDetail !== null}
      modeAction={
        mode === 'edit' ? (
          <IconButton
            tooltip="Chat"
            className="rounded-full"
            onClick={() => navigate(`/agent-builder/agents/${id}/view`, { viewTransition: true })}
            data-testid="agent-builder-edit-preview"
          >
            <MessageSquareIcon />
          </IconButton>
        ) : undefined
      }
      primaryAction={
        <Button
          size="sm"
          variant="primary"
          onClick={handleSave}
          disabled={isSaving}
          data-testid="agent-builder-edit-save"
        >
          <SaveIcon /> {isSaving ? 'Saving…' : mode === 'edit' ? 'Save' : 'Create'}
        </Button>
      }
      chat={
        <MastraReactProvider baseUrl="http://localhost:4112">
          <ConversationPanel
            initialUserMessage={initialUserMessage}
            isFreshThread={fromStarter}
            features={features}
            availableTools={availableTools}
            availableWorkspaces={availableWorkspaces}
            toolsReady
            agentId={id}
          />
        </MastraReactProvider>
      }
      configure={
        <EditableAgentConfigurePanel
          agent={agent}
          onAgentChange={setAgent}
          availableTools={availableTools}
          isLoading={false}
          activeDetail={activeDetail}
          onActiveDetailChange={setActiveDetail}
        />
      }
    />
  );
};
