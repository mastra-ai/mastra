import type { Attachment } from '@ai-sdk/ui-utils-v5';
import type { FilePart, ImagePart } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { attachmentsToParts } from './attachments-to-parts';

describe('attachmentsToParts', () => {
  it('should handle regular HTTP URLs', () => {
    const attachments: Attachment[] = [
      {
        url: 'https://example.com/image.png',
        contentType: 'image/png',
        name: 'image.png',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: 'image',
      image: 'https://example.com/image.png',
      mimeType: 'image/png',
    });
  });

  it('should handle data URIs', () => {
    const base64Data =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const dataUri = `data:image/png;base64,${base64Data}`;

    const attachments: Attachment[] = [
      {
        url: dataUri,
        contentType: 'image/png',
        name: 'pixel.png',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: 'image',
      mimeType: 'image/png',
    });
    expect((parts[0] as ImagePart).image).toContain('data:image/png;base64,');
  });

  it('should handle raw base64 strings by converting them to data URIs', () => {
    // This is the bug from issue #10480
    // Raw base64 string without the data: prefix should be automatically converted
    const base64Data =
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII';

    const attachments: Attachment[] = [
      {
        url: base64Data,
        contentType: 'image/png',
        name: 'test.png',
      },
    ];

    // This should NOT throw "Invalid URL" error anymore
    expect(() => attachmentsToParts(attachments)).not.toThrow();

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);

    const imagePart = parts[0] as ImagePart;

    expect(imagePart).toMatchObject({
      type: 'image',
      mimeType: 'image/png',
    });
    // The raw base64 should be converted to a proper data URI
    expect(imagePart.image).toContain('data:image/png;base64,');
    expect(imagePart.image).toContain(base64Data);
  });

  it('should handle raw base64 strings for non-image files', () => {
    const base64Data = 'SGVsbG8gV29ybGQh'; // "Hello World!" in base64

    const attachments: Attachment[] = [
      {
        url: base64Data,
        contentType: 'text/plain',
        name: 'hello.txt',
      },
    ];

    expect(() => attachmentsToParts(attachments)).not.toThrow();

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);

    const filePart = parts[0] as unknown as FilePart;

    expect(filePart).toMatchObject({
      type: 'file',
      mimeType: 'text/plain',
    });
    expect(filePart.data).toContain('data:text/plain;base64,');
    expect(filePart.data).toContain(base64Data);
  });

  it('should handle multiple attachments with mixed formats', () => {
    const base64Data =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const dataUri = `data:image/jpeg;base64,${base64Data}`;
    const httpUrl = 'https://example.com/image.png';

    const attachments: Attachment[] = [
      {
        url: httpUrl,
        contentType: 'image/png',
        name: 'remote.png',
      },
      {
        url: dataUri,
        contentType: 'image/jpeg',
        name: 'data-uri.jpg',
      },
      {
        url: base64Data,
        contentType: 'image/gif',
        name: 'raw-base64.gif',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(3);

    const imagePart0 = parts[0] as unknown as ImagePart;

    // First: HTTP URL
    expect(imagePart0).toMatchObject({
      type: 'image',
      image: httpUrl,
      mimeType: 'image/png',
    });

    const imagePart1 = parts[1] as unknown as ImagePart;

    // Second: Data URI
    expect(imagePart1).toMatchObject({
      type: 'image',
      mimeType: 'image/jpeg',
    });
    expect(imagePart1.image).toContain('data:image/jpeg;base64,');

    const imagePart2 = parts[2] as unknown as ImagePart;

    // Third: Raw base64 (should be converted to data URI)
    expect(imagePart2).toMatchObject({
      type: 'image',
      mimeType: 'image/gif',
    });
    expect(imagePart2.image).toContain('data:image/gif;base64,');
  });

  it('should throw error for raw base64 without contentType', () => {
    const base64Data = 'SGVsbG8gV29ybGQh';

    const attachments: Attachment[] = [
      {
        url: base64Data,
        contentType: undefined as any, // Simulating missing contentType
        name: 'unknown.bin',
      },
    ];

    // Without contentType for non-image/text files, it should throw an error
    expect(() => attachmentsToParts(attachments)).toThrow(
      'If the attachment is not an image or text, it must specify a content type',
    );
  });

  it('should handle HTTPS URLs with query parameters', () => {
    const attachments: Attachment[] = [
      {
        url: 'https://example.com/image.png?size=large&format=webp',
        contentType: 'image/png',
        name: 'image.png',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);
    const imagePart = parts[0] as ImagePart;
    expect(imagePart).toMatchObject({
      type: 'image',
      image: 'https://example.com/image.png?size=large&format=webp',
      mimeType: 'image/png',
    });
  });

  it('should handle HTTP URLs (not just HTTPS)', () => {
    const attachments: Attachment[] = [
      {
        url: 'http://example.com/photo.jpg',
        contentType: 'image/jpeg',
        name: 'photo.jpg',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);
    const imagePart = parts[0] as ImagePart;
    expect(imagePart).toMatchObject({
      type: 'image',
      image: 'http://example.com/photo.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('should handle non-image file URLs', () => {
    const attachments: Attachment[] = [
      {
        url: 'https://example.com/document.pdf',
        contentType: 'application/pdf',
        name: 'document.pdf',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);
    const filePart = parts[0] as unknown as FilePart;
    expect(filePart).toMatchObject({
      type: 'file',
      data: 'https://example.com/document.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('should handle URLs with various image formats', () => {
    const imageFormats = [
      { url: 'https://example.com/image.webp', contentType: 'image/webp', name: 'image.webp' },
      { url: 'https://example.com/image.gif', contentType: 'image/gif', name: 'image.gif' },
      { url: 'https://example.com/image.svg', contentType: 'image/svg+xml', name: 'image.svg' },
      { url: 'https://example.com/image.bmp', contentType: 'image/bmp', name: 'image.bmp' },
    ];

    const parts = attachmentsToParts(imageFormats);
    expect(parts).toHaveLength(4);

    imageFormats.forEach((format, index) => {
      const imagePart = parts[index] as ImagePart;
      expect(imagePart).toMatchObject({
        type: 'image',
        image: format.url,
        mimeType: format.contentType,
      });
    });
  });

  it('should handle URLs with special characters', () => {
    const attachments: Attachment[] = [
      {
        url: 'https://example.com/images/my%20image%20(1).png',
        contentType: 'image/png',
        name: 'my image (1).png',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);
    const imagePart = parts[0] as ImagePart;
    expect(imagePart.image).toBe('https://example.com/images/my%20image%20(1).png');
  });

  // Issue #11384: Support Google Cloud Storage gs:// URLs
  it('should handle Google Cloud Storage gs:// URLs for images', () => {
    const attachments: Attachment[] = [
      {
        url: 'gs://my-bucket/path/to/image.png',
        contentType: 'image/png',
        name: 'image.png',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);
    const imagePart = parts[0] as ImagePart;
    expect(imagePart).toMatchObject({
      type: 'image',
      image: 'gs://my-bucket/path/to/image.png',
      mimeType: 'image/png',
    });
  });

  it('should handle Google Cloud Storage gs:// URLs for non-image files', () => {
    const attachments: Attachment[] = [
      {
        url: 'gs://my-bucket/path/to/document.pdf',
        contentType: 'application/pdf',
        name: 'document.pdf',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);
    const filePart = parts[0] as unknown as FilePart;
    expect(filePart).toMatchObject({
      type: 'file',
      data: 'gs://my-bucket/path/to/document.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('should handle AWS S3 s3:// URLs for images', () => {
    const attachments: Attachment[] = [
      {
        url: 's3://my-bucket/path/to/image.jpg',
        contentType: 'image/jpeg',
        name: 'image.jpg',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);
    const imagePart = parts[0] as ImagePart;
    expect(imagePart).toMatchObject({
      type: 'image',
      image: 's3://my-bucket/path/to/image.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('should handle AWS S3 s3:// URLs for non-image files', () => {
    const attachments: Attachment[] = [
      {
        url: 's3://my-bucket/path/to/document.pdf',
        contentType: 'application/pdf',
        name: 'document.pdf',
      },
    ];

    const parts = attachmentsToParts(attachments);
    expect(parts).toHaveLength(1);
    const filePart = parts[0] as unknown as FilePart;
    expect(filePart).toMatchObject({
      type: 'file',
      data: 's3://my-bucket/path/to/document.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('should not convert URLs to data URIs', () => {
    // URLs should remain as URLs, not be converted to data URIs
    const attachments: Attachment[] = [
      {
        url: 'https://example.com/image.png',
        contentType: 'image/png',
        name: 'image.png',
      },
    ];

    const parts = attachmentsToParts(attachments);
    const imagePart = parts[0] as ImagePart;

    // Should still be a URL, not a data URI
    expect(imagePart.image).toMatch(/^https?:\/\//);
    expect(imagePart.image).not.toContain('data:');
  });
});
