import { ImageEntry, PdfEntry, TxtEntry } from '../../attachments/attachment-preview-dialog';

export interface InMessageAttachmentProps {
  type: 'image' | 'document';
  contentType?: string;
  src?: string;
  data?: string;
}

/**
 * Renders an attachment preview inline in a message: image, PDF, or plain text.
 */
export const InMessageAttachment = ({ type, contentType, src, data }: InMessageAttachmentProps) => (
  <div className="h-full w-full overflow-hidden rounded-lg">
    {type === 'image' ? (
      <ImageEntry src={src ?? ''} />
    ) : type === 'document' && contentType === 'application/pdf' ? (
      <PdfEntry data={data ?? ''} url={src} />
    ) : (
      <TxtEntry data={data ?? ''} />
    )}
  </div>
);
