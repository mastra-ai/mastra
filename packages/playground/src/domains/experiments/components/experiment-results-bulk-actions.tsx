import { Button } from '@mastra/playground-ui/components/Button';
import { ClipboardCheck, X } from 'lucide-react';

import type { ExperimentResultsSelection } from '../hooks/use-experiment-results-selection';
import { ExperimentResultsTagPicker } from './experiment-results-tag-picker';

export interface ExperimentResultsBulkActionsProps {
  selection: ExperimentResultsSelection;
}

/** Selection count (a button clearing the selection once non-empty), plus the actions acting on the selected results. */
export function ExperimentResultsBulkActions({ selection }: ExperimentResultsBulkActionsProps) {
  const { selectedIds, selectedResults, tagVocabulary, isFlagging, isTagging } = selection;
  const busy = isFlagging || isTagging;
  const isEmpty = selectedIds.size === 0;

  return (
    <div className="flex min-h-8 items-center gap-1 whitespace-nowrap">
      <Button
        variant="ghost"
        size="sm"
        disabled={isEmpty}
        iconEnd={isEmpty ? undefined : <X />}
        onClick={selection.clearSelection}
        tooltip={isEmpty ? undefined : 'Clear selection'}
        className="mr-2 tabular-nums"
      >
        {selectedIds.size} selected
      </Button>
      {!isEmpty && (
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={selection.flagSelectedForReview}
            icon={<ClipboardCheck />}
          >
            Flag for review
          </Button>
          <ExperimentResultsTagPicker
            selectedResults={selectedResults}
            vocabulary={tagVocabulary}
            onAddTag={selection.addTagToSelected}
            disabled={busy}
          />
        </>
      )}
    </div>
  );
}
