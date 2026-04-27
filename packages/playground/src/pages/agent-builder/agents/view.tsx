import { IconButton, Spinner } from '@mastra/playground-ui';
import { PencilIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { AgentChatPanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-chat-panel';
import { AgentConfigurePanel } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import type { ActiveDetail } from '@/domains/agent-builder/components/agent-builder-edit/agent-configure-panel';
import { WorkspaceLayout } from '@/domains/agent-builder/components/agent-builder-edit/workspace-layout';
import { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';
import { storedAgentToAgentConfig } from '@/domains/agent-builder/mappers/stored-agent-to-agent-config';
import { storedAgentToFormValues } from '@/domains/agent-builder/mappers/stored-agent-to-form-values';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

type ToolsData = NonNullable<ReturnType<typeof useTools>['data']>;
type AgentsData = NonNullable<ReturnType<typeof useAgents>['data']>;

export default function AgentBuilderAgentView() {
  const { id } = useParams<{ id: string }>();
  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent(id);
  const { data: toolsData, isPending: isToolsPending } = useTools();
  const { data: agentsData, isPending: isAgentsPending } = useAgents();
  const isReady = Boolean(id) && !isStoredAgentLoading && !isToolsPending && !isAgentsPending;

  if (!isReady) return <AgentBuilderAgentViewSkeleton />;

  return <AgentBuilderAgentViewPage id={id} storedAgent={storedAgent} toolsData={toolsData} agentsData={agentsData} />;
}

interface PageProps {
  id: string | undefined;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData | undefined;
  agentsData: AgentsData | undefined;
}

const AgentBuilderAgentViewPage = ({ id, storedAgent, toolsData, agentsData }: PageProps) => {
  const formMethods = useForm<AgentBuilderEditFormValues>({
    defaultValues: storedAgentToFormValues(storedAgent),
  });

  return (
    <FormProvider {...formMethods}>
      <AgentBuilderAgentViewReady
        id={id!}
        storedAgent={storedAgent}
        toolsData={toolsData ?? {}}
        agentsData={agentsData ?? {}}
      />
    </FormProvider>
  );
};

const AgentBuilderAgentViewSkeleton = () => (
  <div className="h-screen w-screen flex items-center justify-center">
    <Spinner />
  </div>
);

interface AgentBuilderAgentViewReadyProps {
  id: string;
  storedAgent: StoredAgent | null | undefined;
  toolsData: ToolsData;
  agentsData: AgentsData;
}

const AgentBuilderAgentViewReady = ({ id, storedAgent, toolsData, agentsData }: AgentBuilderAgentViewReadyProps) => {
  const navigate = useNavigate();
  const [activeDetail, setActiveDetail] = useState<ActiveDetail>(null);
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const selectedTools = useWatch({ control: formMethods.control, name: 'tools' });
  const selectedAgents = useWatch({ control: formMethods.control, name: 'agents' });

  const availableAgentTools = useAvailableAgentTools({
    toolsData,
    agentsData,
    selectedTools,
    selectedAgents,
    excludeAgentId: id,
  });

  const agent = useMemo(() => storedAgentToAgentConfig(storedAgent, id ?? ''), [storedAgent, id]);

  return (
    <WorkspaceLayout
      isLoading={false}
      mode="test"
      defaultExpanded={false}
      detailOpen={activeDetail !== null}
      modeAction={
        <IconButton
          tooltip="Edit configuration"
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
          editable={false}
          isLoading={false}
          availableAgentTools={availableAgentTools}
          activeDetail={activeDetail}
          onActiveDetailChange={setActiveDetail}
        />
      }
    />
  );
};
