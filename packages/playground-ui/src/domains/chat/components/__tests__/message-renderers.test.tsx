// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReasoningPartRenderer } from '../../messages/renderers/reasoning-part-renderer';
import { UserFilePartRenderer } from '../../messages/renderers/user-file-part-renderer';
import { UserTextPartRenderer } from '../../messages/renderers/user-text-part-renderer';

afterEach(cleanup);

describe('Standalone message renderers', () => {
  describe('when a persisted reasoning part is supplied without application providers', () => {
    it('lets the reader reveal the original reasoning', () => {
      render(<ReasoningPartRenderer part={{ type: 'reasoning', reasoning: 'Check the input first.' }} />);
      fireEvent.click(screen.getByRole('button', { name: 'Hide reasoning' }));
      fireEvent.click(screen.getByRole('button', { name: 'Show reasoning' }));
      expect(screen.getByText('Check the input first.')).toBeTruthy();
    });
  });

  describe('when a user message contains a system reminder', () => {
    it('lets the reader expand the reminder', () => {
      render(
        <UserTextPartRenderer
          part={{ type: 'text', text: '<system-reminder path="AGENTS.md">Keep tests focused.</system-reminder>' }}
        />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Keep tests focused.')).toBeTruthy();
    });
  });

  describe('when a user attaches an image', () => {
    it('opens the image preview without application providers', () => {
      render(
        <UserFilePartRenderer part={{ type: 'file', mimeType: 'image/png', data: 'data:image/png;base64,aGVsbG8=' }} />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByRole('img', { name: 'Image' })).toBeTruthy();
    });
  });
});
