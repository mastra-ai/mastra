import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { navCrumb } from '@/domains/navigation/crumbs';
import { PromptBlockCreateContent } from '@/domains/prompt-blocks';
import { useLinkComponent } from '@/lib/framework';

const crumbs = [navCrumb('/prompts'), { id: 'create-prompt-block', label: 'Create prompt block' }];

function CmsPromptBlocksCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <MainContentLayout {...pageHeaderProps(crumbs)} className="grid-rows-[1fr]">
      <PromptBlockCreateContent onSuccess={block => navigate(paths.cmsPromptBlockEditLink(block.id))} />
    </MainContentLayout>
  );
}

export { CmsPromptBlocksCreatePage };

export default CmsPromptBlocksCreatePage;
