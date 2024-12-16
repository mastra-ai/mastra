import React, { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import Spinner from '@/components/ui/spinner';

export interface DeleteDialogProps {
  isOpen: boolean;
  setOpen?: (open: boolean) => void;
  onDelete?: () => void;
  title: string | ReactNode;
  description?: string;
  isPending?: boolean;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  isOpen,
  setOpen,
  onDelete,
  title,
  description,
  isPending = false,
}) => {
  const handleDelete = async () => {
    await onDelete?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="min-w-[550px]" overlay={false}>
        <div className="flex flex-col gap-3 p-3">
          <p className="text-lg text-neutral-50">{title}</p>
          <p className="text-sm text-neutral-100">{description}</p>
        </div>

        <DialogFooter className="-mx-3 border-t border-[color:rgba(117,117,117,0.44)] px-3 pt-3">
          <div className="flex items-center gap-3 self-end">
            <Button
              disabled={isPending}
              className="h-[30px]"
              onClick={() => setOpen?.(false)}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              className="h-[30px]"
              type="submit"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              data-testid="delete-button"
            >
              Delete
              {isPending && <Spinner className="h-4 w-4" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
