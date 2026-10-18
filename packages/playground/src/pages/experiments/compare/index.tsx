import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { CompareCrumb, CompareCrumbSwitcher } from './compare-crumb';
import { CompareDatasetBadge } from './compare-dataset-badge';
import { CompareExperimentsBody } from './compare-experiments-body';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [
  navCrumb('/experiments'),
  { id: 'experiments-compare', Component: CompareCrumb, Switcher: CompareCrumbSwitcher },
];

function CompareExperimentsPage() {
  return (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} headerActions={<CompareDatasetBadge />}>
      <CompareExperimentsBody />
    </PageLayout>
  );
}

export { CompareExperimentsPage };
export default CompareExperimentsPage;
