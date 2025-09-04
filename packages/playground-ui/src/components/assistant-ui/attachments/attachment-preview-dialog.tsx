import { Dialog, DialogTitle, DialogContent } from '@/components/ui/dialog';
import { FileText } from 'lucide-react';
import { useState } from 'react';

interface PdfEntryProps {
  data: string;
  url?: string;
}

const ctaClassName = 'h-full w-full flex items-center justify-center';

export const PdfEntry = ({ data, url }: PdfEntryProps) => {
  const [open, setOpen] = useState(false);

  if (url) {
    return (
      <a href={url} className={ctaClassName} target="_blank" rel="noreferrer noopener">
        <FileText className="text-accent2" aria-label="View PDF" />
      </a>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={ctaClassName} type="button">
        <FileText className="text-accent2" aria-label="View PDF" />
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
}

export const ImageEntry = ({ src }: ImageEntryProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} type="button" className={ctaClassName}>
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

export const ImagePreviewDialog = ({ src, open, onOpenChange }: ImagePreviewDialogProps) => {
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
}

export const TxtEntry = ({ data }: TxtEntryProps) => {
  const [open, setOpen] = useState(false);

  // assistant-ui wraps txt related files with somethign like <attachment name=text.txt>
  // We remove the <attachment> tag and everything inside it
  const formattedContent = data.replace(/<attachment[^>]*>/, '').replace(/<\/attachment>/g, '');

  return (
    <>
      <button onClick={() => setOpen(true)} className={ctaClassName} type="button">
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
