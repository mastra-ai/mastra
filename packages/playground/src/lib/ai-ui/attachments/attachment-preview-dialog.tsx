import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogBody,
} from '@mastra/playground-ui/components/Dialog';
import { File as FileIcon, FileAudio, FileText, FileVideo } from 'lucide-react';
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

interface FileChipEntryProps {
  /** Display label (usually the filename or URL). */
  name: string;
  /** A browser-fetchable URL (http/https) to link out to, when available. */
  url?: string;
  /** MIME type used to pick a representative icon. */
  contentType?: string;
}

/** Picks an icon (and a11y label) representing the file's media type. */
const iconForContentType = (contentType?: string) => {
  if (contentType?.startsWith('video/')) return { Icon: FileVideo, label: 'Video file' };
  if (contentType?.startsWith('audio/')) return { Icon: FileAudio, label: 'Audio file' };
  if (contentType?.startsWith('text/') || contentType === 'application/pdf')
    return { Icon: FileText, label: 'Document file' };
  return { Icon: FileIcon, label: 'File' };
};

/**
 * Placeholder chip for media the browser cannot preview inline — e.g. video, or
 * any cloud-storage URI (`gs://`, `s3://`) that only the model provider can fetch
 * server-side. The icon reflects the file's media type. Links out when the URL is
 * browser-fetchable (http/https).
 */
export const FileChipEntry = ({ name, url, contentType }: FileChipEntryProps) => {
  const { Icon, label } = iconForContentType(contentType);
  const icon = <Icon className="text-accent2" aria-label={label} />;

  if (url) {
    return (
      <a href={url} className={ctaClassName} target="_blank" rel="noreferrer noopener" title={name}>
        {icon}
      </a>
    );
  }

  return (
    <div className={ctaClassName} title={name}>
      {icon}
    </div>
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
        <img src={src} className="aspect-ratio max-h-[140px] max-w-[320px] object-cover" alt="Preview" />
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
      <DialogContent className="h-[80vh] max-w-4xl">
        <DialogHeader>
          <DialogTitle>Text preview</DialogTitle>
          <DialogDescription>Preview of the text file</DialogDescription>
        </DialogHeader>
        <DialogBody>{open && <div className="whitespace-pre-wrap">{data}</div>}</DialogBody>
      </DialogContent>
    </Dialog>
  );
};
