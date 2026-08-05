import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { PromptBlockCreateContent } from '@/domains/prompt-blocks';
import { useLinkComponent } from '@/lib/framework';

function CmsPromptBlocksCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <MainContentLayout className="grid-rows-[1fr]">
      <PromptBlockCreateContent onSuccess={block => navigate(paths.cmsPromptBlockEditLink(block.id))} />
    </MainContentLayout>
  );
}

export { CmsPromptBlocksCreatePage };

export default CmsPromptBlocksCreatePage;
