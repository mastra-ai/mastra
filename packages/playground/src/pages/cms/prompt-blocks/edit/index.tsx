import type { UpdateStoredPromptBlockParams } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMastraClient } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { AgentEditLayout } from '@/domains/agents/components/agent-edit-page/agent-edit-layout';
import type { PromptBlockFormValues } from '@/domains/prompt-blocks';
import {
  useStoredPromptBlock,
  useStoredPromptBlockMutations,
  usePromptBlockVersions,
  usePromptBlockVersion,
  PromptBlockEditMain,
  PromptBlockEditSidebar,
  PromptBlockVersionCombobox,
  usePromptBlockEditForm,
} from '@/domains/prompt-blocks';
import { useLinkComponent } from '@/lib/framework';
import { RouteHeaderActions } from '@/lib/route-header';

type StoredPromptBlockData = NonNullable<ReturnType<typeof useStoredPromptBlock>['data']>;

function buildUpdateParams(values: PromptBlockFormValues): UpdateStoredPromptBlockParams {
  return {
    name: values.name,
    description: values.description || undefined,
    content: values.content,
    rules: values.rules || undefined,
    requestContextSchema: (values.variables as Record<string, unknown>) || undefined,
  };
}

interface CmsPromptBlocksEditFormProps {
  block: StoredPromptBlockData;
  blockId: string;
  selectedVersionId: string | null;
  hasDraft: boolean;
  latestVersionId?: string;
  activeVersionId?: string;
  onClearVersion: () => void;
}

function CmsPromptBlocksEditForm({
  block,
  blockId,
  selectedVersionId,
  hasDraft,
  latestVersionId,
  activeVersionId,
  onClearVersion,
}: CmsPromptBlocksEditFormProps) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { navigate, paths } = useLinkComponent();
  const { updateStoredPromptBlock } = useStoredPromptBlockMutations(blockId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const { data: versionData } = usePromptBlockVersion({
    blockId,
    versionId: selectedVersionId ?? '',
  });

  const isViewingVersion = !!selectedVersionId && !!versionData;
  const isViewingPreviousVersion = isViewingVersion && selectedVersionId !== latestVersionId;
  const dataSource = isViewingVersion ? versionData : block;

  const initialValues: PromptBlockFormValues = useMemo(
    () => ({
      name: dataSource.name || '',
      description: dataSource.description || '',
      content: dataSource.content || '',
      rules: dataSource.rules,
      variables: dataSource.requestContextSchema as PromptBlockFormValues['variables'],
    }),
    [dataSource],
  );

  const { form } = usePromptBlockEditForm({ initialValues });
  const [formResetKey, setFormResetKey] = useState(0);

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
      setFormResetKey(prev => prev + 1);
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
      await updateStoredPromptBlock.mutateAsync(params);
      form.reset(form.getValues());
      toast.success('Draft saved');
    } catch (error) {
      toast.error(`Failed to save draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingDraft(false);
    }
  }, [form, updateStoredPromptBlock]);

  const handlePublish = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const params = buildUpdateParams(form.getValues());
      await updateStoredPromptBlock.mutateAsync(params);

      // Fetch latest version after save and activate it
      const versionsResponse = await client
        .getStoredPromptBlock(blockId)
        .listVersions({ orderBy: { direction: 'DESC' }, perPage: 1 });
      const latestVersion = versionsResponse.versions[0];
      if (!latestVersion) {
        throw new Error('No version found to publish');
      }
      await client.getStoredPromptBlock(blockId).activateVersion(latestVersion.id);

      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block'] });
      void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      toast.success('Prompt block published');
      void navigate(paths.promptBlocksLink());
    } catch (error) {
      toast.error(`Failed to publish: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, updateStoredPromptBlock, client, blockId, navigate, paths, queryClient]);

  const handlePublishVersion = useCallback(async () => {
    if (isViewingPreviousVersion && selectedVersionId) {
      setIsSubmitting(true);
      try {
        await client.getStoredPromptBlock(blockId).activateVersion(selectedVersionId);
        void queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
        void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block'] });
        void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
        toast.success('Version published');
        void navigate(paths.promptBlocksLink());
      } catch (error) {
        toast.error(`Failed to publish version: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      await handlePublish();
    }
  }, [handlePublish, isViewingPreviousVersion, selectedVersionId, client, blockId, queryClient, navigate, paths]);

  return (
    <AgentEditLayout
      leftSlot={
        <PromptBlockEditSidebar
          form={form}
          onPublish={handlePublish}
          onSaveDraft={handleSaveDraft}
          isSubmitting={isSubmitting}
          isSavingDraft={isSavingDraft}
          isDirty={form.formState.isDirty}
          hasDraft={hasDraft}
          formResetKey={formResetKey}
          mode="edit"
          blockId={blockId}
        />
      }
    >
      {isViewingPreviousVersion && (
        <Notice variant="info" title="This is a previous version" className="m-4 mb-0">
          <Notice.Message>You are seeing a specific version of the prompt block.</Notice.Message>
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
      <form className="h-full">
        <PromptBlockEditMain form={form} formResetKey={formResetKey} />
      </form>
    </AgentEditLayout>
  );
}

function CmsPromptBlocksEditPage() {
  const { promptBlockId: blockId } = useParams<{ promptBlockId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get('versionId');

  const { data: block, isLoading } = useStoredPromptBlock(blockId, { status: 'draft' });
  const { data: versionsData } = usePromptBlockVersions({
    blockId: blockId ?? '',
    params: { orderBy: { direction: 'DESC' } },
  });

  const activeVersionId = block?.activeVersionId;
  const latestVersion = versionsData?.versions?.[0];
  const hasDraft = !!(latestVersion && (!activeVersionId || latestVersion.id !== activeVersionId));

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
      <MainContentLayout className="grid-rows-[1fr]">
        <AgentEditLayout
          leftSlot={
            <div className="flex h-full items-center justify-center">
              <Spinner className="size-8" />
            </div>
          }
        >
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-8" />
          </div>
        </AgentEditLayout>
      </MainContentLayout>
    );
  }

  if (!block || !blockId) {
    return (
      <MainContentLayout className="grid-rows-[1fr]">
        <AgentEditLayout
          leftSlot={<div className="text-neutral3 flex h-full items-center justify-center">Prompt block not found</div>}
        >
          <div className="text-neutral3 flex h-full items-center justify-center">Prompt block not found</div>
        </AgentEditLayout>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout className="grid-rows-[1fr]">
      <RouteHeaderActions owner="cms-prompt-block-edit">
        <div className="flex items-center gap-2">
          {hasDraft && <Badge variant="info">Unpublished changes</Badge>}
          <PromptBlockVersionCombobox
            blockId={blockId}
            value={selectedVersionId ?? ''}
            onValueChange={handleVersionSelect}
            variant="ghost"
            activeVersionId={activeVersionId}
          />
        </div>
      </RouteHeaderActions>
      <CmsPromptBlocksEditForm
        block={block}
        blockId={blockId}
        selectedVersionId={selectedVersionId}
        hasDraft={hasDraft}
        latestVersionId={latestVersion?.id}
        activeVersionId={activeVersionId}
        onClearVersion={handleClearVersion}
      />
    </MainContentLayout>
  );
}

export { CmsPromptBlocksEditPage };

export default CmsPromptBlocksEditPage;
