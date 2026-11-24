import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { AgentEditLayout } from '@/domains/agents/components/agent-edit-page/agent-edit-layout';
import { CmsEditHeaderActions } from '@/domains/cms/components/cms-edit-header-actions';
import { VersionHistoryPanel } from '@/domains/cms/components/version-history-panel';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { readVersionTags } from '@/domains/cms/utils/version-tags';
import type { VersionTags } from '@/domains/cms/utils/version-tags';
import { navCrumb } from '@/domains/navigation/crumbs';
import {
  useStoredPromptBlock,
  useStoredPromptBlockMutations,
  usePromptBlockVersions,
  PromptBlockVersionCombobox,
  DeletePromptBlockAction,
  PromptBlockEditContent,
} from '@/domains/prompt-blocks';
import { PromptBlockCrumb } from '@/domains/prompt-blocks/prompt-block-crumb';

const crumbs = [navCrumb('/prompts'), { id: 'prompt-block', Component: PromptBlockCrumb }];

function CmsPromptBlocksEditPage() {
  const { promptBlockId: blockId } = useParams<{ promptBlockId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get('versionId');

  const { isCmsAvailable } = useIsCmsAvailable();
  const { data: block, isLoading } = useStoredPromptBlock({
    blockId: blockId,
    status: 'draft',
    queryOptions: { enabled: Boolean(blockId) },
  });
  const { data: versionsData, isLoading: isLoadingVersions } = usePromptBlockVersions({
    blockId: blockId ?? '',
    params: { orderBy: { direction: 'DESC' } },
    queryOptions: { enabled: !!blockId },
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

  // Tags are a name → version ID map on the prompt block's metadata; saving them creates no version.
  const versionTags = useMemo(() => readVersionTags(block?.metadata), [block?.metadata]);
  const { updateStoredPromptBlock } = useStoredPromptBlockMutations({ blockId });
  const { mutate: saveVersionTags, isPending: isUpdatingVersionTags } = updateStoredPromptBlock;
  const handleVersionTagsChange = useCallback(
    (nextVersionTags: VersionTags) => {
      saveVersionTags(
        { metadata: { versionTags: nextVersionTags } },
        {
          onError: error => {
            toast.error(error instanceof Error ? error.message : 'Failed to update version tags');
          },
        },
      );
    },
    [saveVersionTags],
  );

  if (isLoading) {
    return (
      <PageLayout variant="page" body="fixed" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{blockId}</h1>
        <AgentEditLayout leftSlot={<Spinner fill size="lg" />}>
          <Spinner fill size="lg" />
        </AgentEditLayout>
      </PageLayout>
    );
  }

  if (!block || !blockId) {
    return (
      <PageLayout variant="page" body="fixed" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{blockId}</h1>
        <AgentEditLayout leftSlot={<EmptyState variant="fill" titleSlot="Prompt block not found" />}>
          <EmptyState variant="fill" titleSlot="Prompt block not found" />
        </AgentEditLayout>
      </PageLayout>
    );
  }

  const actions = (
    <CmsEditHeaderActions hasDraft={hasDraft}>
      <PromptBlockVersionCombobox
        blockId={blockId}
        value={selectedVersionId ?? ''}
        onValueChange={handleVersionSelect}
        variant="ghost"
        activeVersionId={activeVersionId}
      />
      {isCmsAvailable && <DeletePromptBlockAction blockId={blockId} blockName={block.name} />}
    </CmsEditHeaderActions>
  );

  return (
    <PageLayout variant="page" body="fixed" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} headerActions={actions}>
      <h1 className="sr-only">{blockId}</h1>
      {/* The editor's two columns need the full width below `xl`, so there it keeps the whole
          viewport and the version history sits under it, one scroll down. */}
      <div className="grid h-full grid-cols-1 grid-rows-[100%_auto] overflow-y-auto xl:grid-cols-[1fr_240px] xl:grid-rows-1">
        <div className="h-full min-w-0 overflow-hidden">
          <PromptBlockEditContent
            block={block}
            blockId={blockId}
            selectedVersionId={selectedVersionId}
            hasDraft={hasDraft}
            latestVersionId={latestVersion?.id}
            activeVersionId={activeVersionId}
            onClearVersion={handleClearVersion}
          />
        </div>
        <div className="border-t border-border xl:h-full xl:overflow-y-auto xl:border-t-0 xl:border-l">
          <VersionHistoryPanel
            versions={versionsData?.versions ?? []}
            isLoading={isLoadingVersions}
            selectedVersionId={selectedVersionId ?? undefined}
            onVersionSelect={handleVersionSelect}
            activeVersionId={activeVersionId}
            versionTags={versionTags}
            onVersionTagsChange={isCmsAvailable ? handleVersionTagsChange : undefined}
            isUpdatingVersionTags={isUpdatingVersionTags}
          />
        </div>
      </div>
    </PageLayout>
  );
}

export { CmsPromptBlocksEditPage };

export default CmsPromptBlocksEditPage;
