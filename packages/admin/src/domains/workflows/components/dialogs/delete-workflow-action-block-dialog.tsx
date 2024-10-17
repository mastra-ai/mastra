import React from 'react';

import { DeleteDialog } from '@/components/dialogs/delete-dialog';

interface Props {
  isOpen: boolean;
  onDelete: () => void;
  setOpen: (open: boolean) => void;
  type?: 'action' | 'path';
}

export const DeleteWorkflowActionBlockDialog = ({ isOpen, setOpen, onDelete, type = 'action' }: Props) => {
  const handleDelete = () => {
    onDelete();
    setOpen(false);
  };

  return (
    <DeleteDialog
      isOpen={isOpen}
      setOpen={setOpen}
      onDelete={handleDelete}
      title={
        <span>
          Are you sure you want to delete <span className="font-semibold">this workflow {type}</span>?
        </span>
      }
      description="All children actions will be permanently deleted."
    />
  );
};
