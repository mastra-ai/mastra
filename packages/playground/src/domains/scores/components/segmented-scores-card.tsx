import { DataList } from '@mastra/playground-ui/components/DataList';
import { MetricsCard } from '@mastra/playground-ui/components/MetricsCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { useState } from 'react';
import type { ScoreMetricsDateRange } from '../hooks/use-score-metrics';
import { useScoreMetadataKeys, useScoreSegments } from '../hooks/use-score-segments';
import type { ScoreBucket } from '../hooks/use-score-segments';

const BUCKETS: ScoreBucket[] = ['hour', 'day', 'week', 'month'];
const NO_GROUPING = '__none__';

interface SegmentedScoresCardProps {
  dateRange?: ScoreMetricsDateRange;
}

export function SegmentedScoresCard({ dateRange }: SegmentedScoresCardProps) {
  const [bucket, setBucket] = useState<ScoreBucket>('day');
  const [groupBy, setGroupBy] = useState<string>(NO_GROUPING);

  const { data: metadataKeys } = useScoreMetadataKeys();
  const {
    data: segments,
    isLoading,
    isError,
  } = useScoreSegments({
    bucket,
    groupBy: groupBy === NO_GROUPING ? null : groupBy,
    dateRange,
  });

  const rows = segments?.rows ?? [];

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription
          title="Segmented scores"
          description="Score trends split by scorer, entity, or any metadata dimension."
        />
        <div className="flex items-center gap-2">
          <Select value={bucket} onValueChange={value => setBucket(value as ScoreBucket)}>
            <SelectTrigger className="w-28" aria-label="Time bucket">
              <SelectValue placeholder="Bucket" />
            </SelectTrigger>
            <SelectContent>
              {BUCKETS.map(value => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-48" aria-label="Group by">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_GROUPING}>No grouping</SelectItem>
              <SelectItem value="scorerId">Scorer</SelectItem>
              <SelectItem value="entityId">Entity</SelectItem>
              {(metadataKeys?.keys ?? []).map(key => (
                <SelectItem key={key} value={`metadata:${key}`}>
                  metadata: {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load segmented scores" />
      ) : (
        <MetricsCard.Content>
          {rows.length === 0 ? (
            <MetricsCard.NoData message="No scores in this window" />
          ) : (
            <DataList
              columns="auto auto auto auto auto auto auto"
              className="max-h-80"
              mask={{ left: false }}
              stickyHeaderBackground="tinted"
            >
              <DataList.Top>
                <DataList.TopCell sticky="start">Bucket</DataList.TopCell>
                <DataList.TopCell>Segment</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Count</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Avg</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">P50</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">P95</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Pass rate</DataList.TopCell>
              </DataList.Top>
              {rows.map((row, index) => (
                <DataList.RowStatic key={index}>
                  <DataList.RowHeaderCell height="compact" className="text-ui-sm">
                    {row.bucketStart ? new Date(row.bucketStart).toLocaleString() : 'All time'}
                  </DataList.RowHeaderCell>
                  <DataList.TextCell>
                    {row.groups?.map(group => group ?? '(none)').join(' / ') || '—'}
                  </DataList.TextCell>
                  <DataList.NumberCell>{row.count.toLocaleString()}</DataList.NumberCell>
                  <DataList.NumberCell highlight>{row.avg.toFixed(2)}</DataList.NumberCell>
                  <DataList.NumberCell>{row.p50.toFixed(2)}</DataList.NumberCell>
                  <DataList.NumberCell>{row.p95.toFixed(2)}</DataList.NumberCell>
                  <DataList.NumberCell>{(row.passRate * 100).toFixed(0)}%</DataList.NumberCell>
                </DataList.RowStatic>
              ))}
            </DataList>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
