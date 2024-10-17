import React from 'react';

import { DeleteDialog } from '@/components/dialogs/delete-dialog';

import { useDeleteWorkflow } from '../../hooks/use-workflow';

interface Props {
  isOpen: boolean;
  blueprintId: string;
  onDelete?: () => void;
  setOpen: (open: boolean) => void;
}

export const DeleteWorkflowDialog: React.FC<Props> = ({ isOpen, setOpen, blueprintId, onDelete }) => {
  const { deleteBlueprint, isLoading } = useDeleteWorkflow({ blueprintId });
  const handleDelete = async () => {
    await deleteBlueprint();
    setOpen(false);
    onDelete?.();
  };

  return (
    <DeleteDialog
      isOpen={isOpen}
      setOpen={setOpen}
      onDelete={handleDelete}
      isPending={isLoading}
      title={
        <span>
          Are you sure you want to delete <span className="font-semibold">this workflow</span>?
        </span>
      }
    />
  );
};
