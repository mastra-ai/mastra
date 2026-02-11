import { useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import { Database, ScaleIcon, ArrowLeft, FileCodeIcon, HistoryIcon } from 'lucide-react';
import { format } from 'date-fns';
import {
  Header,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  HeaderAction,
  Breadcrumb,
  Crumb,
  MainHeader,
  TextAndIcon,
  useDataset,
  useDatasetItemVersion,
  useDatasetItemVersions,
  DatasetItemContent,
  useLinkComponent,
  Columns,
  Column,
  type DatasetItemVersion,
} from '@mastra/playground-ui';

/**
 * Resolve dataset version timestamps to item version numbers.
 * Used when navigating from the dataset versions compare page (dvs param).
 */
function useResolveDatasetVersions(datasetId: string, itemId: string, datasetVersionTimestamps: string[]) {
  const { data: allVersions } = useDatasetItemVersions(datasetId, itemId);

  return useMemo(() => {
    if (!allVersions || datasetVersionTimestamps.length === 0) return [];

    return datasetVersionTimestamps
      .map(ts => {
        const tsTime = new Date(ts).getTime();
        const match = allVersions.find(v => {
          const vTime =
            typeof v.datasetVersion === 'string' ? new Date(v.datasetVersion).getTime() : v.datasetVersion.getTime();
          return vTime === tsTime;
        });
        return match?.versionNumber ?? 0;
      })
      .filter(n => n > 0);
  }, [allVersions, datasetVersionTimestamps]);
}

function DatasetCompareVersions() {
  const { datasetId, itemId } = useParams<{ datasetId: string; itemId: string }>();
  const [searchParams] = useSearchParams();

  // Support two URL formats:
  // ?ids=2,1 — direct version numbers (from item versions panel)
  // ?dvs=ts1,ts2 — dataset version timestamps (from dataset versions compare page)
  const directVersionNumbers =
    searchParams
      .get('ids')
      ?.split(',')
      .map(Number)
      .filter(n => !isNaN(n) && n > 0) ?? [];

  const datasetVersionTimestamps = searchParams.get('dvs')?.split(',').map(decodeURIComponent).filter(Boolean) ?? [];

  const resolvedVersionNumbers = useResolveDatasetVersions(datasetId ?? '', itemId ?? '', datasetVersionTimestamps);

  const versionNumbers = directVersionNumbers.length > 0 ? directVersionNumbers : resolvedVersionNumbers;

  const { data: dataset } = useDataset(datasetId ?? '');
  const { Link: FrameworkLink } = useLinkComponent();

  if (!datasetId || !itemId || versionNumbers.length < 2) {
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
          <Crumb as={Link} to={`/datasets/${datasetId}/items/${itemId}`}>
            <Icon>
              <FileCodeIcon />
            </Icon>
            Item
          </Crumb>
          <Crumb isCurrent>
            <Icon>
              <ScaleIcon />
            </Icon>
            Compare Versions
          </Crumb>
        </Breadcrumb>
        <HeaderAction>
          <Button as={Link} to={`/datasets/${datasetId}/items/${itemId}`} variant="outline">
            <Icon>
              <ArrowLeft />
            </Icon>
            Back to Item
          </Button>
        </HeaderAction>
      </Header>

      <div className="h-full overflow-hidden px-[3vw] pb-4">
        <div className="grid gap-6 max-w-[140rem] mx-auto grid-rows-[auto_1fr] h-full">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title>
                <ScaleIcon />
                Compare Versions
              </MainHeader.Title>
              <MainHeader.Description>
                <TextAndIcon>
                  <HistoryIcon /> Comparing {versionNumbers.length} versions of item {itemId?.slice(0, 8)}
                </TextAndIcon>
              </MainHeader.Description>
            </MainHeader.Column>
          </MainHeader>

          <Columns className="grid-cols-2">
            {versionNumbers.map((versionNumber, idx) => (
              <CompareVersionColumn
                key={versionNumber}
                datasetId={datasetId}
                itemId={itemId}
                versionNumber={versionNumber}
                Link={FrameworkLink}
                idx={idx}
              />
            ))}
          </Columns>
        </div>
      </div>
    </MainContentLayout>
  );
}

function CompareVersionColumn({
  datasetId,
  itemId,
  versionNumber,
  Link,
  idx,
}: {
  datasetId: string;
  itemId: string;
  versionNumber: number;
  Link: ReturnType<typeof useLinkComponent>['Link'];
  idx: number;
}) {
  const { data: version, isLoading } = useDatasetItemVersion(datasetId, itemId, versionNumber);

  if (isLoading) {
    return <div className="text-neutral4 text-sm">Loading...</div>;
  }

  if (!version) {
    return <div className="text-neutral4 text-sm">Version {versionNumber} not found</div>;
  }

  const displayItem = {
    id: itemId,
    datasetId,
    input: version.snapshot.input,
    groundTruth: version.snapshot.groundTruth,
    metadata: version.snapshot.metadata,
    createdAt: version.createdAt,
    version: version.datasetVersion,
  };

  return (
    <Column withLeftSeparator={idx > 0}>
      <VersionHeader version={version} />
      <DatasetItemContent item={displayItem} Link={Link} />
    </Column>
  );
}

function VersionHeader({ version }: { version: DatasetItemVersion }) {
  const versionDate =
    typeof version.datasetVersion === 'string' ? new Date(version.datasetVersion) : version.datasetVersion;

  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-border1">
      <div className="flex items-center gap-2 text-ui-md text-neutral1">
        <HistoryIcon className="w-4 h-4 text-neutral4" />
        Version {version.versionNumber}
      </div>
      <span className="text-ui-sm text-neutral4">{format(versionDate, "MMM d, yyyy 'at' h:mm a")}</span>
      {version.isLatest && <span className="text-ui-xs bg-neutral6 text-neutral2 px-2 py-0.5 rounded">latest</span>}
      {version.isDeleted && <span className="text-ui-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">deleted</span>}
    </div>
  );
}

export { DatasetCompareVersions };
export default DatasetCompareVersions;
