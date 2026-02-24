import { Fragment, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import {
  Database,
  ArrowLeft,
  HistoryIcon,
  GitCompareIcon,
  ArrowLeftIcon,
  ColumnsIcon,
  GitCompareArrowsIcon,
} from 'lucide-react';
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
  CodeDiff,
  SelectField,
  useLinkComponent,
  Columns,
  Column,
  ButtonsGroup,
  type DatasetItemVersion,
  Chip,
} from '@mastra/playground-ui';
import { cn } from '@/lib/utils';

function versionToText(version: DatasetItemVersion): string {
  return JSON.stringify(
    {
      input: version.input ?? null,
      groundTruth: version.groundTruth ?? null,
      metadata: version.metadata ?? null,
    },
    null,
    2,
  );
}

function DatasetItemVersionsComparePage() {
  const { datasetId, itemId } = useParams<{ datasetId: string; itemId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDiffView, setIsDiffView] = useState<boolean>(false);

  // ?ids=2,5 — direct dataset version numbers
  const versionNumbers =
    searchParams
      .get('ids')
      ?.split(',')
      .map(Number)
      .filter(n => !isNaN(n) && n > 0) ?? [];

  const { data: dataset } = useDataset(datasetId ?? '');
  const { Link: FrameworkLink } = useLinkComponent();
  const { data: allVersions } = useDatasetItemVersions(datasetId ?? '', itemId ?? '');

  const { data: versionA } = useDatasetItemVersion(
    datasetId ?? '',
    itemId ?? '',
    versionNumbers[0] ?? 0,
    dataset?.version,
  );
  const { data: versionB } = useDatasetItemVersion(
    datasetId ?? '',
    itemId ?? '',
    versionNumbers[1] ?? 0,
    dataset?.version,
  );

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
            <Crumb isCurrent as="span">
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
            {dataset?.name}
          </Crumb>
          <Crumb as={Link} to={`/datasets/${datasetId}/items/${itemId}`}>
            Item
          </Crumb>
          <Crumb isCurrent as="span">
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
        <div
          className={cn('grid gap-6 max-w-[140rem] mx-auto grid-rows-[auto_1fr] h-full', {
            'grid-rows-[auto_auto_1fr]': isDiffView,
          })}
        >
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title>
                <GitCompareIcon />
                Compare Dataset Item Versions
              </MainHeader.Title>
              <MainHeader.Description>
                <TextAndIcon>
                  Comparing {versionNumbers.length} versions of{' '}
                  <Link to={`/datasets/${datasetId}/items/${itemId}`} className="text-info1 hover:underline">
                    {itemId}
                  </Link>
                </TextAndIcon>
              </MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column>
              <ButtonsGroup>
                <Button as={Link} to={`/datasets/${datasetId}/items/${itemId}`} variant="standard" size="default">
                  <ArrowLeftIcon />
                  Back to Item
                </Button>
                <Button variant="cta" size="default" onClick={() => setIsDiffView(v => !v)}>
                  {isDiffView ? (
                    <>
                      <ColumnsIcon /> Default View
                    </>
                  ) : (
                    <>
                      <GitCompareArrowsIcon /> Diff View
                    </>
                  )}
                </Button>
              </ButtonsGroup>
            </MainHeader.Column>
          </MainHeader>

          <Columns className="grid-cols-[1fr_3vw_1fr]">
            {versionNumbers.map((datasetVersion, idx) => (
              <Fragment key={datasetVersion}>
                <CompareVersionColumn
                  datasetId={datasetId}
                  itemId={itemId}
                  datasetVersion={datasetVersion}
                  latestVersion={dataset?.version}
                  allVersions={allVersions ?? []}
                  versionNumbers={versionNumbers}
                  Link={FrameworkLink}
                  idx={idx}
                  showContent={!isDiffView}
                  onVersionChange={(newVersion: number) => {
                    const newVersions = [...versionNumbers];
                    newVersions[idx] = newVersion;
                    setSearchParams({ ids: newVersions.join(',') });
                  }}
                />
                {idx === 0 && <div className={cn('bg-surface5 w-[3px] shrink-0 mx-[1.5vw]')} />}
              </Fragment>
            ))}
          </Columns>
          {isDiffView && versionA && versionB && (
            <CodeDiff codeA={versionToText(versionA)} codeB={versionToText(versionB)} />
          )}
        </div>
      </div>
    </MainContentLayout>
  );
}

function CompareVersionColumn({
  datasetId,
  itemId,
  datasetVersion,
  latestVersion,
  allVersions,
  versionNumbers,
  Link,
  idx,
  showContent = true,
  onVersionChange,
}: {
  datasetId: string;
  itemId: string;
  datasetVersion: number;
  latestVersion?: number;
  allVersions: DatasetItemVersion[];
  versionNumbers: number[];
  Link: ReturnType<typeof useLinkComponent>['Link'];
  idx: number;
  showContent?: boolean;
  onVersionChange: (newVersion: number) => void;
}) {
  const { data: version, isLoading } = useDatasetItemVersion(datasetId, itemId, datasetVersion, latestVersion);

  const otherVersionNumbers = new Set(versionNumbers.filter((_, i) => i !== idx));
  const options = allVersions.map(v => {
    const date = typeof v.updatedAt === 'string' ? new Date(v.updatedAt) : v.updatedAt;
    return {
      value: String(v.datasetVersion),
      label: (
        <>
          <b>v. {v.datasetVersion}</b> - {format(date, 'MMM d, yyyy h:mm a')}
          {v.isLatest ? (
            <Chip color="blue" size="small">
              Latest
            </Chip>
          ) : null}
        </>
      ),
      disabled: otherVersionNumbers.has(v.datasetVersion),
    };
  });

  const displayItem = version
    ? {
        id: version.id,
        datasetId,
        datasetVersion: version.datasetVersion,
        input: version.input,
        groundTruth: version.groundTruth,
        metadata: version.metadata,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
      }
    : null;

  return (
    <Column>
      <Column.Toolbar className="grid gap-4 grid-cols-[auto_1fr]">
        <HistoryIcon className="w-6 h-6 opacity-50" />
        <SelectField
          label="Version"
          name={`compare-version-${idx}`}
          value={String(datasetVersion)}
          onValueChange={(val: string) => onVersionChange(Number(val))}
          options={options}
          placeholder="Select version"
          variant="experimental"
          size="default"
          labelIsHidden={true}
          className="w-full"
        />
      </Column.Toolbar>

      {showContent && (
        <Column.Content>
          {isLoading ? (
            <div className="text-neutral4 text-sm">Loading...</div>
          ) : !version || !displayItem ? (
            <div className="text-neutral4 text-sm">Version {datasetVersion} not found</div>
          ) : (
            <DatasetItemContent item={displayItem} Link={Link} />
          )}
        </Column.Content>
      )}
    </Column>
  );
}

export { DatasetItemVersionsComparePage };
export default DatasetItemVersionsComparePage;
