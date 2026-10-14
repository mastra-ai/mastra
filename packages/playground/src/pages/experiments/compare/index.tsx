import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { CompareCrumb, CompareCrumbSwitcher, CompareDatasetCrumb } from './compare-crumb';
import { CompareExperimentsBody } from './compare-experiments-body';
import { useComparedExperimentIds } from './use-compared-experiment-ids';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import type { CrumbDef } from '@/domains/navigation/crumbs';

function CompareExperimentsPage() {
  const { datasetId } = useComparedExperimentIds();
  const crumbs: CrumbDef[] = [
    navCrumb('/experiments'),
    ...(datasetId
      ? [{ id: 'compare-dataset', node: <CompareDatasetCrumb datasetId={datasetId} />, to: `/datasets/${datasetId}` }]
      : []),
    { id: 'experiments-compare', Component: CompareCrumb, Switcher: CompareCrumbSwitcher },
  ];

  return (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <CompareExperimentsBody />
    </PageLayout>
  );
}

export { CompareExperimentsPage };
export default CompareExperimentsPage;
