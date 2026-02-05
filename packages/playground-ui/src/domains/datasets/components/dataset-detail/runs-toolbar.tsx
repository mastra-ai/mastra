'use client';

import { Button } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { GitCompare, MoveRightIcon } from 'lucide-react';

export type RunsToolbarProps = {
  hasRuns: boolean;
  onCompareClick: () => void;
  isSelectionActive: boolean;
  selectedCount: number;
  onExecuteCompare: () => void;
  onCancelSelection: () => void;
};

export function RunsToolbar({
  hasRuns,
  onCompareClick,
  isSelectionActive,
  selectedCount,
  onExecuteCompare,
  onCancelSelection,
}: RunsToolbarProps) {
  if (isSelectionActive) {
    return (
      <div className="flex items-center justify-end gap-4 w-full">
        <div className="flex gap-5">
          <div className="text-sm text-neutral3 flex items-center gap-2 pl-6">
            <Badge className="text-ui-md">{selectedCount}</Badge>
            <span>of 2 runs selected</span>
            <MoveRightIcon />
          </div>
          <ButtonsGroup>
            <Button variant="standard" size="default" disabled={selectedCount !== 2} onClick={onExecuteCompare}>
              <GitCompare className="w-4 h-4" />
              Compare Runs
            </Button>
            <Button variant="secondary" size="default" onClick={onCancelSelection}>
              Cancel
            </Button>
          </ButtonsGroup>
        </div>
      </div>
    );
  }

  if (!hasRuns) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-4 w-full">
      <Button variant="secondary" size="default" onClick={onCompareClick}>
        <GitCompare className="w-4 h-4" />
        Compare
      </Button>
    </div>
  );
}
