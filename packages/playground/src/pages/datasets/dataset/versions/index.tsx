import { Button } from '@mastra/playground-ui/components/Button';
import { Column, Columns } from '@mastra/playground-ui/components/Columns';
import { MainContentContent, MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { MainHeader } from '@mastra/playground-ui/components/MainHeader';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeft, ScaleIcon, HistoryIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { DatasetCompareVersionToolbar, DatasetCompareVersionsList } from '@/domains/datasets';
import { useDatasetItems } from '@/domains/datasets/hooks/use-dataset-items';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';

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
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </MainContentLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="datasets" />
        </div>
      </MainContentLayout>
    );
  }

  if (!datasetId || versionNumbers.length < 2) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral4 py-8 text-center">
            <p>Select at least two versions to compare.</p>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  const handleItemClick = (itemId: string, itemA?: { datasetVersion: number }, itemB?: { datasetVersion: number }) => {
    void navigate(
      `/datasets/${datasetId}/items/${itemId}/versions?ids=${itemA?.datasetVersion ?? ''},${itemB?.datasetVersion ?? ''}`,
    );
  };

  const handleVersionChange = (newA: string, newB: string) => {
    void navigate(`/datasets/${datasetId}/versions?ids=${newA},${newB}`, {
      replace: true,
    });
  };

  return (
    <MainContentLayout>
      <div className="h-full overflow-hidden px-[3vw] pb-4">
        <div className="mx-auto grid h-full max-w-[140rem] grid-rows-[auto_1fr] gap-6">
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
              <Button as={Link} to={`/datasets/${datasetId}`}>
                <ArrowLeft />
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
                onItemClick={handleItemClick}
              />
            </Column>
          </Columns>
        </div>
      </div>
    </MainContentLayout>
  );
}

export { DatasetCompareVersionsPage };
export default DatasetCompareVersionsPage;
