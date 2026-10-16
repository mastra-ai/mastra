import type { DatasetExperiment } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { RenameExperimentDialog } from '@/domains/experiments/components/rename-experiment-dialog';
import { RerunExperimentButton } from '@/domains/experiments/components/rerun-experiment-button';

export interface ExperimentHeaderActionsProps {
  experiment: DatasetExperiment;
  /** When provided, renders a delete action in the actions menu. */
  onDeleteClick?: () => void;
}

/** Page-header actions for an experiment: Rerun, then the rename/delete menu. */
export function ExperimentHeaderActions({ experiment, onDeleteClick }: ExperimentHeaderActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false);

  // The rename route is dataset-scoped, so caller-run experiments without a dataset can't be renamed.
  const canRename = Boolean(experiment.datasetId);
  const hasMenu = canRename || Boolean(onDeleteClick);

  return (
    <>
      <RerunExperimentButton experiment={experiment} />
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Experiment actions menu">
              <MoreVertical />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" className="w-48">
            {canRename && (
              <DropdownMenu.Item onSelect={() => setRenameOpen(true)}>
                <Pencil /> Rename Experiment
              </DropdownMenu.Item>
            )}
            {onDeleteClick && (
              <DropdownMenu.Item onSelect={onDeleteClick} variant="destructive">
                <Trash2 /> Delete Experiment
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      )}

      {/* Mounted on demand so the form state is seeded from the experiment each time it opens. */}
      {renameOpen && <RenameExperimentDialog experiment={experiment} open onOpenChange={setRenameOpen} />}
    </>
  );
}
