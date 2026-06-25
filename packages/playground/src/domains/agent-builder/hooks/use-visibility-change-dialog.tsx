import { toast } from '@mastra/playground-ui';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { useState } from 'react';
import type { ReactNode } from 'react';

export interface VisibilityCopy {
  title: string;
  description: string;
  toast: string;
}

export interface VisibilityDialogTestIds {
  dialog: string;
  cancel: string;
  confirm: string;
}

export interface UseVisibilityChangeDialogArgs<V extends string> {
  copy: Record<V, VisibilityCopy>;
  isPending: boolean;
  mutate: (visibility: V) => Promise<unknown>;
  onSuccess: (visibility: V) => void;
  testIds: VisibilityDialogTestIds;
  /** Optional extra content rendered inside the dialog, given the pending target visibility. */
  renderExtraContent?: (pending: V) => ReactNode;
  /** Optional extra condition that disables the confirm button (e.g. while a dependents lookup is loading). */
  confirmDisabled?: (pending: V) => boolean;
}

export interface UseVisibilityChangeDialogResult<V extends string> {
  requestChange: (next: V) => void;
  dialog: ReactNode;
}

export function useVisibilityChangeDialog<V extends string>({
  copy,
  isPending,
  mutate,
  onSuccess,
  testIds,
  renderExtraContent,
  confirmDisabled,
}: UseVisibilityChangeDialogArgs<V>): UseVisibilityChangeDialogResult<V> {
  const [pending, setPending] = useState<V | null>(null);
  const isOpen = pending !== null;

  const handleCancel = () => {
    setPending(null);
  };

  const confirmFor = (nextVisibility: V) => async () => {
    try {
      await mutate(nextVisibility);
      onSuccess(nextVisibility);
      toast.success(copy[nextVisibility].toast);
    } catch (error) {
      toast.error(`Failed to update visibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPending(null);
    }
  };

  const dialogCopy = pending ? copy[pending] : null;

  const dialog = (
    <Dialog open={isOpen} onOpenChange={open => !open && handleCancel()}>
      <DialogContent data-testid={testIds.dialog}>
        {pending && dialogCopy && (
          <>
            <DialogHeader>
              <DialogTitle>{dialogCopy.title}</DialogTitle>
              <DialogDescription>{dialogCopy.description}</DialogDescription>
            </DialogHeader>
            {renderExtraContent?.(pending)}
            <DialogFooter>
              <Button variant="ghost" onClick={handleCancel} disabled={isPending} data-testid={testIds.cancel}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={confirmFor(pending)}
                disabled={isPending || (confirmDisabled?.(pending) ?? false)}
                data-testid={testIds.confirm}
              >
                Confirm
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  return { requestChange: setPending, dialog };
}
