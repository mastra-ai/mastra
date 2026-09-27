import { Button } from '@mastra/playground-ui/components/Button';
import { Column, Columns } from '@mastra/playground-ui/components/Columns';
import { MainHeader } from '@mastra/playground-ui/components/MainHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useDataset } from '@mastra/playground-ui/domains/datasets';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeft, ScaleIcon, HistoryIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { DatasetCompareVersionToolbar, DatasetCompareVersionsList } from '@/domains/datasets';
import { useDatasetItems } from '@/domains/datasets/hooks/use-dataset-items';
import { datasetCrumb, navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/datasets'), datasetCrumb, { id: 'dataset-versions', label: 'Versions' }];

function DatasetCompareVersionsPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const versionNumbers =
    searchParams
      .get('ids')
      ?.split(',')
      .map(Number)
      .filter(n => !isNaN(n) && n > 0) ?? [];
  const navigate = useNavigate();
  const { data: dataset, error } = useDataset(datasetId ?? '');

  const versionA = useDatasetItems(datasetId ?? '', undefined, versionNumbers[0] ?? null);
  const versionB = useDatasetItems(datasetId ?? '', undefined, versionNumbers[1] ?? null);

  const itemsA = useMemo(() => versionA.data ?? [], [versionA.data]);
  const itemsB = useMemo(() => versionB.data ?? [], [versionB.data]);

  // Merged items ordered by createdAt (union of both versions, deduplicated)
  const allItems = useMemo(() => {
    const seen = new Map<string, { id: string; createdAt: Date }>();
    for (const item of [...itemsA, ...itemsB]) {
      if (!seen.has(item.id)) {
        seen.set(item.id, { id: item.id, createdAt: new Date(item.createdAt) });
      }
    }
    return [...seen.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [itemsA, itemsB]);

  // Lookup maps to resolve each item's version in A and B
  const itemsAMap = useMemo(() => new Map(itemsA.map(i => [i.id, i])), [itemsA]);
  const itemsBMap = useMemo(() => new Map(itemsB.map(i => [i.id, i])), [itemsB]);

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Versions</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Versions</h1>
        <PermissionDenied variant="fill" resource="datasets" />
      </PageLayout>
    );
  }

  if (!datasetId || versionNumbers.length < 2) {
    return (
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Versions</h1>
        <div className="grid h-full min-w-min content-start items-start overflow-x-auto overflow-y-auto">
          <div className="py-5 text-center text-muted-foreground">
            <p>Select at least two versions to compare.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  const handleVersionChange = (newA: string, newB: string) => {
    void navigate(`/datasets/${datasetId}/versions?ids=${newA},${newB}`, {
      replace: true,
    });
  };

  return (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Versions</h1>
      <div className="h-full overflow-hidden px-[3vw] pb-4">
        <div className="mx-auto grid h-full max-w-[140rem] grid-rows-[auto_1fr] gap-4">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title>
                <ScaleIcon /> Compare Dataset Versions
              </MainHeader.Title>
              <MainHeader.Description>
                <TextAndIcon>
                  <HistoryIcon /> Comparing {versionNumbers.length} versions of{' '}
                  {dataset?.name || datasetId?.slice(0, 8)}
                </TextAndIcon>
              </MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column>
              <Button render={<Link to={`/datasets/${datasetId}`} />} icon={<ArrowLeft />}>
                Back to Dataset
              </Button>
            </MainHeader.Column>
          </MainHeader>

          <Columns>
            <Column>
              <DatasetCompareVersionToolbar
                datasetId={datasetId}
                versionA={String(versionNumbers[0])}
                versionB={String(versionNumbers[1])}
                onVersionChange={handleVersionChange}
              />
              <DatasetCompareVersionsList
                datasetId={datasetId}
                versionA={versionNumbers[0]}
                versionB={versionNumbers[1]}
                allItems={allItems}
                itemsAMap={itemsAMap}
                itemsBMap={itemsBMap}
              />
            </Column>
          </Columns>
        </div>
      </div>
    </PageLayout>
  );
}

export { DatasetCompareVersionsPage };
export default DatasetCompareVersionsPage;
