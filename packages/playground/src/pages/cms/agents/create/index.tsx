import { useCallback, useRef, useState } from 'react';

import {
  toast,
  useLinkComponent,
  useStoredAgentMutations,
  AgentEditMainContentBlocks,
  AgentEditSidebar,
  AgentLayout,
  useAgentEditForm,
  Header,
  HeaderTitle,
  Icon,
  AgentIcon,
} from '@mastra/playground-ui';

function CmsAgentsCreatePage() {
  const { navigate, paths } = useLinkComponent();
  const { createStoredAgent } = useStoredAgentMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { form } = useAgentEditForm();

  const handlePublish = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();
    const agentId = crypto.randomUUID();
    setIsSubmitting(true);

    try {
      const createParams = {
        id: agentId,
        name: values.name,
        description: values.description || undefined,
        instructions: values.instructions,
        model: values.model as Record<string, unknown>,
        tools: values.tools && Object.keys(values.tools).length > 0 ? Object.keys(values.tools) : undefined,
        workflows:
          values.workflows && Object.keys(values.workflows).length > 0 ? Object.keys(values.workflows) : undefined,
        agents: values.agents && Object.keys(values.agents).length > 0 ? Object.keys(values.agents) : undefined,
        scorers: values.scorers && Object.keys(values.scorers).length > 0 ? values.scorers : undefined,
        memory: values.memory?.enabled
          ? {
              options: {
                lastMessages: values.memory.lastMessages,
                semanticRecall: values.memory.semanticRecall,
                readOnly: values.memory.readOnly,
              },
            }
          : undefined,
      };

      await createStoredAgent.mutateAsync(createParams);
      toast.success('Agent created successfully');
      navigate(`${paths.agentLink(agentId)}/chat`);
    } catch (error) {
      toast.error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, createStoredAgent, navigate, paths]);

  return (
    <AgentLayout
      agentId="agent-create"
      headerSlot={
        <Header>
          <HeaderTitle>
            <Icon>
              <AgentIcon />
            </Icon>
            Create an agent from UI
          </HeaderTitle>
        </Header>
      }
      leftSlot={
        <AgentEditSidebar form={form} onPublish={handlePublish} isSubmitting={isSubmitting} formRef={formRef} />
      }
    >
      <form ref={formRef} className="h-full">
        <AgentEditMainContentBlocks form={form} />
      </form>
    </AgentLayout>
  );
}

export { CmsAgentsCreatePage };

export default CmsAgentsCreatePage;
