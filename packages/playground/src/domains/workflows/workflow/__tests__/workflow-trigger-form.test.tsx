// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { WorkflowTriggerForm } from '../workflow-trigger-form';

afterEach(() => cleanup());

const schema = z.object({ request: z.boolean() });

describe('WorkflowTriggerForm', () => {
  it('collapses to a single "Run input" button when viewing a run with a schema', () => {
    render(
      <WorkflowTriggerForm
        zodSchema={schema}
        isStreaming={false}
        onExecute={vi.fn()}
        defaultValues={{ request: true }}
        isViewingRun
        isReadOnly
        collapsible={false}
        headingSlot={<div data-testid="heading-slot">heading</div>}
        leftActions={<div data-testid="left-actions">debug</div>}
        submitActions={<div data-testid="submit-actions">options</div>}
      />,
    );

    // Only the collapsed "Run input" trigger should be present.
    expect(screen.getByRole('button', { name: /run input/i })).not.toBeNull();
    // The run header is preserved.
    expect(screen.getByTestId('heading-slot')).not.toBeNull();
    // No editable form, no Run submit, no left/submit actions are rendered inline.
    expect(screen.queryByRole('button', { name: /^run$/i })).toBeNull();
    expect(screen.queryByTestId('left-actions')).toBeNull();
    expect(screen.queryByTestId('submit-actions')).toBeNull();
  });

  it('renders the editable form with a Run button when not viewing a run', () => {
    render(
      <WorkflowTriggerForm
        zodSchema={schema}
        isStreaming={false}
        onExecute={vi.fn()}
        defaultValues={{ request: true }}
        collapsible={false}
      />,
    );

    expect(screen.getByRole('button', { name: /run/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /run input/i })).toBeNull();
  });
});
