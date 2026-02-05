'use client';

import { useState } from 'react';
import { DatasetRunResult } from '@mastra/client-js';
import { cn } from '@/lib/utils';
import { Columns } from '@/ds/components/Columns/columns';
import { RunResultDetailPanel } from './run-result-detail-panel';
import { RunResultsListInternal } from './run-results-list';

export type RunResultsMasterDetailProps = {
  results: DatasetRunResult[];
  isLoading: boolean;
};

/**
 * Master-detail layout for run results.
 * Shows results list on left, result detail panel on right when a result is selected.
 */
export function RunResultsMasterDetail({ results, isLoading }: RunResultsMasterDetailProps) {
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  const selectedResult = results.find(r => r.id === selectedResultId) ?? null;

  const handleResultClick = (resultId: string) => {
    if (resultId === selectedResultId) {
      setSelectedResultId(null);
    } else {
      setSelectedResultId(resultId);
    }
  };

  const handleClose = () => {
    setSelectedResultId(null);
  };

  // Navigation handlers - return function or undefined to enable/disable buttons
  const toNextResult = (): (() => void) | undefined => {
    if (!selectedResult) return undefined;
    const currentIndex = results.findIndex(r => r.id === selectedResult.id);
    if (currentIndex >= 0 && currentIndex < results.length - 1) {
      return () => setSelectedResultId(results[currentIndex + 1].id);
    }
    return undefined;
  };

  const toPreviousResult = (): (() => void) | undefined => {
    if (!selectedResult) return undefined;
    const currentIndex = results.findIndex(r => r.id === selectedResult.id);
    if (currentIndex > 0) {
      return () => setSelectedResultId(results[currentIndex - 1].id);
    }
    return undefined;
  };

  const isSidePanelActive = Boolean(selectedResult);

  return (
    <Columns isSideColumnVisible={isSidePanelActive}>
      {/* List column - always visible */}
      <div className="flex flex-col h-full overflow-hidden">
        <RunResultsListInternal
          results={results}
          isLoading={isLoading}
          selectedResultId={selectedResultId}
          onResultClick={handleResultClick}
        />
      </div>

      {/* Detail column - shows when a result is selected */}
      {selectedResult && (
        <div className={cn('flex flex-col h-full overflow-hidden w-[20rem] xl:w-[30rem] 2xl:w-[40rem]')}>
          <RunResultDetailPanel
            result={selectedResult}
            onPrevious={toPreviousResult()}
            onNext={toNextResult()}
            onClose={handleClose}
          />
        </div>
      )}
    </Columns>
  );
}
