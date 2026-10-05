import { ImageEntry, PdfEntry, TxtEntry, FileChipEntry } from './attachment-preview-dialog';

export interface MessageAttachmentProps {
  type: 'image' | 'document' | 'file';
  contentType?: string;
  src?: string;
  data?: string;
  name?: string;
}
export const MessageAttachment = ({ type, contentType, src, data, name }: MessageAttachmentProps) => (
  <div className="size-full overflow-hidden rounded-lg" title={name}>
    {type === 'image' ? (
      <ImageEntry src={src ?? ''} name={name} />
    ) : type === 'file' ? (
      <FileChipEntry name={name ?? src ?? data ?? 'file'} url={src} contentType={contentType} />
    ) : type === 'document' && contentType === 'application/pdf' ? (
      <PdfEntry data={data ?? ''} url={src} />
    ) : (
      <TxtEntry data={data ?? ''} name={name} />
    )}
  </div>
);
