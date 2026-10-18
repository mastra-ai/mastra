import { useRef, useState } from 'react';
import { PdfPreviewDialog, TxtPreviewDialog } from './attachment-preview-dialog';
import { attachmentInfo, attachmentName, textAttachment } from './message-attachment-info';
import { MessageImageAttachment } from './message-image-attachment';
import { AttachmentCard } from '@/ds/components/AttachmentCard';
import { isBrowserFetchableUrl } from '@/lib/file';

export interface MessageAttachmentProps {
  type: 'image' | 'document' | 'file';
  contentType?: string;
  src?: string;
  data?: string;
  name?: string;
}

export function MessageAttachment({ type, contentType, src, data, name }: MessageAttachmentProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isPdf = type === 'document' && contentType === 'application/pdf';
  const text = textAttachment(data ?? '', name);
  const fallback =
    type === 'image' ? 'Image' : isPdf ? 'PDF document' : type === 'document' ? 'Text attachment' : 'File';
  const filename = attachmentName(type === 'document' && !isPdf ? text.name : name, src, fallback);
  const { Icon, label } = attachmentInfo(filename, contentType ?? (type === 'image' ? 'image/*' : undefined));
  const href = src && isBrowserFetchableUrl(src) ? src : undefined;
  const pdfSource =
    href ||
    (data?.startsWith('data:application/pdf') ? data : data ? `data:application/pdf;base64,${data}` : undefined);
  const canPreview = type === 'document' && (!isPdf || Boolean(pdfSource));

  if (type === 'image') {
    return (
      <MessageImageAttachment key={src} src={src ?? ''} name={filename} typeLabel={label === '*' ? 'Image' : label} />
    );
  }
  return (
    <>
      <AttachmentCard
        buttonRef={triggerRef}
        name={filename}
        typeLabel={label}
        icon={<Icon className="size-5" />}
        onClick={canPreview ? () => setOpen(true) : undefined}
        href={href}
      />
      {isPdf ? (
        <PdfPreviewDialog
          data={pdfSource ?? ''}
          title={filename}
          open={open}
          onOpenChange={setOpen}
          returnFocusRef={triggerRef}
        />
      ) : type === 'document' ? (
        <TxtPreviewDialog
          data={text.data}
          title={filename}
          open={open}
          onOpenChange={setOpen}
          returnFocusRef={triggerRef}
        />
      ) : undefined}
    </>
  );
}
