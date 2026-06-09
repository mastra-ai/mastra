// @vitest-environment jsdom
import type { FilePart } from '@mastra/react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserFilePartRenderer } from '../user-file-part-renderer';

describe('UserFilePartRenderer', () => {
  it('renders an image preview for image mime types', () => {
    const part = {
      type: 'file',
      mimeType: 'image/png',
      data: 'https://example.com/cat.png',
    } as unknown as FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('img')).not.toBeNull();
  });

  it('renders a PDF document preview by mimeType (url link)', () => {
    const part = {
      type: 'file',
      mimeType: 'application/pdf',
      data: 'https://example.com/doc.pdf',
    } as unknown as FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    // A URL-backed PDF renders an anchor to view the document, not an <img>.
    expect(container.querySelector('img')).toBeNull();
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://example.com/doc.pdf');
  });

  it('falls back to a text document preview for other content', () => {
    const part = {
      type: 'file',
      mimeType: 'text/plain',
      data: 'just text',
    } as unknown as FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });
});
