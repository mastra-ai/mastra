// @vitest-environment jsdom
import type { FilePart } from '@mastra/react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserFilePartRenderer } from '../user-file-part-renderer';

const v5FilePart = (part: { type: 'file'; mediaType: string; url: string }): FilePart => part as never;

describe('UserFilePartRenderer', () => {
  it('renders an image preview for image mime types', () => {
    const part = {
      type: 'file',
      mimeType: 'image/png',
      data: 'https://example.com/cat.png',
    } satisfies FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('img')).not.toBeNull();
  });

  it('renders a PDF document preview by mimeType (url link)', () => {
    const part = {
      type: 'file',
      mimeType: 'application/pdf',
      data: 'https://example.com/doc.pdf',
    } satisfies FilePart;

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
    } satisfies FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('renders an image preview for the V5 streaming shape (mediaType/url)', () => {
    const part = v5FilePart({
      type: 'file',
      mediaType: 'image/png',
      url: 'data:image/png;base64,aGVsbG8=',
    });

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('img')).not.toBeNull();
  });

  it('renders a PDF document preview for the V5 streaming shape (mediaType/url)', () => {
    const part = v5FilePart({
      type: 'file',
      mediaType: 'application/pdf',
      url: 'https://example.com/doc.pdf',
    });

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('img')).toBeNull();
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://example.com/doc.pdf');
  });

  it('falls back to a text document preview for the V5 streaming shape (mediaType/url)', () => {
    const part = v5FilePart({
      type: 'file',
      mediaType: 'text/plain',
      url: 'just text',
    });

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });
});
