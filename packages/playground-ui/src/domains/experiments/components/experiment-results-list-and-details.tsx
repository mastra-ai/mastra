'use client';

import { useState } from 'react';
import { DatasetExperimentResult } from '@mastra/client-js';

import { ListAndDetails } from '@/ds/components/ListAndDetails/list-and-details';
import { useExperimentTrace } from '../hooks/use-experiment-trace';
import { ExperimentResultPanel } from './experiment-result-panel';
import { ExperimentResultSpanPane } from './experiment-result-span-pane';
import { ExperimentResultTracePanel } from './experiment-result-trace-panel';
import { ExperimentResultsList } from './experiment-results-list';

export type ExperimentResultsListAndDetailsProps = {
  results: DatasetExperimentResult[];
  isLoading: boolean;
};

/**
 * Master-detail layout for experiment results.
 * Shows results list on left, result detail panel on right when a result is selected.
 */
export function ExperimentResultsListAndDetails({ results, isLoading }: ExperimentResultsListAndDetailsProps) {
  const [featuredResultId, setSelectedResultId] = useState<string | null>(null);
  const [featuredTraceId, setFeaturedTraceId] = useState<string | null>(null);
  const [featuredSpanId, setFeaturedSpanId] = useState<string | undefined>(undefined);

  const selectedResult = results.find(r => r.id === featuredResultId) ?? null;

  // Trace data for span navigation (shared React Query cache with trace panel)
  const { data: traceData } = useExperimentTrace(featuredTraceId);
  const traceSpans = traceData?.spans ?? [];

  const toNextSpan = (): (() => void) | undefined => {
    if (!featuredSpanId) return undefined;
    const currentIndex = traceSpans.findIndex(s => s.spanId === featuredSpanId);
    if (currentIndex >= 0 && currentIndex < traceSpans.length - 1) {
      return () => setFeaturedSpanId(traceSpans[currentIndex + 1].spanId);
    }
    return undefined;
  };

  const toPreviousSpan = (): (() => void) | undefined => {
    if (!featuredSpanId) return undefined;
    const currentIndex = traceSpans.findIndex(s => s.spanId === featuredSpanId);
    if (currentIndex > 0) {
      return () => setFeaturedSpanId(traceSpans[currentIndex - 1].spanId);
    }
    return undefined;
  };

  const selectResult = (resultId: string | null) => {
    setSelectedResultId(resultId);
    setFeaturedTraceId(null);
    setFeaturedSpanId(undefined);
  };

  const handleResultClick = (resultId: string) => {
    selectResult(resultId === featuredResultId ? null : resultId);
  };

  const handleClose = () => {
    selectResult(null);
  };

  // Navigation handlers - return function or undefined to enable/disable buttons
  const toNextResult = (): (() => void) | undefined => {
    if (!selectedResult) return undefined;
    const currentIndex = results.findIndex(r => r.id === selectedResult.id);
    if (currentIndex >= 0 && currentIndex < results.length - 1) {
      return () => selectResult(results[currentIndex + 1].id);
    }
    return undefined;
  };

  const toPreviousResult = (): (() => void) | undefined => {
    if (!selectedResult) return undefined;
    const currentIndex = results.findIndex(r => r.id === selectedResult.id);
    if (currentIndex > 0) {
      return () => selectResult(results[currentIndex - 1].id);
    }
    return undefined;
  };

  const resultsListColumns = [
    { name: 'itemId', label: 'Item ID', size: '5rem' },
    { name: 'status', label: 'Status', size: '3rem' },
    ...(!featuredResultId ? [{ name: 'input', label: 'Input', size: '1fr' }] : []),
    ...(!featuredResultId ? [{ name: 'output', label: 'Output', size: '1fr' }] : []),
  ];

  return (
    <ListAndDetails isDetailsActive={Boolean(selectedResult)}>
      {/* List column - always visible */}
      <ListAndDetails.List>
        <ExperimentResultsList
          results={results}
          isLoading={isLoading}
          featuredResultId={featuredResultId}
          onResultClick={handleResultClick}
          columns={resultsListColumns}
        />
      </ListAndDetails.List>

      {selectedResult && (
        <ListAndDetails.Details numOfColumns={1 + (featuredTraceId ? 1 : 0) + (featuredSpanId ? 1 : 0)}>
          {selectedResult && (
            <ListAndDetails.Column>
              <ExperimentResultPanel
                result={selectedResult}
                onPrevious={toPreviousResult()}
                onNext={toNextResult()}
                onClose={handleClose}
                onShowTrace={() => {
                  setFeaturedTraceId(selectedResult.traceId ?? null);
                  setFeaturedSpanId(undefined);
                }}
              />
            </ListAndDetails.Column>
          )}

          {selectedResult && featuredTraceId && (
            <ListAndDetails.Column type="details">
              <ExperimentResultTracePanel
                traceId={featuredTraceId}
                selectedSpanId={featuredSpanId}
                onSpanSelect={setFeaturedSpanId}
                onClose={() => {
                  setFeaturedTraceId(null);
                  setFeaturedSpanId(undefined);
                }}
              />
            </ListAndDetails.Column>
          )}

          {selectedResult && featuredTraceId && featuredSpanId && (
            <ListAndDetails.Column type="details">
              <ExperimentResultSpanPane
                traceId={featuredTraceId}
                spanId={featuredSpanId}
                onNext={toNextSpan()}
                onPrevious={toPreviousSpan()}
                onClose={() => setFeaturedSpanId(undefined)}
              />
            </ListAndDetails.Column>
          )}
        </ListAndDetails.Details>
      )}
    </ListAndDetails>
  );
}
