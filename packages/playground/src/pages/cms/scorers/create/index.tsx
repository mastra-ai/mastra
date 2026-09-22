import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { ScorerCreateContent } from '@/domains/scores/components/scorer-create-content';
import { useLinkComponent } from '@/lib/framework';

const crumbs = [navCrumb('/scorers'), { id: 'create-scorer', label: 'Create scorer' }];

function CmsScorersCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <ScorerCreateContent onSuccess={scorer => navigate(paths.scorerLink(scorer.id))} />
    </PageLayout>
  );
}

export { CmsScorersCreatePage };

export default CmsScorersCreatePage;
