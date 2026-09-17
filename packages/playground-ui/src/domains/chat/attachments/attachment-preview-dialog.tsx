import { File as FileIcon, FileAudio, FileText, FileVideo } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogBody,
} from '@/ds/components/Dialog';

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
      <DialogContent className="max-w-4xl motion-reduce:animate-none!" overlayClassName="motion-reduce:animate-none!">
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
  name: string;
  url?: string;
  contentType?: string;
}
const iconForContentType = (contentType?: string) => {
  if (contentType?.startsWith('video/')) return { Icon: FileVideo, label: 'Video file' };
  if (contentType?.startsWith('audio/')) return { Icon: FileAudio, label: 'Audio file' };
  if (contentType?.startsWith('text/') || contentType === 'application/pdf')
    return { Icon: FileText, label: 'Document file' };
  return { Icon: FileIcon, label: 'File' };
};
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
  name?: string;
}

export const ImageEntry = ({ src, name }: ImageEntryProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        type="button"
        className={ctaClassName}
        aria-label={name ? `Preview ${name}` : 'Preview image'}
      >
        <img src={src} className="aspect-ratio max-h-35 max-w-full object-cover" alt={name ?? 'Preview'} />
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
      <DialogContent className="max-w-4xl motion-reduce:animate-none!" overlayClassName="motion-reduce:animate-none!">
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
  name?: string;
}

export const TxtEntry = ({ data, name }: TxtEntryProps) => {
  const [open, setOpen] = useState(false);

  const formattedContent =
    name === undefined ? (data.match(/^<attachment[^>]*>([\s\S]*)<\/attachment>$/)?.[1] ?? data) : data;
  const filename =
    name ??
    data
      .match(/^<attachment name="([^"]*)">/)?.[1]
      ?.replaceAll('&quot;', '"')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&');

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className="max-w-64 min-w-0 pointer-coarse:min-h-11"
        type="button"
        aria-label={filename ? `Preview ${filename}` : 'Preview text attachment'}
        title={filename}
        icon={<FileText />}
      >
        {filename && <span className="truncate">{filename}</span>}
      </Button>
      <TxtPreviewDialog data={formattedContent} title={filename} open={open} onOpenChange={setOpen} />
    </>
  );
};

interface TxtPreviewDialogProps {
  data: string;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TxtPreviewDialog = ({ data, title, open, onOpenChange }: TxtPreviewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[80vh] max-w-4xl motion-reduce:animate-none!"
        overlayClassName="motion-reduce:animate-none!"
      >
        <DialogHeader>
          <DialogTitle>{title ?? 'Text preview'}</DialogTitle>
          <DialogDescription>Preview of the text file</DialogDescription>
        </DialogHeader>
        <DialogBody>{open && <div className="whitespace-pre-wrap">{data}</div>}</DialogBody>
      </DialogContent>
    </Dialog>
  );
};
