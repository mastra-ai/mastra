import type { UpdateStoredPromptBlockParams } from '@mastra/client-js';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
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
import { BookIcon } from 'lucide-react';
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
}

function CmsPromptBlocksEditForm({ block, blockId, selectedVersionId, hasDraft }: CmsPromptBlocksEditFormProps) {
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
    if (initialValues && !form.formState.isDirty) {
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
        .listVersions({ sortDirection: 'DESC', perPage: 1 });
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
      {isViewingVersion && (
        <Alert variant="info" className="m-4 mb-0">
          <AlertTitle>This is a previous version</AlertTitle>
          <AlertDescription as="p">You are seeing a specific version of the prompt block.</AlertDescription>
        </Alert>
      )}
      <form className="h-full">
        <PromptBlockEditMain form={form} />
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
    params: { sortDirection: 'DESC' },
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

  if (isLoading) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <BookIcon />
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

  if (!block || !blockId) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <BookIcon />
            </Icon>
            Prompt block not found
          </HeaderTitle>
        </Header>
        <AgentEditLayout
          leftSlot={<div className="flex items-center justify-center h-full text-neutral3">Prompt block not found</div>}
        >
          <div className="flex items-center justify-center h-full text-neutral3">Prompt block not found</div>
        </AgentEditLayout>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <BookIcon />
          </Icon>
          Edit prompt block: {block.name}
          {hasDraft && <Badge variant="info">Unpublished changes</Badge>}
        </HeaderTitle>
        <HeaderAction>
          <PromptBlockVersionCombobox
            blockId={blockId}
            value={selectedVersionId ?? ''}
            onValueChange={handleVersionSelect}
            activeVersionId={activeVersionId}
          />
        </HeaderAction>
      </Header>
      <CmsPromptBlocksEditForm
        block={block}
        blockId={blockId}
        selectedVersionId={selectedVersionId}
        hasDraft={hasDraft}
      />
    </MainContentLayout>
  );
}

export { CmsPromptBlocksEditPage };

export default CmsPromptBlocksEditPage;
