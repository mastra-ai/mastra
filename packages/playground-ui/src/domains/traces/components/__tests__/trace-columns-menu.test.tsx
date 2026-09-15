// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TraceColumnsMenu } from '../trace-columns-menu';

const defaultProps = {
  preferences: {
    visibleColumns: ['input', 'entity'] as const,
    metadataKeys: [],
  },
  onToggleColumn: vi.fn(),
  onAddMetadataColumn: vi.fn(),
  onRemoveMetadataColumn: vi.fn(),
  onReset: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TraceColumnsMenu', () => {
  describe('when usage metrics are unavailable', () => {
    it('explains why the usage columns are disabled', async () => {
      render(<TraceColumnsMenu {...defaultProps} usageDisabledReason="Metrics are unavailable." />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

      const inputTokens = await screen.findByRole('menuitemcheckbox', { name: 'Input tokens' });
      expect(inputTokens.getAttribute('data-disabled')).not.toBeNull();
      expect(screen.getByRole('note').textContent).toBe('Metrics are unavailable.');
    });
  });

  describe('the standard columns', () => {
    it('ticks the ones already showing and leaves the rest clear', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

      const checked = async (name: string) =>
        (await screen.findByRole('menuitemcheckbox', { name })).getAttribute('aria-checked');

      expect(await checked('Input')).toBe('true');
      expect(await checked('Entity')).toBe('true');
      expect(await checked('Duration')).toBe('false');
    });

    it('reports the column the user toggled', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Duration' }));

      expect(defaultProps.onToggleColumn).toHaveBeenCalledWith('duration');
    });

    it('resets on request', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Reset to defaults' }));

      expect(defaultProps.onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('the usage columns', () => {
    it('offers them freely, and says nothing, when metrics are available', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

      const inputTokens = await screen.findByRole('menuitemcheckbox', { name: 'Input tokens' });
      expect(inputTokens.getAttribute('data-disabled')).toBeNull();
      expect(screen.queryByRole('note')).toBeNull();

      fireEvent.click(inputTokens);
      expect(defaultProps.onToggleColumn).toHaveBeenCalledWith('inputTokens');
    });

    it('names every usage column it can show', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Input tokens' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Output tokens' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Estimated cost' })).toBeTruthy();
    });
  });

  describe('the metadata columns', () => {
    it('lists the keys already showing, ticked, and removes one on click', async () => {
      render(
        <TraceColumnsMenu
          {...defaultProps}
          preferences={{ visibleColumns: ['input'], metadataKeys: ['tenantId', 'region'] }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

      const tenantId = await screen.findByRole('menuitemcheckbox', { name: 'tenantId' });
      expect(tenantId.getAttribute('aria-checked')).toBe('true');
      // The full key is on the item, so a truncated label still reads in a tooltip.
      expect(tenantId.getAttribute('title')).toBe('tenantId');
      expect(screen.getByRole('menuitemcheckbox', { name: 'region' })).toBeTruthy();

      fireEvent.click(tenantId);
      expect(defaultProps.onRemoveMetadataColumn).toHaveBeenCalledWith('tenantId');
    });

    it('refuses a key that is already showing', async () => {
      render(
        <TraceColumnsMenu {...defaultProps} preferences={{ visibleColumns: ['input'], metadataKeys: ['tenantId'] }} />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));

      fireEvent.change(screen.getByLabelText('Metadata key'), { target: { value: 'tenantId' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

      expect(screen.getByRole('alert').textContent).toBe('That metadata column is already visible.');
      expect(defaultProps.onAddMetadataColumn).not.toHaveBeenCalled();
    });

    it('points the field at its own error message while one stands', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));

      const field = screen.getByLabelText('Metadata key');
      expect(field.getAttribute('aria-describedby')).toBeNull();
      expect(field.getAttribute('aria-invalid')).toBe('false');

      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
      expect(field.getAttribute('aria-describedby')).toBe('trace-metadata-key-error');
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByRole('alert').getAttribute('id')).toBe('trace-metadata-key-error');
    });

    it('clears the error as soon as the user types again', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));

      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
      expect(screen.getByRole('alert')).toBeTruthy();

      fireEvent.change(screen.getByLabelText('Metadata key'), { target: { value: 't' } });
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('closes the dialog once the column is added', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));

      fireEvent.change(screen.getByLabelText('Metadata key'), { target: { value: 'tenantId' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

      await waitFor(() => expect(screen.queryByLabelText('Metadata key')).toBeNull());
    });

    it('forgets the complaint it made when the dialog is dismissed', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));

      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
      expect(screen.getByRole('alert')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByLabelText('Metadata key')).toBeNull());

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));

      // A fresh attempt starts without last time's complaint still standing.
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByLabelText('Metadata key').getAttribute('aria-describedby')).toBeNull();
    });

    it('forgets what was typed when the dialog is dismissed', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));

      fireEvent.change(screen.getByLabelText('Metadata key'), { target: { value: 'half typed' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByLabelText('Metadata key')).toBeNull());

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));

      expect((screen.getByLabelText('Metadata key') as HTMLInputElement).value).toBe('');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('when a metadata column is added', () => {
    it('validates and normalizes the metadata key', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));

      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
      expect(screen.getByRole('alert').textContent).toBe('Enter a metadata key.');

      fireEvent.change(screen.getByLabelText('Metadata key'), { target: { value: ' tenantId ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

      expect(defaultProps.onAddMetadataColumn).toHaveBeenCalledWith('tenantId');
    });
  });
});
