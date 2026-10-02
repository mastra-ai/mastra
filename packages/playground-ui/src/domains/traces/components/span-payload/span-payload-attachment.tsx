import { SpanPayloadJson } from './span-payload-json';
import { InMessageAttachment } from '@/domains/chat/messages/renderers/in-message-attachment';

export function SpanPayloadAttachment({ value }: { value: unknown }) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return <SpanPayloadJson value={value} />;
  const part = value as Record<string, unknown>;
  const src = part.url ?? part.image ?? part.data;
  const contentType = part.mediaType ?? part.mimeType;
  if (typeof src !== 'string' || !/^https?:\/\//i.test(src)) return <SpanPayloadJson value={value} />;
  try {
    const url = new URL(src);
    if (url.username || url.password) return <SpanPayloadJson value={value} />;
  } catch {
    return <SpanPayloadJson value={value} />;
  }
  const name =
    typeof part.filename === 'string' ? part.filename : typeof part.name === 'string' ? part.name : undefined;
  return (
    <InMessageAttachment
      type={
        part.type === 'image' || (typeof contentType === 'string' && contentType.startsWith('image/'))
          ? 'image'
          : 'file'
      }
      contentType={typeof contentType === 'string' ? contentType : undefined}
      src={src}
      name={name}
    />
  );
}
