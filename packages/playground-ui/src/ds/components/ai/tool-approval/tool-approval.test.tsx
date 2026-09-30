// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ToolApproval } from './tool-approval';

const noop = () => {};

describe('ToolApproval', () => {
  afterEach(cleanup);

  it('labels and colors the chosen button once declined', () => {
    render(<ToolApproval toolName="write_file" status="declined" onApprove={noop} onDecline={noop} />);

    const declined = screen.getByRole<HTMLButtonElement>('button', { name: 'Declined write_file' });
    expect(declined.disabled).toBe(true);
    expect(declined.className).toContain('text-destructive-foreground!');
    expect(screen.getByRole('button', { name: 'Approve write_file' })).not.toBeNull();
    expect(screen.getByRole('group').className).toContain('border-l-destructive-indicator');
  });

  it('keeps the warning rail while pending', () => {
    render(<ToolApproval toolName="write_file" onApprove={noop} onDecline={noop} />);

    expect(screen.getByRole('button', { name: 'Approve write_file' })).not.toBeNull();
    expect(screen.getByRole('group').className).toContain('border-l-warning-indicator');
  });
});
