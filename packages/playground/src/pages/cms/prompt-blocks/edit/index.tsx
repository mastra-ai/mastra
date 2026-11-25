import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { AgentEditLayout } from '@/domains/agents/components/agent-edit-page/agent-edit-layout';
import { CmsEditHeaderActions } from '@/domains/cms/components/cms-edit-header-actions';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { navCrumb } from '@/domains/navigation/crumbs';
import {
  useStoredPromptBlock,
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
  const { data: versionsData } = usePromptBlockVersions({
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

  if (isLoading) {
    return (
      <PageLayout variant="page" body="fixed" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{blockId}</h1>
        <BrandLoader fill />
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
      <PromptBlockEditContent
        block={block}
        blockId={blockId}
        selectedVersionId={selectedVersionId}
        hasDraft={hasDraft}
        latestVersionId={latestVersion?.id}
        activeVersionId={activeVersionId}
        onClearVersion={handleClearVersion}
      />
    </PageLayout>
  );
}

export { CmsPromptBlocksEditPage };

export default CmsPromptBlocksEditPage;
