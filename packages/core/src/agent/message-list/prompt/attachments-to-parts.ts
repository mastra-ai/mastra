import type { Attachment } from '@ai-sdk/ui-utils-v5';
import type { FilePart, ImagePart, TextPart } from '@internal/ai-sdk-v4';

type ContentPart = TextPart | ImagePart | FilePart;

/**
 * Converts a list of attachments to a list of content parts
 * for consumption by `ai/core` functions.
 * Currently only supports images and text attachments.
 */
export function attachmentsToParts(attachments: Attachment[]): ContentPart[] {
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
        if (attachment.contentType?.startsWith('image/')) {
          parts.push({ type: 'image', image: url.toString(), mimeType: attachment.contentType });
        } else {
          if (!attachment.contentType) {
            throw new Error('If the attachment is not an image, it must specify a content type');
          }

          parts.push({
            type: 'file',
            data: url.toString(),
            mimeType: attachment.contentType,
          });
        }
        break;
      }

      case 'data:': {
        if (attachment.contentType?.startsWith('image/')) {
          parts.push({
            type: 'image',
            image: attachment.url,
            mimeType: attachment.contentType,
          });
        } else if (attachment.contentType?.startsWith('text/')) {
          parts.push({
            type: 'file',
            data: attachment.url,
            mimeType: attachment.contentType,
          });
        } else {
          if (!attachment.contentType) {
            throw new Error('If the attachment is not an image or text, it must specify a content type');
          }

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
