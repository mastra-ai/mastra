import { useCallback, useRef, useState } from 'react';

import {
  MainContentLayout,
  toast,
  useLinkComponent,
  useStoredAgentMutations,
  AgentCreateHeader,
  AgentCreateMain,
  AgentCreateSidebar,
  AgentLayout,
  useAgentCreateForm,
} from '@mastra/playground-ui';

function CmsAgentsCreatePage() {
  const { navigate, paths } = useLinkComponent();
  const { createStoredAgent } = useStoredAgentMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { form } = useAgentCreateForm();

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
        tools: values.tools && values.tools.length > 0 ? values.tools : undefined,
        workflows: values.workflows && values.workflows.length > 0 ? values.workflows : undefined,
        agents: values.agents && values.agents.length > 0 ? values.agents : undefined,
        memory: values.memory ? ({ key: values.memory } as Record<string, unknown>) : undefined,
        scorers: values.scorers && Object.keys(values.scorers).length > 0 ? values.scorers : undefined,
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
    <MainContentLayout>
      <AgentCreateHeader onPublish={handlePublish} isSubmitting={isSubmitting} />
      <AgentLayout agentId="agent-create" rightSlot={<AgentCreateSidebar form={form} />}>
        <form ref={formRef} className="h-full">
          <AgentCreateMain form={form} formRef={formRef} />
        </form>
      </AgentLayout>
    </MainContentLayout>
  );
}

export { CmsAgentsCreatePage };

export default CmsAgentsCreatePage;
