import { useCallback, useRef, useState } from 'react';
import { GaugeIcon } from 'lucide-react';

import {
  toast,
  useLinkComponent,
  useStoredScorerMutations,
  ScorerEditSidebar,
  AgentEditLayout,
  useScorerEditForm,
  MainContentLayout,
  ScorerEditMain,
  Header,
  HeaderTitle,
  Icon,
} from '@mastra/playground-ui';

import type { CreateStoredScorerParams } from '@mastra/client-js';

function CmsScorersCreatePage() {
  const { navigate, paths } = useLinkComponent();
  const { createStoredScorer } = useStoredScorerMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { form } = useScorerEditForm();

  const handlePublish = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();
    setIsSubmitting(true);

    try {
      const isLlmJudge = values.type === 'llm-judge';

      const createParams: CreateStoredScorerParams = {
        name: values.name,
        description: values.description || undefined,
        type: values.type,
        ...(isLlmJudge && {
          model: values.model,
          instructions: values.instructions || undefined,
          scoreRange: values.scoreRange,
        }),
        ...(values.defaultSampling?.type === 'ratio' &&
          typeof values.defaultSampling.rate === 'number' && {
            defaultSampling: values.defaultSampling,
          }),
      };

      const created = await createStoredScorer.mutateAsync(createParams);
      toast.success('Scorer created successfully');
      navigate(paths.scorerLink(created.id));
    } catch (error) {
      toast.error(`Failed to create scorer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, createStoredScorer, navigate, paths]);

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <GaugeIcon />
          </Icon>
          Create a scorer
        </HeaderTitle>
      </Header>
      <AgentEditLayout
        leftSlot={
          <ScorerEditSidebar form={form} onPublish={handlePublish} isSubmitting={isSubmitting} formRef={formRef} />
        }
      >
        <form ref={formRef} className="h-full">
          <ScorerEditMain form={form} />
        </form>
      </AgentEditLayout>
    </MainContentLayout>
  );
}

export { CmsScorersCreatePage };

export default CmsScorersCreatePage;
