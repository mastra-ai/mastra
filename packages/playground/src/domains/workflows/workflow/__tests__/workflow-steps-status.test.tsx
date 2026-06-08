// @vitest-environment jsdom
import type * as PlaygroundUI from '@mastra/playground-ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkflowStepsStatus } from '../workflow-steps-status';

// CodeEditor is a heavy CodeMirror-backed component with its own coverage; stub it
// so the dialog body is assertable without booting an editor in jsdom.
vi.mock('@mastra/playground-ui', async importOriginal => {
  const actual = await importOriginal<typeof PlaygroundUI>();
  return {
    ...actual,
    CodeEditor: ({ data }: { data: unknown }) => <pre data-testid="code-editor">{JSON.stringify(data)}</pre>,
  };
});

afterEach(() => cleanup());

describe('WorkflowStepsStatus', () => {
  it('renders nothing when there are no non-input steps', () => {
    const { container } = render(<WorkflowStepsStatus steps={{ input: { status: 'success' } }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the "Status" heading and one compact row per step', () => {
    render(
      <WorkflowStepsStatus
        steps={{
          stepOne: { status: 'success', output: { value: 1 } },
          stepTwo: { status: 'failed', error: { message: 'boom' } },
        }}
      />,
    );

    expect(screen.getByText('Status')).not.toBeNull();
    // Step ids are title-cased into the row label and become buttons.
    expect(screen.getByRole('button', { name: /StepOne/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /StepTwo/ })).not.toBeNull();
  });

  it('opens a dialog with the step result when a step row is clicked', async () => {
    render(<WorkflowStepsStatus steps={{ stepOne: { status: 'success', output: { value: 42 } } }} />);

    // No dialog content before interaction
    expect(screen.queryByText('Step execution details')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /StepOne/ }));

    expect(await screen.findByText('Step execution details')).not.toBeNull();
    expect(screen.getByTestId('code-editor').textContent).toContain('42');
  });

  it('shows tripwire details in the dialog for a failed step with tripwire info', async () => {
    render(
      <WorkflowStepsStatus
        steps={{
          guardStep: { status: 'failed', tripwire: { reason: 'Blocked by guard' } },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /GuardStep/ }));

    expect(await screen.findByText('Content Blocked')).not.toBeNull();
    expect(screen.getByText('Blocked by guard')).not.toBeNull();
  });
});
