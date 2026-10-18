import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { ScorerCreateContent } from '@/domains/scores/components/scorer-create-content';

const crumbs = [navCrumb('/scorers'), { id: 'create-scorer', label: 'Create scorer' }];

function CmsScorersCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Create scorer</h1>
      <ScorerCreateContent onSuccess={scorer => navigate(paths.scorerLink(scorer.id))} />
    </PageLayout>
  );
}

export { CmsScorersCreatePage };

export default CmsScorersCreatePage;
