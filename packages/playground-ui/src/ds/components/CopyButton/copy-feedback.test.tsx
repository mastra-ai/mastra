// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CopyTooltip } from './copy-feedback';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

afterEach(() => {
  cleanup();
});

function CopyId() {
  const { status, handleCopy } = useCopyToClipboard({ text: 'trace_1' });
  return (
    <CopyTooltip status={status} label="Copy to clipboard" openOnCopy>
      <button onClick={handleCopy}>trace_1</button>
    </CopyTooltip>
  );
}

describe('CopyTooltip that opens on copy', () => {
  it('closes on Escape while it says "Copied", and opens again for the next copy', async () => {
    const user = userEvent.setup();
    render(<CopyId />);
    const button = screen.getByRole('button', { name: 'trace_1' });

    await user.click(button);
    expect(await screen.findByRole('tooltip', { name: 'Copied' })).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());

    await user.click(button);
    expect(await screen.findByRole('tooltip', { name: 'Copied' })).toBeTruthy();
    expect(await navigator.clipboard.readText()).toBe('trace_1');
  });
});
