// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolApproval, ToolApprovalActions } from './tool-approval';

const noop = () => {};

afterEach(cleanup);

describe.each(['default', 'inline'] as const)('ToolApproval (%s)', variant => {
  it('dispatches decisions with tool-specific accessible labels', () => {
    const onApprove = vi.fn();
    const onDecline = vi.fn();
    render(<ToolApproval variant={variant} toolName="write_file" onApprove={onApprove} onDecline={onDecline} />);

    fireEvent.click(screen.getByRole('button', { name: 'Approve write_file' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline write_file' }));

    expect(onApprove).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it.each(['approved', 'declined'] as const)('announces %s and removes decision controls', status => {
    render(<ToolApproval variant={variant} toolName="write_file" status={status} onApprove={noop} onDecline={noop} />);

    expect(screen.getByRole('status').textContent?.toLowerCase()).toBe(status);
    expect(screen.queryByRole('button', { name: 'Approve write_file' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decline write_file' })).toBeNull();
    expect(screen.queryByText('Approval required')).toBeNull();
  });

  it('blocks decisions while busy and allows a retry when the consumer clears pending', () => {
    const onApprove = vi.fn();
    const onDecline = vi.fn();
    const props = { variant, toolName: 'write_file', onApprove, onDecline };
    const { rerender } = render(<ToolApproval {...props} disabled />);

    for (const button of screen.getAllByRole<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(onApprove).not.toHaveBeenCalled();
    expect(onDecline).not.toHaveBeenCalled();

    rerender(<ToolApproval {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve write_file' }));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('restores decisions when the consumer rolls back a status', () => {
    const props = { variant, toolName: 'write_file', onApprove: vi.fn(), onDecline: vi.fn() };
    const { rerender } = render(<ToolApproval {...props} status="approved" />);

    rerender(<ToolApproval {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decline write_file' }));
    expect(props.onDecline).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('Approval required');
  });

  it('keeps the full arguments available for review', () => {
    const content = `${'A long file body. '.repeat(180)}End of requested change.`;
    render(
      <ToolApproval
        variant={variant}
        toolName="write_file"
        args={{ path: 'src/agent.ts', content }}
        onApprove={noop}
        onDecline={noop}
      />,
    );

    expect(screen.getByText(/End of requested change/).textContent).toContain(content);
  });

  it('allows custom details to replace the argument preview', () => {
    render(
      <ToolApproval
        variant={variant}
        toolName="write_file"
        args={{ path: 'hidden.ts' }}
        onApprove={noop}
        onDecline={noop}
      >
        <p>Custom review details</p>
      </ToolApproval>,
    );

    expect(screen.getByText('Custom review details')).not.toBeNull();
    expect(screen.queryByText(/hidden.ts/)).toBeNull();
  });
});

it('preserves the legacy actions export with generic accessible names', () => {
  const onApprove = vi.fn();
  render(<ToolApprovalActions onApprove={onApprove} onDecline={noop} />);
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(onApprove).toHaveBeenCalledOnce();
});
