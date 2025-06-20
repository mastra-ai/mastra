import { FileText } from 'lucide-react';
import { FC, useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface PdfEntryProps {
  data: string;
  className?: string;
}

export const PdfEntry = ({ data, className }: PdfEntryProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className={className} type="button">
        <FileText className="text-accent2" />
      </button>

      <PdfPreviewDialog data={data} open={open} onOpenChange={setOpen} />
    </>
  );
};

interface PdfPreviewDialogProps {
  data: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PdfPreviewDialog = ({ data, open, onOpenChange }: PdfPreviewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-surface2">
        <div className="h-full w-full">
          <DialogTitle className="pb-4">PDF preview</DialogTitle>
          {open && <iframe src={data} width="100%" height="600px"></iframe>}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface ImageEntryProps {
  src: string;
  className?: string;
}

export const ImageEntry = ({ src, className }: ImageEntryProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className={className} type="button">
        <img src={src} className="object-cover aspect-ratio max-h-[140px] max-w-[320px]" alt="Preview" />
      </button>
      <ImagePreviewDialog src={src} open={open} onOpenChange={setOpen} />
    </>
  );
};

interface ImagePreviewDialogProps {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImagePreviewDialog: FC<ImagePreviewDialogProps> = ({ src, open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-surface2">
        <div className="h-full w-full">
          <DialogTitle className="pb-4">Image preview</DialogTitle>
          {open && <img src={src} alt="Image" />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface TxtEntryProps {
  data: string;
  className?: string;
}

export const TxtEntry = ({ data, className }: TxtEntryProps) => {
  const [open, setOpen] = useState(false);

  // assistant-ui wraps txt related files with somethign like <attachment name=text.txt>
  // We remove the <attachment> tag and everything inside it
  const formattedContent = data.replace(/<attachment[^>]*>/, '').replace(/<\/attachment>/g, '');

  return (
    <>
      <button onClick={() => setOpen(true)} className={className} type="button">
        <FileText className="text-icon3" />
      </button>
      <TxtPreviewDialog data={formattedContent} open={open} onOpenChange={setOpen} />
    </>
  );
};

interface TxtPreviewDialogProps {
  data: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TxtPreviewDialog = ({ data, open, onOpenChange }: TxtPreviewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-surface2 h-[80vh] overflow-y-auto">
        <div className="h-full w-full">
          <DialogTitle className="pb-4">Text preview</DialogTitle>
          {open && <div className="whitespace-pre-wrap">{data}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
