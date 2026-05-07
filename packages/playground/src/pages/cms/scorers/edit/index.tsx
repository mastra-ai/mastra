import type { UpdateStoredScorerParams } from '@mastra/client-js';
import {
  Notice,
  Badge,
  Button,
  Header,
  HeaderAction,
  HeaderTitle,
  Icon,
  MainContentLayout,
  Skeleton,
  Spinner,
  toast,
} from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { GaugeIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { AgentEditLayout } from '@/domains/agents/components/agent-edit-page/agent-edit-layout';
import { useStoredScorer, useStoredScorerMutations } from '@/domains/scores';
import { ScorerEditMain } from '@/domains/scores/components/scorer-edit-page/scorer-edit-main';
import { ScorerEditSidebar } from '@/domains/scores/components/scorer-edit-page/scorer-edit-sidebar';
import { useScorerEditForm } from '@/domains/scores/components/scorer-edit-page/use-scorer-edit-form';
import type { ScorerFormValues } from '@/domains/scores/components/scorer-edit-page/utils/form-validation';
import { ScorerVersionCombobox } from '@/domains/scores/components/scorer-version-combobox';
import { useScorerVersions, useScorerVersion } from '@/domains/scores/hooks/use-scorer-versions';
import { useLinkComponent } from '@/lib/framework';

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
  latestVersionId?: string;
  activeVersionId?: string;
  onClearVersion: () => void;
}

function CmsScorersEditForm({
  scorer,
  scorerId,
  selectedVersionId,
  latestVersionId,
  activeVersionId,
  onClearVersion,
}: CmsScorersEditFormProps) {
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
  const isViewingPreviousVersion = isViewingVersion && selectedVersionId !== latestVersionId;
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

      void queryClient.invalidateQueries({ queryKey: ['scorers'] });
      void queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      toast.success('Scorer published');
      void navigate(paths.scorerLink(scorerId));
    } catch (error) {
      toast.error(`Failed to publish scorer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, updateStoredScorer, client, scorerId, navigate, paths, queryClient]);

  const handlePublishVersion = useCallback(async () => {
    if (isViewingPreviousVersion && selectedVersionId) {
      setIsSubmitting(true);
      try {
        await client.getStoredScorer(scorerId).activateVersion(selectedVersionId);
        void queryClient.invalidateQueries({ queryKey: ['scorers'] });
        void queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
        void queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
        toast.success('Version published');
        void navigate(paths.scorerLink(scorerId));
      } catch (error) {
        toast.error(`Failed to publish version: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      await handlePublish();
    }
  }, [handlePublish, isViewingPreviousVersion, selectedVersionId, client, scorerId, queryClient, navigate, paths]);

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
      {isViewingPreviousVersion && (
        <Notice variant="info" title="This is a previous version" className="m-4 mb-0">
          <Notice.Message>You are seeing a specific version of the scorer.</Notice.Message>
          <div className="flex gap-2">
            <Button type="button" variant="default" size="sm" onClick={onClearVersion}>
              View latest version
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handlePublishVersion}
              disabled={selectedVersionId === activeVersionId || isSubmitting}
            >
              {isSubmitting ? 'Publishing...' : 'Publish This Version'}
            </Button>
          </div>
        </Notice>
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

  const handleClearVersion = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

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
      <CmsScorersEditForm
        scorer={scorer}
        scorerId={scorerId}
        selectedVersionId={selectedVersionId}
        latestVersionId={latestVersion?.id}
        activeVersionId={activeVersionId}
        onClearVersion={handleClearVersion}
      />
    </MainContentLayout>
  );
}

export { CmsScorersEditPage };

export default CmsScorersEditPage;
