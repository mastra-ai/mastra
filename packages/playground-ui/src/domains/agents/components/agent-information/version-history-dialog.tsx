import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VersionHistory } from './version-history';

export interface VersionHistoryDialogProps {
  versions: any[];
  onDelete: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetActive: (version: any, index: number) => Promise<void>;
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
      <DialogContent className="bg-surface4">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
          <DialogDescription>View the history of changes to the agent's instructions.</DialogDescription>
        </DialogHeader>

        <VersionHistory
          versions={versions}
          isUpdating={isUpdating}
          copiedVersions={{}}
          onCopy={async (content: string, key: string | number) => {
            await navigator.clipboard.writeText(content);
          }}
          onSetActive={onSetActive}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  );
};
