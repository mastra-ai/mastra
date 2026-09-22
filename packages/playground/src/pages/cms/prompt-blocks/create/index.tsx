import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { PromptBlockCreateContent } from '@/domains/prompt-blocks';
import { useLinkComponent } from '@/lib/framework';

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
