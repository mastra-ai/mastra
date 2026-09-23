// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './copy-button';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CopyButton', () => {
  describe('when clipboard access fails', () => {
    it('does not claim the message was copied', async () => {
      const writeText = vi.fn().mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'));
      const execCommand = vi.fn(() => false);
      Object.assign(navigator, { clipboard: { writeText } });
      Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
      render(<CopyButton content="A complete reply" tooltip="Copy message" showToast={false} />);

      fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));

      await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'));
      expect(screen.queryByRole('button', { name: 'Copied!' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Copy message' })).toBeTruthy();
    });
  });

  describe('when the browser accepts the copy', () => {
    it('confirms the supplied text was copied', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      render(<CopyButton content="A complete reply" tooltip="Copy message" showToast={false} />);

      fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));

      await screen.findByRole('button', { name: 'Copied!' });
      expect(writeText).toHaveBeenCalledWith('A complete reply');
    });
  });
});
