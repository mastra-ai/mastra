import type { DatasetItem } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent, CardHeader } from '@mastra/playground-ui/components/Card';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { MainContentContent, MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { format } from 'date-fns';
import { HistoryIcon, ColumnsIcon, GitCompareArrowsIcon, GitCompareIcon } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router';
import { DatasetItemDetails } from '@/domains/datasets';
import { useDatasetItemVersion, useDatasetItemVersions } from '@/domains/datasets/hooks/use-dataset-item-versions';
import type { DatasetItemVersion } from '@/domains/datasets/hooks/use-dataset-item-versions';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { RouteHeaderActions } from '@/lib/route-header';

function toDatasetItem(version: DatasetItemVersion, datasetId: string): DatasetItem {
  return {
    id: version.id,
    datasetId,
    datasetVersion: version.datasetVersion,
    input: version.input,
    groundTruth: version.groundTruth,
    expectedTrajectory: version.expectedTrajectory,
    toolMocks: version.toolMocks,
    scorerIds: version.scorerIds,
    requestContext: version.requestContext,
    metadata: version.metadata,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
}

function versionOptions(allVersions: DatasetItemVersion[], disabled?: Set<number>) {
  return allVersions.map(v => {
    const date = typeof v.updatedAt === 'string' ? new Date(v.updatedAt) : v.updatedAt;
    return {
      value: String(v.datasetVersion),
      label: (
        <span className="flex w-full items-center gap-2">
          <span>
            <b>v. {v.datasetVersion}</b> · {format(date, 'MMM d, HH:mm')}
          </span>
          {v.isLatest ? (
            <Badge variant="blue" size="xs" className="ml-auto">
              Latest
            </Badge>
          ) : null}
        </span>
      ),
      disabled: disabled?.has(v.datasetVersion) ?? false,
    };
  });
}

function parseVersionParam(value: string | null): number | null {
  const n = Number(value);
  return value != null && Number.isFinite(n) && n > 0 ? n : null;
}

function DatasetItemVersionsComparePage() {
  const { datasetId, itemId } = useParams<{ datasetId: string; itemId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Whole view lives in the URL so a link reproduces it:
  // ?version=3 — left column; ?compare=2 — right column; ?view=diff
  const selectedVersion = parseVersionParam(searchParams.get('version'));
  const compareVersion = parseVersionParam(searchParams.get('compare'));
  const isDiffView = searchParams.get('view') === 'diff';

  const { data: dataset, error } = useDataset(datasetId ?? '');
  const { data: allVersions, isLoading } = useDatasetItemVersions(datasetId ?? '', itemId ?? '');

  // URL is the source of truth; fall back to latest when absent or unknown.
  const leftVersion =
    (selectedVersion != null ? allVersions?.find(v => v.datasetVersion === selectedVersion) : undefined) ??
    allVersions?.[0];
  const leftNumber = leftVersion?.datasetVersion ?? null;
  const rightNumber = compareVersion != null && compareVersion !== leftNumber ? compareVersion : null;

  const { data: rightVersion, isLoading: isRightLoading } = useDatasetItemVersion(
    datasetId ?? '',
    itemId ?? '',
    rightNumber ?? 0,
    dataset?.version,
  );

  const setParam = (key: 'version' | 'compare' | 'view', value: string | number | null) =>
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev);
        if (value == null) params.delete(key);
        else params.set(key, String(value));
        return params;
      },
      { replace: true },
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
          <div className="text-neutral4 py-5 text-center">
            <p>Item not found.</p>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  const canDiff = Boolean(leftVersion && rightVersion);
  const showDiff = isDiffView && canDiff;
  const leftItem = leftVersion ? toDatasetItem(leftVersion, datasetId) : null;
  const rightItem = rightVersion ? toDatasetItem(rightVersion, datasetId) : null;
  // Red/green follows chronology, not column position: the older version shows removals, the newer one additions.
  const leftIsOlder = (leftVersion?.datasetVersion ?? 0) < (rightVersion?.datasetVersion ?? 0);

  return (
    <MainContentLayout>
      <RouteHeaderActions owner="dataset-item-versions">
        {canDiff && (
          <Button variant="outline" onClick={() => setParam('view', isDiffView ? null : 'diff')}>
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
        )}
      </RouteHeaderActions>

      <PageLayout height="full" className="grid-rows-[minmax(0,1fr)]">
        <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden">
            <CardHeader>
              <VersionSelect
                name="version"
                value={leftNumber != null ? String(leftNumber) : ''}
                options={versionOptions(allVersions ?? [], rightNumber != null ? new Set([rightNumber]) : undefined)}
                onValueChange={val => setParam('version', Number(val))}
              />
            </CardHeader>
            <CardContent className="grid content-start gap-5 overflow-y-auto">
              {isLoading ? (
                <div className="text-neutral4 text-ui-md">Loading...</div>
              ) : leftItem ? (
                <DatasetItemDetails
                  item={leftItem}
                  diff={showDiff && rightItem ? { against: rightItem, side: leftIsOlder ? 'a' : 'b' } : undefined}
                />
              ) : (
                <div className="text-neutral4 text-ui-md">Item data not available</div>
              )}
            </CardContent>
          </Card>

          <Card className="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden">
            <CardHeader>
              <VersionSelect
                name="compare"
                value={rightNumber != null ? String(rightNumber) : ''}
                placeholder="Select a version to compare"
                options={versionOptions(allVersions ?? [], leftNumber != null ? new Set([leftNumber]) : undefined)}
                onValueChange={val => setParam('compare', Number(val))}
              />
            </CardHeader>
            <CardContent className="grid content-start gap-5 overflow-y-auto">
              {rightNumber == null ? (
                <EmptyState
                  className="h-full"
                  iconSlot={<GitCompareIcon className="text-neutral3 size-8" />}
                  titleSlot="No version selected"
                  descriptionSlot="Pick a version above to compare it with the one on the left."
                />
              ) : isRightLoading ? (
                <div className="text-neutral4 text-ui-md">Loading...</div>
              ) : rightItem ? (
                <DatasetItemDetails
                  item={rightItem}
                  diff={showDiff && leftItem ? { against: leftItem, side: leftIsOlder ? 'b' : 'a' } : undefined}
                />
              ) : (
                <div className="text-neutral4 text-ui-md">Version {rightNumber} not found</div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    </MainContentLayout>
  );
}

function VersionSelect({
  name,
  value,
  options,
  placeholder = 'Select version',
  onValueChange,
}: {
  name: string;
  value: string;
  options: ReturnType<typeof versionOptions>;
  placeholder?: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-4">
      <HistoryIcon className="size-4 opacity-50" />
      <Select name={name} value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-label={name === 'compare' ? 'Compare version' : 'Version'} className="w-full">
          <SelectValue placeholder={placeholder} className="flex-1" />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export { DatasetItemVersionsComparePage };
export default DatasetItemVersionsComparePage;
