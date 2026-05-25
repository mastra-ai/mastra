import type { CreateStoredPromptBlockParams } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';

import { useStoredPromptBlockMutations } from '../hooks/use-stored-prompt-blocks';
import { PromptBlockEditMain } from './prompt-block-edit-page/prompt-block-edit-main';
import { PromptBlockEditSidebar } from './prompt-block-edit-page/prompt-block-edit-sidebar';
import { usePromptBlockEditForm } from './prompt-block-edit-page/use-prompt-block-edit-form';
import { AgentEditLayout } from '@/domains/agents/components/agent-edit-page/agent-edit-layout';

interface PromptBlockCreateContentProps {
  onSuccess?: (block: { id: string }) => void;
}

export function PromptBlockCreateContent({ onSuccess }: PromptBlockCreateContentProps) {
  const { createStoredPromptBlock } = useStoredPromptBlockMutations();
  const { form } = usePromptBlockEditForm();

  const handlePublish = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();

    try {
      const createParams: CreateStoredPromptBlockParams = {
        name: values.name,
        description: values.description || undefined,
        content: values.content,
        rules: values.rules || undefined,
        requestContextSchema: (values.variables as Record<string, unknown>) || undefined,
      };

      const created = await createStoredPromptBlock.mutateAsync(createParams);
      toast.success('Prompt block created successfully');
      onSuccess?.(created);
    } catch (error) {
      toast.error(`Failed to create prompt block: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <AgentEditLayout
      leftSlot={
        <PromptBlockEditSidebar
          form={form}
          onPublish={handlePublish}
          isSubmitting={createStoredPromptBlock.isPending}
        />
      }
    >
      <form className="h-full">
        <PromptBlockEditMain form={form} />
      </form>
    </AgentEditLayout>
  );
}
