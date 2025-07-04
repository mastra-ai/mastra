import { Dialog, DialogTitle, DialogContent } from '@/components/ui/dialog';
import { FileText } from 'lucide-react';
import { ReactNode, useState } from 'react';

type Variants = 'default' | 'badge';

const variantClasses = {
  default: 'h-full w-full flex items-center justify-center',
  badge: 'h-full w-full flex items-center gap-2 border-border1 bg-surface3 border-sm rounded-lg p-2',
};

interface PdfEntryProps {
  data: string;
  nameSlot: ReactNode;
  variant?: Variants;
}

export const PdfEntry = ({ data, variant = 'default', nameSlot }: PdfEntryProps) => {
  const [open, setOpen] = useState(false);
  const variantClass = variantClasses[variant];

  return (
    <>
      <button onClick={() => setOpen(true)} className={variantClass} type="button">
        <FileText className="text-accent2" />
        {variant === 'badge' && <span className="text-ui-sm text-icon3 truncate">{nameSlot}</span>}
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
      <button onClick={() => setOpen(true)} type="button" className="h-full w-full flex items-center justify-center">
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
  nameSlot: ReactNode;
  variant?: Variants;
}

export const TxtEntry = ({ data, variant = 'default', nameSlot }: TxtEntryProps) => {
  const [open, setOpen] = useState(false);
  const variantClass = variantClasses[variant];

  // assistant-ui wraps txt related files with somethign like <attachment name=text.txt>
  // We remove the <attachment> tag and everything inside it
  const formattedContent = data.replace(/<attachment[^>]*>/, '').replace(/<\/attachment>/g, '');

  return (
    <>
      <button onClick={() => setOpen(true)} className={variantClass} type="button">
        <FileText className="text-icon3" />
        {variant === 'badge' && <span className="text-ui-sm text-icon3 truncate">{nameSlot}</span>}
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
