import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { ClipboardCheck } from 'lucide-react';

import type { ExperimentResultsSelection } from '../hooks/use-experiment-results-selection';
import { ExperimentResultsTagPicker } from './experiment-results-tag-picker';

export interface ExperimentResultsBulkActionsProps {
  selection: ExperimentResultsSelection;
}

/** Actions acting on the selected results; renders nothing while the selection is empty. */
export function ExperimentResultsBulkActions({ selection }: ExperimentResultsBulkActionsProps) {
  const { selectedIds, selectedResults, tagVocabulary, isFlagging, isTagging } = selection;
  if (selectedIds.size === 0) return null;

  const busy = isFlagging || isTagging;

  return (
    <ButtonsGroup className="whitespace-nowrap">
      <Button variant="outline" disabled={busy} onClick={selection.flagSelectedForReview} icon={<ClipboardCheck />}>
        Flag {selectedIds.size} to review
      </Button>
      <ExperimentResultsTagPicker
        selectedResults={selectedResults}
        vocabulary={tagVocabulary}
        onAddTag={selection.addTagToSelected}
        disabled={busy}
      />
      <Button variant="ghost" onClick={selection.clearSelection}>
        Clear
      </Button>
    </ButtonsGroup>
  );
}
