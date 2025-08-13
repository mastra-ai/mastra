import type * as AIV4 from '../ai-sdk-4/';
import type { ImagePart } from '../ai-sdk-4/core/prompt/content-part';

type ContentPart = AIV4.TextUIPart | AIV4.FileUIPart | ImagePart;

/**
 * Converts a list of attachments to a list of content parts
 * for consumption by `ai/core` functions.
 * Currently only supports images and text attachments.
 */
export function attachmentsToParts(attachments: AIV4.Attachment[]): ContentPart[] {
  const parts: ContentPart[] = [];

  for (const attachment of attachments) {
    let url;

    try {
      url = new URL(attachment.url);
    } catch {
      throw new Error(`Invalid URL: ${attachment.url}`);
    }

    switch (url.protocol) {
      case 'http:':
      case 'https:': {
        if (!attachment.contentType) {
          throw new Error("Attachments must have a contentType but one wasn't found");
        }

        // Check if this is an image type
        if (attachment.contentType.startsWith('image/')) {
          parts.push({
            type: 'image',
            image: url.toString(),
            mimeType: attachment.contentType,
          } as ImagePart);
        } else {
          parts.push({
            type: 'file',
            data: url.toString(),
            mimeType: attachment.contentType,
          });
        }
        break;
      }

      case 'data:': {
        if (!attachment.contentType) {
          throw new Error('Data URLs must specify a content type');
        }

        // Check if this is an image type
        if (attachment.contentType.startsWith('image/')) {
          parts.push({
            type: 'image',
            image: attachment.url,
            mimeType: attachment.contentType,
          } as ImagePart);
        } else {
          parts.push({
            type: 'file',
            data: attachment.url,
            mimeType: attachment.contentType,
          });
        }

        break;
      }

      default: {
        throw new Error(`Unsupported URL protocol: ${url.protocol}`);
      }
    }
  }

  return parts;
}
