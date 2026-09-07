import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { CodeDiff } from '@mastra/playground-ui/components/CodeDiff';
import { Column, Columns } from '@mastra/playground-ui/components/Columns';
import { MainContentContent, MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { MainHeader } from '@mastra/playground-ui/components/MainHeader';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { format } from 'date-fns';
import { ArrowLeft, HistoryIcon, GitCompareIcon, ColumnsIcon, GitCompareArrowsIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import { DatasetItemContent, DatasetItemVersionsPanel } from '@/domains/datasets';
import { useDatasetItemVersion, useDatasetItemVersions } from '@/domains/datasets/hooks/use-dataset-item-versions';
import type { DatasetItemVersion } from '@/domains/datasets/hooks/use-dataset-item-versions';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { useLinkComponent } from '@/lib/framework';
import { RouteHeaderActions } from '@/lib/route-header';
import { cn } from '@/lib/utils';

function versionToText(version: DatasetItemVersion): string {
  return JSON.stringify(
    {
      input: version.input ?? null,
      groundTruth: version.groundTruth ?? null,
      scorerIds: version.scorerIds ?? null,
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

  const { data: dataset, error } = useDataset(datasetId ?? '');
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

  if (!datasetId || !itemId) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral4 py-8 text-center">
            <p>Item not found.</p>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  // No versions selected: show the item's version history, letting the user
  // pick two versions to enter compare mode (sets `?ids=a,b`).
  if (versionNumbers.length < 2) {
    return (
      <DatasetItemVersionHistory
        datasetId={datasetId}
        itemId={itemId}
        Link={FrameworkLink}
        onCompare={versionIds => setSearchParams({ ids: versionIds.join(',') })}
      />
    );
  }

  return (
    <MainContentLayout>
      <RouteHeaderActions owner="dataset-item-versions-compare">
        <Button as={Link} to={`/datasets/${datasetId}/items/${itemId}`} variant="outline">
          <ArrowLeft />
          Back to Item
        </Button>
      </RouteHeaderActions>

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
                <Button variant="primary" onClick={() => setIsDiffView(v => !v)}>
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

function DatasetItemVersionHistory({
  datasetId,
  itemId,
  Link: FrameworkLink,
  onCompare,
}: {
  datasetId: string;
  itemId: string;
  Link: ReturnType<typeof useLinkComponent>['Link'];
  onCompare: (versionIds: string[]) => void;
}) {
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const { data: allVersions, isLoading } = useDatasetItemVersions(datasetId, itemId);
  const version =
    (previewVersion != null ? allVersions?.find(v => v.datasetVersion === previewVersion) : undefined) ??
    allVersions?.[0];

  const displayItem = version
    ? {
        id: version.id,
        datasetId,
        datasetVersion: version.datasetVersion,
        input: version.input,
        groundTruth: version.groundTruth,
        scorerIds: version.scorerIds,
        metadata: version.metadata,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
      }
    : null;

  return (
    <MainContentLayout>
      <RouteHeaderActions owner="dataset-item-versions-history">
        <Button as={Link} to={`/datasets/${datasetId}/items/${itemId}`} variant="outline">
          <ArrowLeft />
          Back to Item
        </Button>
      </RouteHeaderActions>

      <div className="h-full overflow-hidden px-[3vw] pb-4">
        <div className="mx-auto grid h-full max-w-[140rem] grid-rows-[auto_1fr] gap-6">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title>
                <HistoryIcon />
                Item Version History
              </MainHeader.Title>
              <MainHeader.Description>
                <TextAndIcon>Versions of {itemId}</TextAndIcon>
              </MainHeader.Description>
            </MainHeader.Column>
          </MainHeader>

          <Columns className="grid-cols-[1fr_auto]">
            <Column>
              <Column.Content>
                {isLoading ? (
                  <div className="text-neutral4 text-sm">Loading...</div>
                ) : displayItem ? (
                  <DatasetItemContent item={displayItem} Link={FrameworkLink} />
                ) : (
                  <div className="text-neutral4 text-sm">Item data not available</div>
                )}
              </Column.Content>
            </Column>
            <DatasetItemVersionsPanel
              datasetId={datasetId}
              itemId={itemId}
              onClose={() => {}}
              onVersionSelect={v => setPreviewVersion(v.datasetVersion)}
              onCompareVersionsClick={onCompare}
              activeVersion={previewVersion}
            />
          </Columns>
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
            <Badge variant="blue" size="xs">
              Latest
            </Badge>
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
        scorerIds: version.scorerIds,
        metadata: version.metadata,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
      }
    : null;

  return (
    <Column>
      <Column.Toolbar className="grid grid-cols-[auto_1fr] gap-4">
        <HistoryIcon className="h-6 w-6 opacity-50" />
        <Select
          name={`compare-version-${idx}`}
          value={String(datasetVersion)}
          onValueChange={(val: string) => onVersionChange(Number(val))}
        >
          <SelectTrigger aria-label="Version" className="w-full">
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
