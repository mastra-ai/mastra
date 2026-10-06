import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { CompareExperimentsBody } from './compare-experiments-body';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/experiments'), { id: 'experiments-compare', label: 'Compare' }];

function CompareExperimentsPage() {
  return (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <CompareExperimentsBody />
    </PageLayout>
  );
}

export { CompareExperimentsPage };
export default CompareExperimentsPage;
