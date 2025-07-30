import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MarkdownRenderer from '@/components/ui/markdown-renderer';
import { useEffect } from 'react';

export interface MarkdownPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  title?: string;
  description?: string;
}

export const MarkdownPreviewDialog = ({
  open,
  onOpenChange,
  content,
  title = 'Markdown Preview',
  description = 'Preview of your markdown content',
}: MarkdownPreviewDialogProps) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    if (open) {
      document.addEventListener('keydown', handleEscape, false);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape, false);
    };
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto min-w-[400px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 p-4 bg-surface3 border border-border1 rounded-lg">
          <div className="min-w-0">
            <MarkdownRenderer>{content}</MarkdownRenderer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 