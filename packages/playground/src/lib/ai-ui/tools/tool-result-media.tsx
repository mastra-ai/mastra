import { InMessageAttachment } from '@/lib/ai-ui/messages/renderers/in-message-attachment';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const imageSource = (part: unknown): string | undefined => {
  if (
    !isRecord(part) ||
    part.type !== 'media' ||
    typeof part.data !== 'string' ||
    typeof part.mediaType !== 'string' ||
    !part.mediaType.startsWith('image/')
  ) {
    return undefined;
  }

  if (part.data.startsWith('data:') || part.data.includes('://')) return part.data;
  return `data:${part.mediaType};base64,${part.data}`;
};

const modelOutputImages = (modelOutput: unknown): string[] => {
  if (!isRecord(modelOutput) || modelOutput.type !== 'content' || !Array.isArray(modelOutput.value)) return [];
  return modelOutput.value.flatMap(part => {
    const src = imageSource(part);
    return src ? [src] : [];
  });
};

export const ToolResultMedia = ({ modelOutput }: { modelOutput?: unknown }) => {
  const images = modelOutputImages(modelOutput);
  if (images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 py-2" data-testid="tool-result-media">
      {images.map((src, index) => (
        <InMessageAttachment key={`${index}-${src.length}`} type="image" src={src} />
      ))}
    </div>
  );
};
