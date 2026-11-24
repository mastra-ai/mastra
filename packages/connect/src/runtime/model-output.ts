interface GeneratedImage {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

export interface ImageGenerationOutput {
  data: GeneratedImage[];
}

type ImageModelOutputPart =
  | { type: 'text'; text: string }
  | { type: 'image-url'; url: string }
  | { type: 'image-data'; data: string; mediaType: string };

function detectImageMediaType(data: string): string {
  if (data.startsWith('iVBORw0KGgo')) return 'image/png';
  if (data.startsWith('/9j/')) return 'image/jpeg';
  if (data.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

/** Keeps generated image bytes out of JSON tool context while preserving them as model-native image input. */
export function toImageGenerationModelOutput(output: ImageGenerationOutput) {
  const value: ImageModelOutputPart[] = [];

  for (const image of output.data) {
    if (image.revised_prompt) {
      value.push({ type: 'text', text: `Revised prompt: ${image.revised_prompt}` });
    }
    if (image.url) {
      value.push({ type: 'image-url', url: image.url });
    } else if (image.b64_json) {
      value.push({
        type: 'image-data',
        data: image.b64_json,
        mediaType: detectImageMediaType(image.b64_json),
      });
    }
  }

  if (value.length === 0) {
    return { type: 'text' as const, value: 'Image generation completed.' };
  }

  return { type: 'content' as const, value };
}
