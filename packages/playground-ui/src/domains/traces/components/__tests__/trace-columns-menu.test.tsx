// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TRACE_COLUMN_PREFERENCES } from '../../trace-list-columns';
import { TraceColumnsMenu } from '../trace-columns-menu';

const defaultProps = {
  preferences: DEFAULT_TRACE_COLUMN_PREFERENCES,
  onToggleColumn: vi.fn(),
  onAddCustomColumn: vi.fn(),
  onRemoveCustomColumn: vi.fn(),
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

      expect(await checked('Type')).toBe('true');
      expect(await checked('Input')).toBe('true');
      expect(await checked('Duration')).toBe('true');
      expect(await checked('Estimated cost')).toBe('true');
      expect(await checked('Input tokens')).toBe('false');
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Entity' })).toBeNull();
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

  describe('when opened', () => {
    it('lists the environment and end time columns alongside the standard ones', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

      expect(await screen.findByRole('menuitemcheckbox', { name: 'End time' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Environment' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Total tokens' })).toBeTruthy();
    });
  });

  describe('the custom columns', () => {
    it('offers every pinnable trace property and reports the one toggled on', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

      const threadId = await screen.findByRole('menuitemcheckbox', { name: 'Thread ID' });
      expect(threadId.getAttribute('aria-checked')).toBe('false');
      expect(screen.getByRole('menuitemcheckbox', { name: 'Resource ID' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Trace ID' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Entity ID' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Started at' })).toBeTruthy();

      fireEvent.click(threadId);
      expect(defaultProps.onAddCustomColumn).toHaveBeenCalledWith('threadId');
    });

    it('ticks the ones already showing and removes one on click', async () => {
      render(
        <TraceColumnsMenu
          {...defaultProps}
          preferences={{ visibleColumns: [], customColumns: ['threadId'], metadataKeys: [] }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

      const threadId = await screen.findByRole('menuitemcheckbox', { name: 'Thread ID' });
      expect(threadId.getAttribute('aria-checked')).toBe('true');

      fireEvent.click(threadId);
      expect(defaultProps.onRemoveCustomColumn).toHaveBeenCalledWith('threadId');
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
    const openAddDialog = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add metadata column' }));
      return screen.getByRole('combobox', { name: 'Metadata key' });
    };

    const openKeyList = async () => {
      fireEvent.click(screen.getByRole('combobox', { name: 'Metadata key' }));
      return screen.findByPlaceholderText('Search metadata keys…');
    };

    const pickOption = async (name: string) => {
      const option = await screen.findByRole('option', { name });
      fireEvent.pointerDown(option, { pointerType: 'mouse' });
      fireEvent.click(option, { detail: 1 });
    };

    const typeCustomKey = async (text: string) => {
      const search = await openKeyList();
      fireEvent.input(search, { target: { value: text }, inputType: 'insertText' });
      await pickOption(`Use “${text.trim()}”`);
    };

    it('lists the keys already showing, ticked, and removes one on click', async () => {
      render(
        <TraceColumnsMenu
          {...defaultProps}
          preferences={{ visibleColumns: ['input'], customColumns: [], metadataKeys: ['tenantId', 'region'] }}
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

    describe('when metadata keys were discovered', () => {
      it('lists the discovered keys as options', async () => {
        render(<TraceColumnsMenu {...defaultProps} availableMetadataKeys={['region', 'tenantId']} />);

        await openAddDialog();
        await openKeyList();

        expect(await screen.findByRole('option', { name: 'region' })).toBeTruthy();
        expect(screen.getByRole('option', { name: 'tenantId' })).toBeTruthy();
      });

      it('hides keys that are already visible columns', async () => {
        render(
          <TraceColumnsMenu
            {...defaultProps}
            availableMetadataKeys={['region', 'tenantId']}
            preferences={{ visibleColumns: [], customColumns: [], metadataKeys: ['tenantId'] }}
          />,
        );

        await openAddDialog();
        await openKeyList();

        expect(await screen.findByRole('option', { name: 'region' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'tenantId' })).toBeNull();
      });

      it('adds the selected key', async () => {
        render(<TraceColumnsMenu {...defaultProps} availableMetadataKeys={['region', 'tenantId']} />);

        await openAddDialog();
        await openKeyList();
        await pickOption('region');
        fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

        expect(defaultProps.onAddMetadataColumn).toHaveBeenCalledWith('region');
      });
    });

    describe('when no metadata keys were discovered', () => {
      it('still lets the user type a custom key', async () => {
        render(<TraceColumnsMenu {...defaultProps} />);

        await openAddDialog();
        await typeCustomKey('tenantId');
        fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

        expect(defaultProps.onAddMetadataColumn).toHaveBeenCalledWith('tenantId');
      });

      it('shows the typed key on the trigger before it is added', async () => {
        render(<TraceColumnsMenu {...defaultProps} />);

        const trigger = await openAddDialog();
        await typeCustomKey('tenantId');

        expect(trigger.textContent).toContain('tenantId');
      });
    });

    it('refuses a key that is already showing', async () => {
      render(
        <TraceColumnsMenu
          {...defaultProps}
          preferences={{ visibleColumns: ['input'], customColumns: [], metadataKeys: ['tenantId'] }}
        />,
      );

      await openAddDialog();
      await typeCustomKey('tenantId');
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

      expect(screen.getByRole('alert').textContent).toBe('That metadata column is already visible.');
      expect(defaultProps.onAddMetadataColumn).not.toHaveBeenCalled();
    });

    it('refuses an empty key', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      await openAddDialog();
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

      expect(screen.getByRole('alert').textContent).toBe('Enter a metadata key.');
      expect(defaultProps.onAddMetadataColumn).not.toHaveBeenCalled();
    });

    it('points the field at its own error message while one stands', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      const field = await openAddDialog();
      expect(field.getAttribute('aria-describedby')).toBeNull();
      expect(field.getAttribute('aria-invalid')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
      // The combobox remounts inside an error wrapper, so query it again.
      const invalidField = screen.getByRole('combobox', { name: 'Metadata key' });
      expect(invalidField.getAttribute('aria-describedby')).toBe('error-trace-metadata-key');
      expect(invalidField.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByRole('alert').getAttribute('id')).toBe('error-trace-metadata-key');
    });

    it('clears the error as soon as a key is picked', async () => {
      render(<TraceColumnsMenu {...defaultProps} availableMetadataKeys={['region']} />);

      await openAddDialog();
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
      expect(screen.getByRole('alert')).toBeTruthy();

      await openKeyList();
      await pickOption('region');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('closes the dialog once the column is added', async () => {
      render(<TraceColumnsMenu {...defaultProps} availableMetadataKeys={['region']} />);

      await openAddDialog();
      await openKeyList();
      await pickOption('region');
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

      await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Metadata key' })).toBeNull());
    });

    it('forgets the complaint it made when the dialog is dismissed', async () => {
      render(<TraceColumnsMenu {...defaultProps} />);

      await openAddDialog();
      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
      expect(screen.getByRole('alert')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Metadata key' })).toBeNull());

      const field = await openAddDialog();

      // A fresh attempt starts without last time's complaint still standing.
      expect(screen.queryByRole('alert')).toBeNull();
      expect(field.getAttribute('aria-describedby')).toBeNull();
    });

    it('forgets what was picked when the dialog is dismissed', async () => {
      render(<TraceColumnsMenu {...defaultProps} availableMetadataKeys={['region']} />);

      await openAddDialog();
      await openKeyList();
      await pickOption('region');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Metadata key' })).toBeNull());

      const field = await openAddDialog();

      expect(field.textContent).not.toContain('region');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
