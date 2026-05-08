import type { Attachment } from '@ai-sdk/ui-utils-v5';
import type { FilePart, ImagePart, TextPart } from '@internal/ai-sdk-v4';
import { categorizeFileData, createDataUri } from './image-utils';

type ContentPart = TextPart | ImagePart | FilePart;

/**
 * Converts a list of attachments to a list of content parts
 * for consumption by `ai/core` functions.
 * Currently only supports images and text attachments.
 */
export function attachmentsToParts(attachments: Attachment[]): ContentPart[] {
  const parts: ContentPart[] = [];

  for (const attachment of attachments) {
    // Categorize the attachment URL to determine if it's a URL, data URI, or raw base64
    const categorized = categorizeFileData(attachment.url, attachment.contentType);

    // If it's raw data (base64), convert it to a data URI
    let urlString = attachment.url;
    if (categorized.type === 'raw') {
      urlString = createDataUri(attachment.url, attachment.contentType || 'application/octet-stream');
    }

    let url;
    try {
      url = new URL(urlString);
    } catch {
      throw new Error(`Invalid URL: ${attachment.url}`);
    }

    switch (url.protocol) {
      case 'http:':
      case 'https:':
      // Cloud storage protocols supported by AI providers (e.g., Vertex AI for gs://, Bedrock for s3://)
      case 'gs:':
      case 's3:': {
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
            image: urlString,
            mimeType: attachment.contentType,
          });
        } else if (attachment.contentType?.startsWith('text/')) {
          parts.push({
            type: 'file',
            data: urlString,
            mimeType: attachment.contentType,
          });
        } else {
          if (!attachment.contentType) {
            throw new Error('If the attachment is not an image or text, it must specify a content type');
          }

          parts.push({
            type: 'file',
            data: urlString,
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
