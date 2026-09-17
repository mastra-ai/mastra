import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowCancelButton } from '../workflow-cancel-button';

afterEach(() => cleanup());

describe('WorkflowCancelButton', () => {
  it('does not render for finished statuses', () => {
    render(<WorkflowCancelButton status="success" cancelMessage={null} isCancelling={false} onCancel={() => {}} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders an enabled cancel button while running', () => {
    render(<WorkflowCancelButton status="running" cancelMessage={null} isCancelling={false} onCancel={() => {}} />);

    const button = screen.getByRole('button', { name: /cancel workflow run/i });
    expect(button).not.toBeNull();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders an enabled cancel button while paused', () => {
    render(<WorkflowCancelButton status="paused" cancelMessage={null} isCancelling={false} onCancel={() => {}} />);

    const button = screen.getByRole('button', { name: /cancel workflow run/i });
    expect(button).not.toBeNull();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not render while suspended', () => {
    render(<WorkflowCancelButton status="suspended" cancelMessage={null} isCancelling={false} onCancel={() => {}} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
