import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowEdgeDataButton } from '../workflow-edge-data-button';

afterEach(() => cleanup());

describe('WorkflowEdgeDataButton', () => {
  it('opens a data dialog with only the previous step output payload', () => {
    render(<WorkflowEdgeDataButton previousStepId="extract" output={{ customerId: 'cus_123' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Data' }));

    expect(screen.getByText('Step output')).not.toBeNull();
    expect(screen.getByText('extract output')).not.toBeNull();
    expect(screen.getAllByText(/cus_123/).length).toBeGreaterThan(0);
  });

  it('uses a custom label for workflow boundary payloads', () => {
    render(<WorkflowEdgeDataButton label="Workflow input" output={{ text: 'hello' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Data' }));

    expect(screen.getByText('Workflow input')).not.toBeNull();
    expect(screen.getAllByText(/hello/).length).toBeGreaterThan(0);
  });

  it('does not render when there is no payload to inspect', () => {
    const { container } = render(<WorkflowEdgeDataButton previousStepId="a" />);

    expect(container.textContent).toBe('');
  });
});
