import React from 'react';

import { DeleteDialog } from '@/app/components/dialogs/delete-dialog';

interface Props {
  isOpen: boolean;
  blueprintId: string;
  onDelete?: () => void;
  setOpen: (open: boolean) => void;
}

export const DeleteWorkflowDialog: React.FC<Props> = ({ isOpen, setOpen, blueprintId, onDelete }) => {
  const handleDelete = () => {
    //write to json file
    setOpen(false);
    onDelete?.();
  };

  return (
    <DeleteDialog
      isOpen={isOpen}
      setOpen={setOpen}
      onDelete={handleDelete}
      title={
        <span>
          Are you sure you want to delete <span className="font-semibold">this workflow</span>?
        </span>
      }
    />
  );
};
