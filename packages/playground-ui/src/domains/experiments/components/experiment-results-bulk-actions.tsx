import type { DatasetExperimentResult } from '@mastra/client-js';
import { ExperimentResultsTagPicker } from './experiment-results-tag-picker';
import { Button } from '@/ds/components/Button';
import { IconClipboard2 } from '@/ds/icons/central/IconClipboard2';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

export interface ExperimentResultsBulkActionsProps {
  selectedResults: Array<Pick<DatasetExperimentResult, 'tags'>>;
  onClearSelection: () => void;
  /** Flags the selected results for review; the button is hidden when absent. */
  onRequestReview?: () => void;
  isRequestingReview?: boolean;
  /** Adds a tag to the selected results; the tag picker is hidden when absent. */
  onAddTag?: (tag: string) => void;
  isTagging?: boolean;
  tagVocabulary?: string[];
}

/** Selection count (a button clearing the selection once non-empty), plus the actions acting on the selected results. */
export function ExperimentResultsBulkActions({
  selectedResults,
  onClearSelection,
  onRequestReview,
  isRequestingReview = false,
  onAddTag,
  isTagging = false,
  tagVocabulary = [],
}: ExperimentResultsBulkActionsProps) {
  const busy = isRequestingReview || isTagging;
  const isEmpty = selectedResults.length === 0;

  return (
    <div className="flex min-h-8 items-center gap-2 whitespace-nowrap">
      <Button
        variant="ghost"
        size="sm"
        disabled={isEmpty}
        iconEnd={isEmpty ? undefined : <IconCrossMedium />}
        onClick={onClearSelection}
        tooltip={isEmpty ? undefined : 'Clear selection'}
        className="tabular-nums"
      >
        {selectedResults.length} selected
      </Button>
      {!isEmpty && onRequestReview && (
        <Button size="sm" disabled={busy} onClick={onRequestReview} icon={<IconClipboard2 />}>
          Request review
        </Button>
      )}
      {!isEmpty && onAddTag && (
        <ExperimentResultsTagPicker
          selectedResults={selectedResults}
          vocabulary={tagVocabulary}
          onAddTag={onAddTag}
          disabled={busy}
        />
      )}
    </div>
  );
}
