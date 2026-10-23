import { Spinner } from '@mastra/playground-ui/components/Spinner';
import {
  ImageEntry,
  TxtEntry,
  PdfEntry,
  FileChipEntry,
} from '@mastra/playground-ui/domains/chat/attachments/attachment-preview-dialog';
import { ComposerAttachment as ComposerAttachmentPreview } from '@mastra/playground-ui/domains/chat/attachments/composer-attachment';
import { ComposerAttachmentList } from '@mastra/playground-ui/domains/chat/attachments/composer-attachment-list';
import type { AttachmentPreviewProps } from '@mastra/playground-ui/domains/chat/attachments/use-attachment-preview';
import { fileToBase64, isBrowserFetchableUrl } from '@mastra/playground-ui/utils/file';
import { useEffect, useState } from 'react';

import { useLoadBrowserFile } from '../hooks/use-load-browser-file';
import { useComposerAttachments } from './composer-attachments';
import type { ComposerAttachment } from './composer-attachments';

const ComposerTxtAttachment = ({ file, ...previewProps }: { file: File } & AttachmentPreviewProps) => {
  const { isLoading, text } = useLoadBrowserFile(file);

  return isLoading ? <Spinner /> : <TxtEntry data={text} name={file.name} {...previewProps} />;
};

const ComposerPdfAttachment = ({
  attachment,
  ...previewProps
}: { attachment: ComposerAttachment } & AttachmentPreviewProps) => {
  const [state, setState] = useState({ isLoading: false, text: '' });
  useEffect(() => {
    let isCanceled = false;

    const run = async () => {
      if (!attachment.file) return;
      setState(s => ({ ...s, isLoading: true }));
      const text = await fileToBase64(attachment.file);
      if (isCanceled) {
        return;
      }
      setState(s => ({ ...s, isLoading: false, text }));
    };
    void run();

    return () => {
      isCanceled = true;
    };
  }, [attachment]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      {state.isLoading ? (
        <Spinner />
      ) : (
        <PdfEntry data={state.text} url={attachment.isUrl ? attachment.name : undefined} {...previewProps} />
      )}
    </div>
  );
};

const ImageAttachmentThumbnail = ({
  attachment,
  ...previewProps
}: { attachment: ComposerAttachment } & AttachmentPreviewProps) => {
  const [src, setSrc] = useState<string>(attachment.isUrl ? attachment.name : '');

  useEffect(() => {
    if (attachment.isUrl) {
      setSrc(attachment.name);
      return;
    }
    const url = URL.createObjectURL(attachment.file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  return <ImageEntry src={src} name={attachment.name} {...previewProps} />;
};

const AttachmentPreview = ({
  attachment,
  ...previewProps
}: { attachment: ComposerAttachment } & AttachmentPreviewProps) => {
  if (attachment.kind === 'image') return <ImageAttachmentThumbnail attachment={attachment} {...previewProps} />;
  if (attachment.kind === 'pdf') return <ComposerPdfAttachment attachment={attachment} {...previewProps} />;
  if (attachment.kind === 'text' && !attachment.isUrl)
    return <ComposerTxtAttachment file={attachment.file} {...previewProps} />;

  return (
    <FileChipEntry
      name={attachment.name}
      url={attachment.isUrl && isBrowserFetchableUrl(attachment.name) ? attachment.name : undefined}
      contentType={attachment.contentType}
    />
  );
};

function canPreviewAttachment(attachment: ComposerAttachment) {
  if (attachment.kind === 'image') return true;
  if (attachment.isUrl) return isBrowserFetchableUrl(attachment.name);
  return attachment.kind === 'pdf' || attachment.kind === 'text';
}

export const ComposerAttachments = () => {
  const { attachments, remove } = useComposerAttachments();
  const [previewId, setPreviewId] = useState<string>();

  function openPreview(attachment: ComposerAttachment) {
    if (attachment.isUrl && attachment.kind !== 'image') {
      window.open(attachment.name, '_blank', 'noopener,noreferrer');
      return;
    }
    setPreviewId(attachment.id);
  }

  if (attachments.length === 0) return null;

  return (
    <ComposerAttachmentList data-testid="composer-attachments">
      {attachments.map(att => (
        <ComposerAttachmentPreview
          key={att.id}
          name={att.name}
          onRemove={() => remove(att.id)}
          onPreview={canPreviewAttachment(att) ? () => openPreview(att) : undefined}
          variant={att.kind === 'text' ? 'inline' : 'thumbnail'}
        >
          <AttachmentPreview
            attachment={att}
            open={previewId === att.id}
            onOpenChange={open => setPreviewId(open ? att.id : undefined)}
          />
        </ComposerAttachmentPreview>
      ))}
    </ComposerAttachmentList>
  );
};
