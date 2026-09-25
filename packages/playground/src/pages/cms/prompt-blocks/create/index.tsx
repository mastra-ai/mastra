import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { PromptBlockCreateContent } from '@/domains/prompt-blocks';

const crumbs = [navCrumb('/prompts'), { id: 'create-prompt-block', label: 'Create prompt block' }];

function CmsPromptBlocksCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Create prompt block</h1>
      <PromptBlockCreateContent onSuccess={block => navigate(paths.cmsPromptBlockEditLink(block.id))} />
    </PageLayout>
  );
}

export { CmsPromptBlocksCreatePage };

export default CmsPromptBlocksCreatePage;
