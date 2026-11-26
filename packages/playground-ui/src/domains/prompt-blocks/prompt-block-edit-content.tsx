import type { StoredPromptBlockResponse, UpdateStoredPromptBlockParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { usePromptBlockVersion, useStoredPromptBlockMutations } from '@mastra/react/hooks/prompt-blocks';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AgentEditLayout } from './edit-layout';
import { PromptBlockEditMain } from './prompt-block-edit-page/prompt-block-edit-main';
import { PromptBlockEditSidebar } from './prompt-block-edit-page/prompt-block-edit-sidebar';
import { usePromptBlockEditForm } from './prompt-block-edit-page/use-prompt-block-edit-form';
import type { PromptBlockFormValues } from './prompt-block-edit-page/utils/form-validation';
import { Button } from '@/ds/components/Button';
import { Form } from '@/ds/components/Form';
import { Notice } from '@/ds/components/Notice';
import { IconEyeOpen } from '@/ds/icons/central/IconEyeOpen';
import { IconRocket } from '@/ds/icons/central/IconRocket';
import { useLinkComponent } from '@/lib/framework';
import { toast } from '@/utils/toast';

type StoredPromptBlockData = StoredPromptBlockResponse;

function buildUpdateParams(values: PromptBlockFormValues): UpdateStoredPromptBlockParams {
  return {
    name: values.name,
    description: values.description || undefined,
    content: values.content,
    rules: values.rules || undefined,
    requestContextSchema: (values.variables as Record<string, unknown>) || undefined,
  };
}

export interface PromptBlockEditContentProps {
  block: StoredPromptBlockData;
  blockId: string;
  selectedVersionId: string | null;
  hasDraft: boolean;
  latestVersionId?: string;
  activeVersionId?: string;
  onClearVersion: () => void;
}

export function PromptBlockEditContent({
  block,
  blockId,
  selectedVersionId,
  hasDraft,
  latestVersionId,
  activeVersionId,
  onClearVersion,
}: PromptBlockEditContentProps) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { navigate, paths } = useLinkComponent();
  const { updateStoredPromptBlock } = useStoredPromptBlockMutations({ blockId: blockId });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const { data: versionData } = usePromptBlockVersion({
    blockId,
    versionId: selectedVersionId ?? '',
    queryOptions: { enabled: !!blockId && !!selectedVersionId },
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

  const sourceKey = `${blockId}:${isViewingVersion ? selectedVersionId : 'latest'}`;
  const loadedSourceKey = useRef(sourceKey);

  useEffect(() => {
    // A refetch of the same source keeps unsaved edits; switching block or version replaces them.
    const sameSource = loadedSourceKey.current === sourceKey;
    loadedSourceKey.current = sourceKey;
    form.reset(initialValues, { keepDirtyValues: sameSource });
    setFormResetKey(prev => prev + 1);
  }, [initialValues, form, sourceKey]);

  const handleSaveDraft = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSavingDraft(true);
    try {
      const submitted = form.getValues();
      await updateStoredPromptBlock.mutateAsync(buildUpdateParams(submitted));
      // Only what was sent counts as saved; edits typed during the request stay dirty.
      form.reset(submitted, { keepValues: true });
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
      navigate(paths.promptBlocksLink());
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
        navigate(paths.promptBlocksLink());
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
            <Button icon={<IconEyeOpen />} type="button" variant="default" size="sm" onClick={onClearVersion}>
              View latest version
            </Button>
            <Button
              icon={<IconRocket />}
              type="button"
              variant="default"
              size="sm"
              onClick={handlePublishVersion}
              disabled={selectedVersionId === activeVersionId}
              loading={isSubmitting}
            >
              Publish this version
            </Button>
          </div>
        </Notice>
      )}
      <Form className="h-full">
        <PromptBlockEditMain form={form} formResetKey={formResetKey} />
      </Form>
    </AgentEditLayout>
  );
}
