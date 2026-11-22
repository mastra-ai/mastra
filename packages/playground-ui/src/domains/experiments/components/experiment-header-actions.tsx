'use client';

import type { DatasetExperiment } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { RenameExperimentDialog } from './rename-experiment-dialog';
import type { RenameExperimentPatch } from './rename-experiment-dialog';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconDotGrid1x3Vertical } from '@/ds/icons/central/IconDotGrid1x3Vertical';
import { IconPencil } from '@/ds/icons/central/IconPencil';
import { TrashIcon } from '@/ds/icons/TrashIcon';

export interface ExperimentHeaderActionsProps {
  experiment: DatasetExperiment;
  /** When provided, renders a rename action in the actions menu. */
  onRename?: (patch: RenameExperimentPatch) => Promise<void>;
  /** When provided, renders a delete action in the actions menu. */
  onDeleteClick?: () => void;
  /** Rendered before the actions menu, e.g. a rerun button. */
  rerunSlot?: ReactNode;
}

/** Page-header actions for an experiment: the rerun slot, then the rename/delete menu. */
export function ExperimentHeaderActions({
  experiment,
  onRename,
  onDeleteClick,
  rerunSlot,
}: ExperimentHeaderActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false);

  const hasMenu = Boolean(onRename) || Boolean(onDeleteClick);

  return (
    <>
      {rerunSlot}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Experiment actions menu">
                <IconDotGrid1x3Vertical />
              </Button>
            }
          />
          <DropdownMenu.Content align="end" className="w-48">
            {onRename && (
              <DropdownMenu.Item onSelect={() => setRenameOpen(true)}>
                <IconPencil /> Rename experiment
              </DropdownMenu.Item>
            )}
            {onDeleteClick && (
              <DropdownMenu.Item onSelect={onDeleteClick} variant="destructive">
                <TrashIcon /> Delete experiment
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      )}

      {/* Mounted on demand so the form state is seeded from the experiment each time it opens. */}
      {onRename && renameOpen && (
        <RenameExperimentDialog experiment={experiment} open onOpenChange={setRenameOpen} onRename={onRename} />
      )}
    </>
  );
}
