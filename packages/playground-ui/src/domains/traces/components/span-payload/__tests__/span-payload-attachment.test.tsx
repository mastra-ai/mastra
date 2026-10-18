// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SpanPayloadAttachment } from '../span-payload-attachment';

afterEach(cleanup);

describe('SpanPayloadAttachment', () => {
  describe('when an image has a compatible URL', () => {
    it('uses the shared attachment presentation', () => {
      render(
        <SpanPayloadAttachment value={{ type: 'image', image: 'https://example.com/photo.png', filename: 'photo' }} />,
      );
      expect(screen.getByRole('img').getAttribute('src')).toBe('https://example.com/photo.png');
    });
  });
  describe('when an attachment cannot be safely displayed', () => {
    it.each([
      'javascript:alert(1)',
      'data:image/svg+xml;base64,abc',
      'https://user:secret@example.com/file',
      'binary-data',
    ])('preserves %s as JSON', url => {
      render(<SpanPayloadAttachment value={{ type: 'image', url }} />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText(new RegExp('"url"'))).toBeTruthy();
    });
  });
});
