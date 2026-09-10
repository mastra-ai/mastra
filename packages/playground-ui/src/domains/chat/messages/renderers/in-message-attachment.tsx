import { ImageEntry, PdfEntry, TxtEntry, FileChipEntry } from '../../attachments/attachment-preview-dialog';

export interface InMessageAttachmentProps {
  type: 'image' | 'document' | 'file';
  contentType?: string;
  src?: string;
  data?: string;
  /** Display label for `file` chips (filename or URI). */
  name?: string;
}

/**
 * Renders an attachment preview inline in a message: image, PDF, plain text, or a
 * placeholder chip for media the browser cannot preview (video, gs://, s3://).
 */
export const InMessageAttachment = ({ type, contentType, src, data, name }: InMessageAttachmentProps) => (
  <div className="size-full overflow-hidden rounded-lg">
    {type === 'image' ? (
      <ImageEntry src={src ?? ''} />
    ) : type === 'file' ? (
      <FileChipEntry name={name ?? src ?? data ?? 'file'} url={src} contentType={contentType} />
    ) : type === 'document' && contentType === 'application/pdf' ? (
      <PdfEntry data={data ?? ''} url={src} />
    ) : (
      <TxtEntry data={data ?? ''} />
    )}
  </div>
);
