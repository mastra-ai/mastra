import { File as FileIcon, FileAudio, FileText, FileVideo } from 'lucide-react';
import { useState } from 'react';
import type { RefObject } from 'react';
import { ComposerAttachmentEntry } from './composer-attachment-entry';
import { Button } from '@/ds/components/Button';
import { Dialog, DialogTitle, DialogContent, DialogHeader, DialogBody } from '@/ds/components/Dialog';
import { cn } from '@/utils/cn';

interface PdfEntryProps {
  data: string;
  url?: string;
}

const ctaClassName =
  'h-full w-full flex items-center justify-center rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus [&:is(button,a)]:cursor-pointer';
const fileTypeIconClassName = 'text-badge-red-indicator';

export const PdfEntry = ({ data, url }: PdfEntryProps) => {
  const [open, setOpen] = useState(false);

  if (url) {
    return (
      <a href={url} className={ctaClassName} target="_blank" rel="noreferrer noopener">
        <ComposerAttachmentEntry>
          <FileText className={fileTypeIconClassName} aria-label="View PDF" />
        </ComposerAttachmentEntry>
      </a>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={ctaClassName} type="button">
        <ComposerAttachmentEntry>
          <FileText className={fileTypeIconClassName} aria-label="View PDF" />
        </ComposerAttachmentEntry>
      </button>

      <PdfPreviewDialog data={data} open={open} onOpenChange={setOpen} />
    </>
  );
};

interface PdfPreviewDialogProps {
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  data: string;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PdfPreviewDialog = ({ data, title, open, onOpenChange, returnFocusRef }: PdfPreviewDialogProps) => {
  const isInlinePdf = data.startsWith('data:application/pdf');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" finalFocus={returnFocusRef}>
        <DialogHeader>
          <DialogTitle>{title ?? 'PDF preview'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {open && (
            <>
              <iframe src={data} title={title ?? 'PDF preview'} className="h-[60dvh] w-full" />
              <Button
                render={
                  <a
                    href={data}
                    download={isInlinePdf ? (title ?? 'attachment.pdf') : undefined}
                    target={isInlinePdf ? undefined : '_blank'}
                    rel="noreferrer noopener"
                  />
                }
                size="sm"
                className="mt-3"
              >
                {isInlinePdf ? 'Download PDF' : 'Open PDF in a new tab'}
              </Button>
            </>
          )}
        </DialogBody>
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
  const icon = <Icon className={fileTypeIconClassName} aria-label={label} />;

  if (url) {
    return (
      <a href={url} className={ctaClassName} target="_blank" rel="noreferrer noopener" title={name}>
        <ComposerAttachmentEntry>{icon}</ComposerAttachmentEntry>
      </a>
    );
  }

  return (
    <div className={ctaClassName} title={name}>
      <ComposerAttachmentEntry>{icon}</ComposerAttachmentEntry>
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
        <ComposerAttachmentEntry variant="image">
          <img src={src} className="aspect-ratio max-h-35 max-w-full object-cover" alt={name ?? 'Preview'} />
        </ComposerAttachmentEntry>
      </button>
      <ImagePreviewDialog src={src} open={open} onOpenChange={setOpen} />
    </>
  );
};

interface ImagePreviewDialogProps {
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImagePreviewDialog = ({ src, open, onOpenChange, returnFocusRef }: ImagePreviewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" finalFocus={returnFocusRef}>
        <DialogHeader>
          <DialogTitle>Image preview</DialogTitle>
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
      <button
        onClick={() => setOpen(true)}
        className={cn(ctaClassName, 'min-w-0')}
        type="button"
        aria-label={filename ? `Preview ${filename}` : 'Preview text attachment'}
        title={filename}
      >
        <ComposerAttachmentEntry name={filename}>
          <FileText className={fileTypeIconClassName} aria-hidden="true" />
        </ComposerAttachmentEntry>
      </button>
      <TxtPreviewDialog data={formattedContent} title={filename} open={open} onOpenChange={setOpen} />
    </>
  );
};

interface TxtPreviewDialogProps {
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  data: string;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TxtPreviewDialog = ({ data, title, open, onOpenChange, returnFocusRef }: TxtPreviewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" finalFocus={returnFocusRef}>
        <DialogHeader>
          <DialogTitle>{title ?? 'Text preview'}</DialogTitle>
        </DialogHeader>
        <DialogBody>{open && <div className="whitespace-pre-wrap">{data}</div>}</DialogBody>
      </DialogContent>
    </Dialog>
  );
};
