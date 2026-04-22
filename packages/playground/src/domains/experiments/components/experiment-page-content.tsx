'use client';

import type { DatasetExperimentResult } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { Column, Columns, MultiColumn, Tabs, Tab, TabList, TabContent } from '@mastra/playground-ui';
import { useState, useMemo } from 'react';

import { useExperimentTrace } from '../hooks/use-experiment-trace';
import { ExperimentResultPanel } from './experiment-result-panel';
import { ExperimentResultSpanPane } from './experiment-result-span-pane';
import { ExperimentResultTracePanel } from './experiment-result-trace-panel';
import { ExperimentResultsList } from './experiment-results-list';
import { ExperimentScorePanel } from './experiment-score-panel';
import { ExperimentScorerSummary } from './experiment-scorer-summary';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';

export type ExperimentPageContentProps = {
  experimentId: string;
  experimentStatus?: ExperimentStatus;
  results: DatasetExperimentResult[];
  isLoading: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
};

/**
 * Master-detail layout for experiment results.
 * Shows results list on left, result detail panel on right when a result is selected.
 */
export function ExperimentPageContent({
  experimentId,
  experimentStatus,
  results,
  isLoading,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
}: ExperimentPageContentProps) {
  const [featuredResultId, setSelectedResultId] = useState<string | null>(null);
  const [featuredTraceId, setFeaturedTraceId] = useState<string | null>(null);
  const [featuredSpanId, setFeaturedSpanId] = useState<string | undefined>(undefined);
  const [featuredScoreId, setFeaturedScoreId] = useState<string | null>(null);

  const featuredResult = results.find(r => r.id === featuredResultId) ?? null;

  const { data: scoresByExperimentId } = useScoresByExperimentId(experimentId, experimentStatus);

  const scorerIds = useMemo(() => {
    if (!scoresByExperimentId) return [];
    const ids = new Set<string>();
    for (const scores of Object.values(scoresByExperimentId)) {
      for (const score of scores) {
        ids.add(score.scorerId);
      }
    }
    return [...ids].sort();
  }, [scoresByExperimentId]);

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
    setFeaturedScoreId(null);
  };

  const handleResultClick = (resultId: string) => {
    selectResult(resultId === featuredResultId ? null : resultId);
  };

  const handleClose = () => {
    selectResult(null);
  };

  // Navigation handlers - return function or undefined to enable/disable buttons
  const toNextResult = (): (() => void) | undefined => {
    if (!featuredResult) return undefined;
    const currentIndex = results.findIndex(r => r.id === featuredResult.id);
    if (currentIndex >= 0 && currentIndex < results.length - 1) {
      return () => selectResult(results[currentIndex + 1].id);
    }
    return undefined;
  };

  const toPreviousResult = (): (() => void) | undefined => {
    if (!featuredResult) return undefined;
    const currentIndex = results.findIndex(r => r.id === featuredResult.id);
    if (currentIndex > 0) {
      return () => selectResult(results[currentIndex - 1].id);
    }
    return undefined;
  };

  const featuredResultScores = featuredResult ? scoresByExperimentId?.[featuredResult.itemId] : undefined;
  const featuredScore = featuredResultScores?.find(s => s.id === featuredScoreId) ?? null;

  const handleScoreClick = (scoreId: string) => {
    setFeaturedScoreId(scoreId === featuredScoreId ? null : scoreId);
    setFeaturedTraceId(null);
    setFeaturedSpanId(undefined);
  };

  const toNextScore = (): (() => void) | undefined => {
    if (!featuredScoreId || !featuredResultScores) return undefined;
    const currentIndex = featuredResultScores.findIndex(s => s.id === featuredScoreId);
    if (currentIndex >= 0 && currentIndex < featuredResultScores.length - 1) {
      return () => setFeaturedScoreId(featuredResultScores[currentIndex + 1].id);
    }
    return undefined;
  };

  const toPreviousScore = (): (() => void) | undefined => {
    if (!featuredScoreId || !featuredResultScores) return undefined;
    const currentIndex = featuredResultScores.findIndex(s => s.id === featuredScoreId);
    if (currentIndex > 0) {
      return () => setFeaturedScoreId(featuredResultScores[currentIndex - 1].id);
    }
    return undefined;
  };

  const resultsListColumns = useMemo(
    () => [
      { name: 'itemId', label: 'Item ID', size: '5rem' },
      { name: 'status', label: 'Status', size: '3rem' },
      { name: 'input', label: 'Input', size: '1fr' },
      ...(!featuredResultId ? scorerIds.map(id => ({ name: id, label: id, size: '1fr' })) : []),
    ],
    [featuredResultId, scorerIds],
  );

  return (
    <Tabs defaultTab="summary" className="grid grid-rows-[auto_1fr] h-full overflow-hidden">
      <TabList>
        <Tab value="summary">Summary</Tab>
        <Tab value="results">Results</Tab>
      </TabList>

      <TabContent value="summary" className="overflow-y-auto mt-5">
        <ExperimentScorerSummary scoresByItemId={scoresByExperimentId} experimentStatus={experimentStatus} />
      </TabContent>

      <TabContent value="results" className="grid overflow-hidden mt-5">
        <Columns className={featuredResult ? 'grid-cols-[1fr_2fr]' : undefined}>
          {/* List column - always visible */}
          <Column>
            <ExperimentResultsList
              results={results}
              isLoading={isLoading}
              featuredResultId={featuredResultId}
              onResultClick={handleResultClick}
              columns={resultsListColumns}
              scoresByItemId={scoresByExperimentId}
              scorerIds={!featuredResultId ? scorerIds : undefined}
              setEndOfListElement={setEndOfListElement}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
            />
          </Column>

          {featuredResult && (
            <MultiColumn
              numOfColumns={
                1 + (!featuredTraceId && featuredScoreId ? 1 : 0) + (featuredTraceId ? 1 : 0) + (featuredSpanId ? 1 : 0)
              }
              minColumnWidth="35rem"
            >
              {featuredResult && (
                <Column withLeftSeparator>
                  <ExperimentResultPanel
                    result={featuredResult}
                    scores={featuredResultScores}
                    onPrevious={toPreviousResult()}
                    onNext={toNextResult()}
                    onClose={handleClose}
                    onScoreClick={handleScoreClick}
                    featuredScoreId={featuredScoreId}
                    onShowTrace={() => {
                      setFeaturedTraceId(featuredResult.traceId ?? null);
                      setFeaturedSpanId(undefined);
                      setFeaturedScoreId(null);
                    }}
                  />
                </Column>
              )}

              {featuredResult && !featuredTraceId && featuredScore && (
                <Column withLeftSeparator>
                  <ExperimentScorePanel
                    score={featuredScore}
                    onNext={toNextScore()}
                    onPrevious={toPreviousScore()}
                    onClose={() => setFeaturedScoreId(null)}
                  />
                </Column>
              )}

              {featuredResult && featuredTraceId && (
                <Column withLeftSeparator>
                  <ExperimentResultTracePanel
                    traceId={featuredTraceId}
                    selectedSpanId={featuredSpanId}
                    onSpanSelect={setFeaturedSpanId}
                    onClose={() => {
                      setFeaturedTraceId(null);
                      setFeaturedSpanId(undefined);
                    }}
                  />
                </Column>
              )}

              {featuredResult && featuredTraceId && featuredSpanId && (
                <Column withLeftSeparator>
                  <ExperimentResultSpanPane
                    traceId={featuredTraceId}
                    spanId={featuredSpanId}
                    onNext={toNextSpan()}
                    onPrevious={toPreviousSpan()}
                    onClose={() => setFeaturedSpanId(undefined)}
                  />
                </Column>
              )}
            </MultiColumn>
          )}
        </Columns>
      </TabContent>
    </Tabs>
  );
}
