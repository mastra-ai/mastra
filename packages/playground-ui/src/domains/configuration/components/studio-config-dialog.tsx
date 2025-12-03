import { Dialog, DialogContent, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { StudioConfigForm } from './studio-config-form';
import { useStudioConfig } from '../context/studio-config-context';

export interface StudioConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StudioConfigDialog = ({ open, onOpenChange }: StudioConfigDialogProps) => {
  const { baseUrl, headers } = useStudioConfig();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogContent className="bg-surface1">
          <DialogTitle>Studio Configuration</DialogTitle>
          {open && <StudioConfigForm initialConfig={{ baseUrl, headers }} />}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};
