// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
