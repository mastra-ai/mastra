import { Dialog, DialogTitle, DialogContent, DialogHeader, DialogDescription, DialogBody } from '@/ds/components/Dialog';
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>PDF preview</DialogTitle>
          <DialogDescription>Preview of the PDF document</DialogDescription>
        </DialogHeader>
        <DialogBody>{open && <iframe src={data} width="100%" height="600px"></iframe>}</DialogBody>
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Image preview</DialogTitle>
          <DialogDescription>Preview of the image</DialogDescription>
        </DialogHeader>
        <DialogBody>{open && <img src={src} alt="Image" />}</DialogBody>
      </DialogContent>
    </Dialog>
  );
};

interface TxtEntryProps {
  data: string;
}

export const TxtEntry = ({ data }: TxtEntryProps) => {
  const [open, setOpen] = useState(false);

  // assistant-ui wraps txt related files with something like <attachment name=text.txt>
  // We remove the <attachment> tag and everything inside it
  const formattedContent = data.replace(/<attachment[^>]*>/, '').replace(/<\/attachment>/g, '');

  return (
    <>
      <button onClick={() => setOpen(true)} className={ctaClassName} type="button">
        <FileText className="text-neutral3" />
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
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Text preview</DialogTitle>
          <DialogDescription>Preview of the text file</DialogDescription>
        </DialogHeader>
        <DialogBody>{open && <div className="whitespace-pre-wrap">{data}</div>}</DialogBody>
      </DialogContent>
    </Dialog>
  );
};
