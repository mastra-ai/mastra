// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowCancelButton } from '../workflow-cancel-button';

afterEach(() => cleanup());

describe('WorkflowCancelButton', () => {
  it('does not render for finished statuses', () => {
    render(<WorkflowCancelButton status="success" cancelMessage={null} isCancelling={false} onCancel={() => {}} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['running', 'suspended', 'paused'])('renders an enabled cancel button while %s', status => {
    render(<WorkflowCancelButton status={status} cancelMessage={null} isCancelling={false} onCancel={() => {}} />);

    const button = screen.getByRole<HTMLButtonElement>('button', { name: /cancel workflow run/i });
    expect(button.disabled).toBe(false);
  });
});
