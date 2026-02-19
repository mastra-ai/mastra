import { useRef } from 'react';

import type { CreateStoredScorerParams } from '@mastra/client-js';

import { toast } from '@/lib/toast';
import { AgentEditLayout } from '@/domains/agents/components/agent-edit-page/agent-edit-layout';

import { ScorerEditSidebar } from './scorer-edit-page/scorer-edit-sidebar';
import { ScorerEditMain } from './scorer-edit-page/scorer-edit-main';
import { useScorerEditForm } from './scorer-edit-page/use-scorer-edit-form';
import { useStoredScorerMutations } from '../hooks/use-stored-scorers';

interface ScorerCreateContentProps {
  onSuccess?: (scorer: { id: string }) => void;
}

export function ScorerCreateContent({ onSuccess }: ScorerCreateContentProps) {
  const { createStoredScorer } = useStoredScorerMutations();
  const formRef = useRef<HTMLFormElement | null>(null);
  const { form } = useScorerEditForm();

  const handlePublish = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();

    try {
      const createParams: CreateStoredScorerParams = {
        name: values.name,
        description: values.description || undefined,
        type: values.type,
        model: values.model,
        instructions: values.instructions || undefined,
        scoreRange: values.scoreRange,
        defaultSampling:
          values.defaultSampling?.type === 'ratio' && typeof values.defaultSampling.rate === 'number'
            ? values.defaultSampling
            : { type: 'none' as const },
      };

      const created = await createStoredScorer.mutateAsync(createParams);
      toast.success('Scorer created successfully');
      onSuccess?.(created);
    } catch (error) {
      toast.error(`Failed to create scorer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <AgentEditLayout
      leftSlot={
        <ScorerEditSidebar
          form={form}
          onPublish={handlePublish}
          isSubmitting={createStoredScorer.isPending}
          formRef={formRef}
        />
      }
    >
      <form ref={formRef} className="h-full">
        <ScorerEditMain form={form} />
      </form>
    </AgentEditLayout>
  );
}
