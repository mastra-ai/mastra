// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowMapConfigDialog } from '../workflow-map-config-dialog';

afterEach(() => cleanup());

describe('WorkflowMapConfigDialog', () => {
  it('keeps the dialog closed until the trigger is clicked', () => {
    render(<WorkflowMapConfigDialog stepName="mapStep" mapConfig='{"mapped":true}' />);

    expect(screen.getByRole('button', { name: 'Map config' })).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a titled dialog showing the formatted config when the trigger is clicked', () => {
    render(<WorkflowMapConfigDialog stepName="mapStep" mapConfig='{"mapped":true}' />);

    fireEvent.click(screen.getByRole('button', { name: 'Map config' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toBeNull();
    expect(screen.getByText('mapStep config')).not.toBeNull();

    const editor = dialog.querySelector('.cm-content');
    expect(editor?.textContent).toContain('"mapped": true');
  });

  it('closes the dialog via the close control', async () => {
    render(<WorkflowMapConfigDialog stepName="mapStep" mapConfig='{"mapped":true}' />);

    fireEvent.click(screen.getByRole('button', { name: 'Map config' }));
    expect(screen.getByRole('dialog')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
