// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './copy-button';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'execCommand');
});

function blockClipboard() {
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'));
  Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
}

describe('CopyButton', () => {
  it('renders as a round icon button when no size is given, not a padded pill', () => {
    render(<CopyButton content="A complete reply" tooltip="Copy message" />);

    expect(screen.getByRole('button', { name: 'Copy message' }).getAttribute('data-shape')).toBe('icon');
  });

  it('copies, and its tooltip says so without closing on the click', async () => {
    const user = userEvent.setup();
    render(<CopyButton content="A complete reply" tooltip="Copy message" />);
    const button = screen.getByRole('button', { name: 'Copy message' });

    await user.hover(button);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Copy message');
    await user.click(button);

    expect(await screen.findByRole('tooltip', { name: 'Copied' })).toBeTruthy();
    expect(await navigator.clipboard.readText()).toBe('A complete reply');
    expect(await screen.findByText('Copied to clipboard')).toBeTruthy();
  });

  it('keeps its name while it shows the copy, so a screen reader hears one message', async () => {
    const user = userEvent.setup();
    render(<CopyButton content="A complete reply" tooltip="Copy message" />);

    await user.click(screen.getByRole('button', { name: 'Copy message' }));

    await screen.findByText('Copied to clipboard');
    expect(screen.getByRole('button', { name: 'Copy message' })).toBeTruthy();
  });

  it('says so in its tooltip when the browser blocks the copy', async () => {
    const user = userEvent.setup();
    blockClipboard();
    render(<CopyButton content="A complete reply" tooltip="Copy message" />);
    const button = screen.getByRole('button', { name: 'Copy message' });
    await user.hover(button);
    await screen.findByRole('tooltip');

    await user.click(button);

    expect(await screen.findByRole('tooltip', { name: 'Couldn’t copy' })).toBeTruthy();
    expect(screen.queryByText('Copied to clipboard')).toBeNull();
  });

  describe('with a label', () => {
    it('reads "Copied" once copied', async () => {
      const user = userEvent.setup();
      render(<CopyButton content="The prompt">Copy prompt</CopyButton>);

      await user.click(screen.getByRole('button', { name: 'Copy prompt' }));

      expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
      expect(await navigator.clipboard.readText()).toBe('The prompt');
    });

    it('reads "Failed" when the browser blocks the copy', async () => {
      const user = userEvent.setup();
      blockClipboard();
      render(<CopyButton content="The prompt">Copy prompt</CopyButton>);

      await user.click(screen.getByRole('button', { name: 'Copy prompt' }));

      expect(await screen.findByRole('button', { name: 'Failed' })).toBeTruthy();
    });
  });
});
