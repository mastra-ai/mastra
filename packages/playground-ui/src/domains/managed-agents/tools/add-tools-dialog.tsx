import { AddToolsForm } from './add-tools-form';
import type { CatalogTool } from './catalog-tool';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';

export type { CatalogTool } from './catalog-tool';

export interface AddToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: CatalogTool[];
  onAdd: (ids: string[]) => void;
}

export function AddToolsDialog({ open, onOpenChange, catalog, onAdd }: AddToolsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add tools</DialogTitle>
        </DialogHeader>
        <AddToolsForm
          catalog={catalog}
          onCancel={() => onOpenChange(false)}
          onAdd={ids => {
            onAdd(ids);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
