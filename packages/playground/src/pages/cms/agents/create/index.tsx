import { useCallback, useRef, useState } from 'react';

import {
  toast,
  useLinkComponent,
  useStoredAgentMutations,
  AgentEditSidebar,
  AgentEditLayout,
  useAgentEditForm,
  MainContentLayout,
  AgentEditMainContentBlocks,
  Header,
  HeaderTitle,
  Icon,
  AgentIcon,
} from '@mastra/playground-ui';
import { CreateStoredAgentParams } from '@mastra/client-js';

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
    setIsSubmitting(true);

    try {
      const formScorers = values.scorers ? Object.entries(values.scorers) : undefined;
      const scorers = formScorers
        ? Object.fromEntries(
            formScorers.map(([key, value]) => [
              key,
              {
                description: value.description,
                sampling: value.sampling
                  ? {
                      type: value.sampling.type,
                      rate: value.sampling.rate || 0,
                    }
                  : undefined,
              },
            ]),
          )
        : undefined;

      const createParams: CreateStoredAgentParams = {
        name: values.name,
        description: values.description || undefined,
        instructions: (values.instructionBlocks ?? []).map(block => ({
          type: block.type,
          content: block.content,
          rules: block.rules,
        })),
        model: values.model,
        tools: values.tools && Object.keys(values.tools).length > 0 ? values.tools : undefined,
        workflows:
          values.workflows && Object.keys(values.workflows).length > 0 ? Object.keys(values.workflows) : undefined,
        agents: values.agents && Object.keys(values.agents).length > 0 ? Object.keys(values.agents) : undefined,
        scorers,
        memory: values.memory?.enabled
          ? {
              options: {
                lastMessages: values.memory.lastMessages,
                semanticRecall: values.memory.semanticRecall,
                readOnly: values.memory.readOnly,
              },
            }
          : undefined,
        requestContextSchema: values.variables as Record<string, unknown> | undefined,
      };

      const created = await createStoredAgent.mutateAsync(createParams);
      toast.success('Agent created successfully');
      navigate(`${paths.agentLink(created.id)}/chat`);
    } catch (error) {
      toast.error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, createStoredAgent, navigate, paths]);

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Create an agent
        </HeaderTitle>
      </Header>
      <AgentEditLayout
        leftSlot={
          <AgentEditSidebar form={form} onPublish={handlePublish} isSubmitting={isSubmitting} formRef={formRef} />
        }
      >
        <form ref={formRef} className="h-full">
          <AgentEditMainContentBlocks form={form} />
        </form>
      </AgentEditLayout>
    </MainContentLayout>
  );
}

export { CmsAgentsCreatePage };

export default CmsAgentsCreatePage;
