import { Button } from '@mastra/playground-ui/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { GitCompare, X } from 'lucide-react';

export interface ExperimentsBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onCompare: () => void;
  /** When set, Compare is disabled and this reason is shown in its tooltip. */
  compareDisabledReason?: string;
}

/** Selection count (a button clearing the selection once non-empty), plus Compare — always shown, explained when disabled. */
export function ExperimentsBulkActions({
  selectedCount,
  onClearSelection,
  onCompare,
  compareDisabledReason,
}: ExperimentsBulkActionsProps) {
  const isEmpty = selectedCount === 0;

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <Button
        variant="ghost"
        size="sm"
        disabled={isEmpty}
        iconEnd={isEmpty ? undefined : <X />}
        onClick={onClearSelection}
        tooltip={isEmpty ? undefined : 'Clear selection'}
        className="mr-2 tabular-nums"
      >
        {selectedCount} selected
      </Button>
      {compareDisabledReason ? (
        // A disabled button swallows pointer and focus events, so the wrapper owns the tooltip.
        <Tooltip>
          <TooltipTrigger render={<span className="cursor-not-allowed" tabIndex={0} />}>
            <Button size="sm" disabled tabIndex={-1} icon={<GitCompare />}>
              Compare
            </Button>
          </TooltipTrigger>
          <TooltipContent>{compareDisabledReason}</TooltipContent>
        </Tooltip>
      ) : (
        <Button size="sm" onClick={onCompare} icon={<GitCompare />}>
          Compare
        </Button>
      )}
    </div>
  );
}
