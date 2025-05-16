import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VersionHistory } from './components/version-history';
import type { PromptVersion } from './types';

export interface VersionHistoryDialogProps {
  versions: PromptVersion[];
  onDelete: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetActive: (version: PromptVersion, index: number) => Promise<void>;
  isUpdating: boolean;
}

export const VersionHistoryDialog = ({
  open,
  onOpenChange,
  onDelete,
  onSetActive,
  versions,
  isUpdating,
}: VersionHistoryDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
          <DialogDescription>View the history of changes to the agent's instructions.</DialogDescription>
        </DialogHeader>

        <VersionHistory
          versions={versions}
          isUpdating={isUpdating}
          copiedVersions={{}}
          onSetActive={onSetActive}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  );
};
