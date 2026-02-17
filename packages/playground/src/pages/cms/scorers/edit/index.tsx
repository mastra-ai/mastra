import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { GaugeIcon } from 'lucide-react';

import {
  toast,
  useLinkComponent,
  useStoredScorer,
  useStoredScorerMutations,
  ScorerEditMain,
  ScorerEditSidebar,
  AgentEditLayout,
  useScorerEditForm,
  Header,
  HeaderTitle,
  Icon,
  Spinner,
  MainContentLayout,
  Skeleton,
  type ScorerFormValues,
} from '@mastra/playground-ui';

import type { UpdateStoredScorerParams } from '@mastra/client-js';

type StoredScorerData = NonNullable<ReturnType<typeof useStoredScorer>['data']>;

interface CmsScorersEditFormProps {
  scorer: StoredScorerData;
  scorerId: string;
}

function CmsScorersEditForm({ scorer, scorerId }: CmsScorersEditFormProps) {
  const { navigate, paths } = useLinkComponent();
  const { updateStoredScorer } = useStoredScorerMutations(scorerId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const initialValues: ScorerFormValues = useMemo(
    () => ({
      name: scorer.name || '',
      description: scorer.description || '',
      type: 'llm-judge' as const, // TODO: Add support for other scorer types
      model: {
        provider: (scorer.model as { provider?: string; name?: string })?.provider || '',
        name: (scorer.model as { provider?: string; name?: string })?.name || '',
      },
      instructions: scorer.instructions || '',
      scoreRange: {
        min: scorer.scoreRange?.min ?? 0,
        max: scorer.scoreRange?.max ?? 1,
      },
      defaultSampling: scorer.defaultSampling,
    }),
    [scorer],
  );

  const { form } = useScorerEditForm({ initialValues });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  const handlePublish = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();
    setIsSubmitting(true);

    try {
      const updateParams: UpdateStoredScorerParams = {
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

      await updateStoredScorer.mutateAsync(updateParams);
      toast.success('Scorer updated successfully');
      navigate(paths.scorerLink(scorerId));
    } catch (error) {
      toast.error(`Failed to update scorer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, updateStoredScorer, navigate, paths, scorerId]);

  return (
    <AgentEditLayout
      leftSlot={
        <ScorerEditSidebar
          form={form}
          onPublish={handlePublish}
          isSubmitting={isSubmitting}
          formRef={formRef}
          mode="edit"
        />
      }
    >
      <form ref={formRef} className="h-full">
        <ScorerEditMain form={form} />
      </form>
    </AgentEditLayout>
  );
}

function CmsScorersEditPage() {
  const { scorerId } = useParams<{ scorerId: string }>();
  const { data: scorer, isLoading } = useStoredScorer(scorerId);

  if (isLoading) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <GaugeIcon />
            </Icon>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
        <AgentEditLayout
          leftSlot={
            <div className="flex items-center justify-center h-full">
              <Spinner className="h-8 w-8" />
            </div>
          }
        >
          <div className="flex items-center justify-center h-full">
            <Spinner className="h-8 w-8" />
          </div>
        </AgentEditLayout>
      </MainContentLayout>
    );
  }

  if (!scorer || !scorerId) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <GaugeIcon />
            </Icon>
            Scorer not found
          </HeaderTitle>
        </Header>
        <AgentEditLayout
          leftSlot={<div className="flex items-center justify-center h-full text-icon3">Scorer not found</div>}
        >
          <div className="flex items-center justify-center h-full text-icon3">Scorer not found</div>
        </AgentEditLayout>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <GaugeIcon />
          </Icon>
          Edit scorer: {scorer.name}
        </HeaderTitle>
      </Header>
      <CmsScorersEditForm scorer={scorer} scorerId={scorerId} />
    </MainContentLayout>
  );
}

export { CmsScorersEditPage };

export default CmsScorersEditPage;
