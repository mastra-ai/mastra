// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FileChipEntry, ImageEntry, PdfEntry, TxtEntry } from './attachment-preview-dialog';

afterEach(() => cleanup());

describe('ImageEntry', () => {
  it('renders a thumbnail and opens a preview dialog on click', () => {
    render(<ImageEntry src="https://example.com/cat.png" />);

    expect(screen.getByAltText('Preview').getAttribute('src')).toBe('https://example.com/cat.png');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('dialog').textContent).toContain('Image preview');
    expect(screen.getByAltText('Image').getAttribute('src')).toBe('https://example.com/cat.png');
  });
});

describe('PdfEntry', () => {
  describe('when a URL is available', () => {
    it('links out in a new tab instead of opening a dialog', () => {
      const { container } = render(<PdfEntry data="" url="https://example.com/doc.pdf" />);

      const link = container.querySelector('a');
      expect(link?.getAttribute('href')).toBe('https://example.com/doc.pdf');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(container.querySelector('button')).toBeNull();
    });
  });

  describe('when only inline data is available', () => {
    it('opens a dialog embedding the PDF', () => {
      render(<PdfEntry data="data:application/pdf;base64,AA==" />);

      fireEvent.click(screen.getByRole('button'));

      const dialog = screen.getByRole('dialog');
      expect(dialog.textContent).toContain('PDF preview');
      expect(dialog.querySelector('iframe')?.getAttribute('src')).toBe('data:application/pdf;base64,AA==');
    });
  });
});

describe('TxtEntry', () => {
  describe('when the file is named', () => {
    it('shows the name and previews the raw content', () => {
      const content = '<attachment>kept as-is</attachment>';
      render(<TxtEntry data={content} name="markup.txt" />);

      fireEvent.click(screen.getByRole('button', { name: 'Preview markup.txt' }));

      const dialog = screen.getByRole('dialog');
      expect(dialog.textContent).toContain('markup.txt');
      expect(dialog.textContent).toContain(content);
    });
  });

  describe('when the file is unnamed but wrapped in an attachment envelope', () => {
    it('extracts the name (decoding entities) and strips the envelope', () => {
      render(<TxtEntry data={'<attachment name="a &amp; b &lt;c&gt; &quot;d&quot;">inner text</attachment>'} />);

      fireEvent.click(screen.getByRole('button', { name: 'Preview a & b <c> "d"' }));

      const dialog = screen.getByRole('dialog');
      expect(dialog.textContent).toContain('inner text');
      expect(dialog.textContent).not.toContain('<attachment');
    });
  });

  describe('when the file is unnamed and has no envelope', () => {
    it('uses a generic label and shows the data', () => {
      render(<TxtEntry data="just text" />);

      fireEvent.click(screen.getByRole('button', { name: 'Preview text attachment' }));

      const dialog = screen.getByRole('dialog');
      expect(dialog.textContent).toContain('Text preview');
      expect(dialog.textContent).toContain('just text');
    });
  });
});

describe('FileChipEntry', () => {
  it.each([
    ['video/mp4', 'Video file'],
    ['audio/mpeg', 'Audio file'],
    ['text/plain', 'Document file'],
    ['application/pdf', 'Document file'],
    ['application/octet-stream', 'File'],
    [undefined, 'File'],
  ])('picks the icon for %s', (contentType, label) => {
    const { container } = render(<FileChipEntry name="x" contentType={contentType} />);

    expect(container.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
  });

  it('links out when a URL is provided', () => {
    const { container } = render(<FileChipEntry name="clip.mp4" url="https://example.com/clip.mp4" />);

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/clip.mp4');
    expect(link?.getAttribute('title')).toBe('clip.mp4');
  });

  it('renders a static chip without a URL', () => {
    const { container } = render(<FileChipEntry name="gs://bucket/clip.mp4" />);

    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('[title="gs://bucket/clip.mp4"]')).not.toBeNull();
  });
});
