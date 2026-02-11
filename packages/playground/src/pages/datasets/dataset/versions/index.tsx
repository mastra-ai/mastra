import { useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { Database, ScaleIcon, HistoryIcon } from 'lucide-react';
import {
  Header,
  MainContentLayout,
  MainContentContent,
  Icon,
  Breadcrumb,
  Crumb,
  MainHeader,
  TextAndIcon,
  useDataset,
  useDatasetItems,
  Columns,
  Column,
  DatasetCompareVersionToolbar,
  DatasetCompareVersionsList,
} from '@mastra/playground-ui';

function DatasetCompareVersionsPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const versionTimestamps = searchParams.get('ids')?.split(',').map(decodeURIComponent).filter(Boolean) ?? [];
  const navigate = useNavigate();
  const { data: dataset } = useDataset(datasetId ?? '');

  const versionA = useDatasetItems(datasetId ?? '', undefined, versionTimestamps[0]);
  const versionB = useDatasetItems(datasetId ?? '', undefined, versionTimestamps[1]);

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

  if (!datasetId || versionTimestamps.length < 2) {
    return (
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to="/datasets">
              <Icon>
                <Database />
              </Icon>
              Datasets
            </Crumb>
            <Crumb isCurrent>
              <Icon>
                <ScaleIcon />
              </Icon>
              Compare Versions
            </Crumb>
          </Breadcrumb>
        </Header>
        <MainContentContent>
          <div className="text-neutral4 text-center py-8">
            <p>Select at least two versions to compare.</p>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  const handleItemClick = (itemId: string, itemA?: { version: string | Date }, itemB?: { version: string | Date }) => {
    navigate(
      `/datasets/${datasetId}/items/${itemId}/versions?dvs=${encodeURIComponent(String(itemA?.version))},${encodeURIComponent(String(itemB?.version))}`,
    );
  };

  const handleVersionChange = (newA: string, newB: string) => {
    navigate(`/datasets/${datasetId}/versions?ids=${encodeURIComponent(newA)},${encodeURIComponent(newB)}`, {
      replace: true,
    });
  };

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to="/datasets">
            <Icon>
              <Database />
            </Icon>
            Datasets
          </Crumb>
          <Crumb as={Link} to={`/datasets/${datasetId}`}>
            {dataset?.name || datasetId?.slice(0, 8)}
          </Crumb>
          <Crumb isCurrent>
            <Icon>
              <ScaleIcon />
            </Icon>
            Compare Versions
          </Crumb>
        </Breadcrumb>
      </Header>

      <div className="h-full overflow-hidden px-[3vw] pb-4">
        <div className="grid gap-6 max-w-[140rem] mx-auto grid-rows-[auto_1fr] h-full">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title>
                <ScaleIcon /> Compare Dataset Versions
              </MainHeader.Title>
              <MainHeader.Description>
                <TextAndIcon>
                  <HistoryIcon /> Comparing {versionTimestamps.length} versions of{' '}
                  {dataset?.name || datasetId?.slice(0, 8)}
                </TextAndIcon>
              </MainHeader.Description>
            </MainHeader.Column>
          </MainHeader>

          <Columns>
            <Column>
              <DatasetCompareVersionToolbar
                datasetId={datasetId}
                versionA={versionTimestamps[0]}
                versionB={versionTimestamps[1]}
                onVersionChange={handleVersionChange}
              />
              <DatasetCompareVersionsList
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
