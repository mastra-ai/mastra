import { DeleteExperimentsButton } from './delete-experiments-button';
import { Button } from '@/ds/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { IconChanges } from '@/ds/icons/central/IconChanges';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

export interface ExperimentsBulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onCompare: () => void;
  /** When set, Compare is disabled and this reason is shown in its tooltip. */
  compareDisabledReason?: string;
  /** Deletes one experiment; the bulk Delete button is hidden without it. */
  onDeleteExperiment?: (experimentId: string) => Promise<void>;
}

/** Selection count (a button clearing the selection once non-empty), plus Delete (when the call site can delete) and Compare, explained when disabled. */
export function ExperimentsBulkActions({
  selectedIds,
  onClearSelection,
  onCompare,
  compareDisabledReason,
  onDeleteExperiment,
}: ExperimentsBulkActionsProps) {
  const selectedCount = selectedIds.length;
  const isEmpty = selectedCount === 0;

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <Button
        variant="ghost"
        size="sm"
        disabled={isEmpty}
        iconEnd={isEmpty ? undefined : <IconCrossMedium />}
        onClick={onClearSelection}
        tooltip={isEmpty ? undefined : 'Clear selection'}
        className="mr-2 tabular-nums"
      >
        {selectedCount} selected
      </Button>
      {onDeleteExperiment && (
        <DeleteExperimentsButton
          experimentIds={selectedIds}
          onDeleteExperiment={onDeleteExperiment}
          onDeleted={onClearSelection}
        />
      )}
      {compareDisabledReason ? (
        // A disabled button swallows pointer and focus events, so the wrapper owns the tooltip.
        <Tooltip>
          <TooltipTrigger render={<span className="cursor-not-allowed" tabIndex={0} />}>
            <Button size="sm" disabled tabIndex={-1} icon={<IconChanges />}>
              Compare
            </Button>
          </TooltipTrigger>
          <TooltipContent>{compareDisabledReason}</TooltipContent>
        </Tooltip>
      ) : (
        <Button size="sm" onClick={onCompare} icon={<IconChanges />}>
          Compare
        </Button>
      )}
    </div>
  );
}
