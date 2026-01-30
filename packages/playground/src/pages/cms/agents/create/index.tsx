import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  AgentIcon,
  toast,
  useLinkComponent,
  AgentForm,
  AgentFormValues,
  useStoredAgentMutations,
} from '@mastra/playground-ui';

function CmsAgentsCreatePage() {
  const { navigate, paths } = useLinkComponent();
  const { createStoredAgent } = useStoredAgentMutations();

  const handleSubmit = async (values: AgentFormValues) => {
    const agentId = crypto.randomUUID();
    try {
      const createParams = {
        id: agentId,
        name: values.name,
        description: values.description,
        instructions: values.instructions,
        model: values.model as Record<string, unknown>,
        tools: values.tools && values.tools.length > 0 ? values.tools : undefined,
        workflows: values.workflows,
        agents: values.agents,
        memory: values.memory ? ({ key: values.memory } as Record<string, unknown>) : undefined,
        scorers: values.scorers,
      };

      await createStoredAgent.mutateAsync(createParams);
      toast.success('Agent created successfully');
      navigate(`${paths.agentLink(agentId)}/chat`);
    } catch (error) {
      toast.error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    navigate(paths.agentsLink());
  };

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Create Agent
        </HeaderTitle>
      </Header>

      <MainContentContent>
        <div className="mx-auto max-w-2xl py-6">
          <AgentForm
            mode="create"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={createStoredAgent.isPending}
          />
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
}

export { CmsAgentsCreatePage };

export default CmsAgentsCreatePage;
