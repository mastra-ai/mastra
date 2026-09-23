// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { InMessageAttachment } from '../in-message-attachment';

afterEach(() => cleanup());

describe('InMessageAttachment', () => {
  describe('when the attachment is an image', () => {
    it('renders an image preview pointing at the source', () => {
      const { container } = render(<InMessageAttachment type="image" src="https://example.com/cat.png" />);

      expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/cat.png');
    });
  });

  describe('when the attachment is a generic file', () => {
    it('renders a chip titled with the file name and no preview button', () => {
      const { container } = render(<InMessageAttachment type="file" name="clip.mp4" contentType="video/mp4" />);

      expect(container.querySelector('[title="clip.mp4"]')).not.toBeNull();
      expect(container.querySelector('[aria-label="Video file"]')).not.toBeNull();
      expect(container.querySelector('button')).toBeNull();
    });

    it('falls back to the src as label when there is no name', () => {
      const { container } = render(<InMessageAttachment type="file" src="https://example.com/a.bin" />);

      expect(container.querySelector('a[title="https://example.com/a.bin"]')?.getAttribute('href')).toBe(
        'https://example.com/a.bin',
      );
    });

    it('falls back to "file" when neither name, src nor data is provided', () => {
      const { container } = render(<InMessageAttachment type="file" />);

      expect(container.querySelector('[title="file"]')).not.toBeNull();
    });
  });

  describe('when the attachment is a PDF document', () => {
    it('renders a PDF entry opening a preview dialog', () => {
      render(
        <InMessageAttachment type="document" contentType="application/pdf" data="data:application/pdf;base64,AA==" />,
      );

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByRole('dialog').textContent).toContain('PDF preview');
    });

    it('links out instead when a URL is available', () => {
      const { container } = render(
        <InMessageAttachment type="document" contentType="application/pdf" src="https://example.com/doc.pdf" />,
      );

      expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/doc.pdf');
    });
  });

  describe('when the attachment is any other document', () => {
    it('renders a text entry named after the file', () => {
      render(<InMessageAttachment type="document" contentType="text/plain" data="hello world" name="notes.txt" />);

      fireEvent.click(screen.getByRole('button', { name: 'Preview notes.txt' }));

      expect(screen.getByRole('dialog').textContent).toContain('hello world');
    });
  });

  it('titles the wrapper with the attachment name', () => {
    const { container } = render(<InMessageAttachment type="image" src="x.png" name="x.png" />);

    expect(container.firstElementChild?.getAttribute('title')).toBe('x.png');
  });
});
