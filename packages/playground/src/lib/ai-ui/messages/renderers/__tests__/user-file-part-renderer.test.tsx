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

  it('renders an image preview for a data: URI image', () => {
    const part = {
      type: 'file',
      mimeType: 'image/png',
      data: 'data:image/png;base64,aGVsbG8=',
    } satisfies FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('img')).not.toBeNull();
  });

  it('renders a non-fetchable chip (no img) for gs:// image URIs', () => {
    const part = {
      type: 'file',
      mimeType: 'image/png',
      data: 'gs://my-bucket/cat.png',
    } satisfies FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    // gs:// cannot be loaded by the browser — must not attempt an <img>.
    expect(container.querySelector('img')).toBeNull();
    // No outbound link either, since gs:// is not browser-fetchable.
    expect(container.querySelector('a')).toBeNull();
    // The chip icon reflects the media type, not a hardcoded video icon.
    expect(container.querySelector('[aria-label="File"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Video file"]')).toBeNull();
  });

  it('renders a chip for a gs:// video and does not link out', () => {
    const part = {
      type: 'file',
      mimeType: 'video/mp4',
      data: 'gs://my-bucket/clip.mp4',
    } satisfies FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('[aria-label="Video file"]')).not.toBeNull();
  });

  it('renders an audio icon for a gs:// audio URI', () => {
    const part = {
      type: 'file',
      mimeType: 'audio/mpeg',
      data: 'gs://my-bucket/song.mp3',
    } satisfies FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('[aria-label="Audio file"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Video file"]')).toBeNull();
  });

  it('renders a chip that links out for an https:// video', () => {
    const part = {
      type: 'file',
      mimeType: 'video/mp4',
      data: 'https://example.com/clip.mp4',
    } satisfies FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    expect(container.querySelector('img')).toBeNull();
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://example.com/clip.mp4');
    expect(container.querySelector('[aria-label="Video file"]')).not.toBeNull();
  });

  it('renders an audio chip that links out for an https:// audio URL', () => {
    const part = {
      type: 'file',
      mimeType: 'audio/mpeg',
      data: 'https://example.com/song.mp3',
    } satisfies FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    // Audio is not previewable inline — it routes to the chip (not a text/doc preview).
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://example.com/song.mp3');
    expect(container.querySelector('[aria-label="Audio file"]')).not.toBeNull();
  });

  it('does not use a local data: payload as the chip label', () => {
    const dataUri = `data:video/mp4;base64,${'A'.repeat(2048)}`;
    const part = {
      type: 'file',
      mimeType: 'video/mp4',
      data: dataUri,
    } satisfies FilePart;

    const { container } = render(<UserFilePartRenderer part={part} />);

    // Local inlined media must render the chip without leaking the long base64
    // payload into a title/tooltip attribute.
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('[aria-label="Video file"]')).not.toBeNull();
    expect(container.querySelector(`[title*="base64"]`)).toBeNull();
    expect(container.innerHTML).not.toContain(dataUri);
  });
});
