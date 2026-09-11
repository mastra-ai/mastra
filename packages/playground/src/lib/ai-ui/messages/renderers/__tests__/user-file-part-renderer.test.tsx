import type { FilePart } from '@mastra/react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserFilePartRenderer } from '../user-file-part-renderer';

describe('UserFilePartRenderer', () => {
  describe('when a named file contains literal attachment tags', () => {
    it('preserves the entire file content in its preview', () => {
      const text = '<attachment>literal</attachment>';
      const part = { type: 'file' as const, mimeType: 'text/plain', data: text, filename: 'markup.txt' };
      const { getByRole, getByText } = render(<UserFilePartRenderer part={part} />);
      fireEvent.click(getByRole('button', { name: 'Preview markup.txt' }));
      expect(getByText(text).textContent).toBe(text);
    });
  });
  describe('when an inline text file is rendered', () => {
    it.each(['text/csv', 'application/json', 'application/yaml'])(
      'shows decoded %s content in the existing preview',
      mimeType => {
        const text = 'Zoë,hello\nworld';
        const part = {
          type: 'file' as const,
          mimeType,
          filename: 'notes.txt',
          data: `data:${mimeType};base64,${btoa(String.fromCharCode(...new TextEncoder().encode(text)))}`,
        };
        const { container, getByRole } = render(<UserFilePartRenderer part={part} />);
        expect(container.textContent).not.toContain(text);
        expect(container.querySelector('[title="notes.txt"]')).not.toBeNull();
        fireEvent.click(getByRole('button'));
        expect(getByRole('dialog').textContent).toContain(text);
      },
    );
  });
  describe('when an inline UTF-16 text file is rendered', () => {
    it.each([
      ['little-endian', [0xff, 0xfe, 0x5a, 0, 0x6f, 0, 0xeb, 0]],
      ['big-endian', [0xfe, 0xff, 0, 0x5a, 0, 0x6f, 0, 0xeb]],
    ] as const)('shows the original %s text without replacement characters', (_encoding, bytes) => {
      const part = {
        type: 'file' as const,
        mimeType: 'text/plain',
        data: `data:text/plain;base64,${btoa(String.fromCharCode(...bytes))}`,
      };
      const { getByRole, getByText } = render(<UserFilePartRenderer part={part} />);
      fireEvent.click(getByRole('button'));
      expect(getByText('Zoë').textContent).toBe('Zoë');
    });
  });
  describe('when a spreadsheet or malformed text file is rendered', () => {
    it.each([
      ['application/vnd.ms-excel', 'data:application/vnd.ms-excel;base64,AAEC'],
      ['text/csv', 'data:text/csv;base64,%%%'],
      ['text/plain', 'data:text/plain;base64,wyg='],
      ['text/plain', 'data:text/plain;base64,//79'],
      ['text/plain', 'data:text/plain;base64,/v8A'],
    ])('shows a named file placeholder rather than binary or base64 text for %s', (mimeType, data) => {
      const part = { type: 'file' as const, mimeType, data, filename: 'leads.xls' };
      const { container } = render(<UserFilePartRenderer part={part} />);
      expect(container.querySelector('[title="leads.xls"]')).not.toBeNull();
      expect(container.querySelector('button')).toBeNull();
      expect(container.innerHTML).not.toContain(data);
    });
  });
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
