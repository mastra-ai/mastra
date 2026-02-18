import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useMastraClient } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { GaugeIcon } from 'lucide-react';

import {
  toast,
  useLinkComponent,
  useStoredScorer,
  useStoredScorerMutations,
  useScorerVersions,
  useScorerVersion,
  ScorerEditMain,
  ScorerEditSidebar,
  ScorerVersionCombobox,
  AgentEditLayout,
  useScorerEditForm,
  Header,
  HeaderTitle,
  HeaderAction,
  Icon,
  Spinner,
  MainContentLayout,
  Skeleton,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
  type ScorerFormValues,
} from '@mastra/playground-ui';

import type { UpdateStoredScorerParams } from '@mastra/client-js';

type StoredScorerData = NonNullable<ReturnType<typeof useStoredScorer>['data']>;

function buildUpdateParams(values: ScorerFormValues): UpdateStoredScorerParams {
  return {
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
}

interface CmsScorersEditFormProps {
  scorer: StoredScorerData;
  scorerId: string;
  selectedVersionId: string | null;
}

function CmsScorersEditForm({ scorer, scorerId, selectedVersionId }: CmsScorersEditFormProps) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { navigate, paths } = useLinkComponent();
  const { updateStoredScorer } = useStoredScorerMutations(scorerId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const { data: versionData } = useScorerVersion({
    scorerId,
    versionId: selectedVersionId ?? '',
  });

  const isViewingVersion = !!selectedVersionId && !!versionData;
  const dataSource = isViewingVersion ? versionData : scorer;

  const initialValues: ScorerFormValues = useMemo(
    () => ({
      name: dataSource.name || '',
      description: dataSource.description || '',
      type: 'llm-judge' as const,
      model: {
        provider: (dataSource.model as { provider?: string; name?: string })?.provider || '',
        name: (dataSource.model as { provider?: string; name?: string })?.name || '',
      },
      instructions: dataSource.instructions || '',
      scoreRange: {
        min: dataSource.scoreRange?.min ?? 0,
        max: dataSource.scoreRange?.max ?? 1,
      },
      defaultSampling: dataSource.defaultSampling,
    }),
    [dataSource],
  );

  const { form } = useScorerEditForm({ initialValues });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  const handleSaveDraft = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSavingDraft(true);
    try {
      const params = buildUpdateParams(form.getValues());
      await updateStoredScorer.mutateAsync(params);
      toast.success('Draft saved');
    } catch (error) {
      toast.error(`Failed to save draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingDraft(false);
    }
  }, [form, updateStoredScorer]);

  const handlePublish = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const params = buildUpdateParams(form.getValues());
      await updateStoredScorer.mutateAsync(params);

      // Fetch latest version after save and activate it
      const versionsResponse = await client
        .getStoredScorer(scorerId)
        .listVersions({ sortDirection: 'DESC', perPage: 1 });
      const latestVersion = versionsResponse.versions[0];
      if (latestVersion) {
        await client.getStoredScorer(scorerId).activateVersion(latestVersion.id);
      }

      queryClient.invalidateQueries({ queryKey: ['scorers'] });
      queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      toast.success('Scorer published');
      navigate(paths.scorerLink(scorerId));
    } catch (error) {
      toast.error(`Failed to publish scorer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, updateStoredScorer, client, scorerId, navigate, paths, queryClient]);

  return (
    <AgentEditLayout
      leftSlot={
        <ScorerEditSidebar
          form={form}
          onPublish={handlePublish}
          onSaveDraft={handleSaveDraft}
          isSubmitting={isSubmitting}
          isSavingDraft={isSavingDraft}
          formRef={formRef}
          mode="edit"
        />
      }
    >
      {isViewingVersion && (
        <Alert variant="info" className="m-4 mb-0">
          <AlertTitle>This is a previous version</AlertTitle>
          <AlertDescription as="p">You are seeing a specific version of the scorer.</AlertDescription>
        </Alert>
      )}
      <form ref={formRef} className="h-full">
        <ScorerEditMain form={form} />
      </form>
    </AgentEditLayout>
  );
}

function CmsScorersEditPage() {
  const { scorerId } = useParams<{ scorerId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get('versionId');

  const { data: scorer, isLoading } = useStoredScorer(scorerId, { status: 'draft' });
  const { data: versionsData } = useScorerVersions({
    scorerId: scorerId ?? '',
    params: { sortDirection: 'DESC' },
  });

  const activeVersionId = scorer?.activeVersionId;
  const latestVersion = versionsData?.versions?.[0];
  const hasDraft = !!(latestVersion && activeVersionId && latestVersion.id !== activeVersionId);

  const handleVersionSelect = useCallback(
    (versionId: string) => {
      if (versionId) {
        setSearchParams({ versionId });
      } else {
        setSearchParams({});
      }
    },
    [setSearchParams],
  );

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
          leftSlot={<div className="flex items-center justify-center h-full text-neutral3">Scorer not found</div>}
        >
          <div className="flex items-center justify-center h-full text-neutral3">Scorer not found</div>
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
          {hasDraft && <Badge variant="info">Unpublished changes</Badge>}
        </HeaderTitle>
        <HeaderAction>
          <ScorerVersionCombobox
            scorerId={scorerId}
            value={selectedVersionId ?? ''}
            onValueChange={handleVersionSelect}
            variant="outline"
            activeVersionId={activeVersionId}
          />
        </HeaderAction>
      </Header>
      <CmsScorersEditForm scorer={scorer} scorerId={scorerId} selectedVersionId={selectedVersionId} />
    </MainContentLayout>
  );
}

export { CmsScorersEditPage };

export default CmsScorersEditPage;
