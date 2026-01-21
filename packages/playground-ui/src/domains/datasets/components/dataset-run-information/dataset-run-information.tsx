import { useDatasetRun, useDatasetRunResults } from '../../hooks/use-dataset-runs';
import { RunSummary } from '../run-summary';
import { RunResultsTable } from '../run-results-table';
import { Skeleton } from '@/ds/components/Skeleton';
import { TraceDialogProvider, useTraceDialog } from '../../context/trace-dialog-context';
import { TraceDialog, useTrace } from '@/domains/observability';
import { useLinkComponent } from '@/lib/framework';

export type DatasetRunInformationProps = {
  datasetId: string;
  runId: string;
};

export function DatasetRunInformation({ datasetId, runId }: DatasetRunInformationProps) {
  return (
    <TraceDialogProvider>
      <DatasetRunInformationContent datasetId={datasetId} runId={runId} />
    </TraceDialogProvider>
  );
}

function DatasetRunInformationContent({ datasetId, runId }: DatasetRunInformationProps) {
  const { data: runData, isLoading: isLoadingRun } = useDatasetRun(datasetId, runId);
  const { data: resultsData, isLoading: isLoadingResults } = useDatasetRunResults(datasetId, runId, {
    perPage: 100,
  });
  const { selectedTraceId, isOpen, closeTrace, openTrace } = useTraceDialog();
  const { paths } = useLinkComponent();

  const { data: traceData, isLoading: isLoadingTrace } = useTrace(selectedTraceId, {
    enabled: isOpen && !!selectedTraceId,
  });

  if (isLoadingRun && !runData) {
    return <DatasetRunInformationSkeleton />;
  }

  const run = runData?.run;
  const results = resultsData?.results ?? [];

  if (!run) {
    return <div className="p-4 text-text-muted">Run not found</div>;
  }

  // Find current trace index for navigation
  const resultsWithTraces = results.filter(r => r.traceId);
  const currentTraceIndex = resultsWithTraces.findIndex(r => r.traceId === selectedTraceId);

  const handleNextTrace =
    currentTraceIndex < resultsWithTraces.length - 1
      ? () => {
          const next = resultsWithTraces[currentTraceIndex + 1];
          if (next?.traceId) {
            openTrace(next.traceId);
          }
        }
      : undefined;

  const handlePreviousTrace =
    currentTraceIndex > 0
      ? () => {
          const prev = resultsWithTraces[currentTraceIndex - 1];
          if (prev?.traceId) {
            openTrace(prev.traceId);
          }
        }
      : undefined;

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <RunSummary run={run} results={results} isLoading={isLoadingRun} />
      <div className="flex-1">
        <h3 className="text-sm font-medium text-text-default mb-2">Results</h3>
        <RunResultsTable results={results} isLoading={isLoadingResults} />
      </div>

      <TraceDialog
        traceId={selectedTraceId ?? undefined}
        traceSpans={traceData?.spans}
        traceDetails={traceData?.spans?.find(s => !s.parentSpanId)}
        isOpen={isOpen}
        onClose={closeTrace}
        onNext={handleNextTrace}
        onPrevious={handlePreviousTrace}
        isLoadingSpans={isLoadingTrace}
        embedded
        computeTraceLink={(traceId, spanId, tab) => {
          let url = paths.traceLink(traceId);
          if (spanId) url += `&spanId=${spanId}`;
          if (tab) url += `&tab=${tab}`;
          return url;
        }}
      />
    </div>
  );
}

const DatasetRunInformationSkeleton = () => (
  <div className="p-4">
    <Skeleton className="h-32 w-full mb-4" />
    <Skeleton className="h-4 w-24 mb-2" />
    <Skeleton className="h-64 w-full" />
  </div>
);
