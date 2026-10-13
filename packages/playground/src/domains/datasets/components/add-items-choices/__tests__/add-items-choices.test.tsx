import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddItemsChoices } from '../add-items-choices';

afterEach(() => cleanup());

const renderChoices = (props: Partial<React.ComponentProps<typeof AddItemsChoices>> = {}) => {
  const onAddManually = vi.fn();
  const onImport = vi.fn();
  render(<AddItemsChoices onAddManually={onAddManually} onImport={onImport} {...props} />);
  return { onAddManually, onImport };
};

const importGroup = () => screen.getByRole('group', { name: 'Import from a file' });

function pickFormat(name: string) {
  fireEvent.click(within(importGroup()).getByRole('combobox', { name: 'File format' }));
  fireEvent.pointerDown(screen.getByRole('option', { name }), { pointerType: 'mouse' });
  fireEvent.click(screen.getByRole('option', { name }), { detail: 1 });
}

describe('AddItemsChoices', () => {
  describe('when nothing is picked yet', () => {
    it('offers manual entry', () => {
      renderChoices();

      expect(
        screen.getByRole('button', { name: 'Add items manually', description: /input and ground truth/i }),
      ).toBeDefined();
    });

    it('offers a file import that defaults to CSV', () => {
      renderChoices();

      const format = within(importGroup()).getByRole('combobox', { name: 'File format' });
      expect(format.textContent).toContain('CSV');
      expect(within(importGroup()).getByRole('button', { name: 'Import' })).toBeDefined();
    });
  });

  describe('when manual entry is chosen', () => {
    it('asks to add items manually', () => {
      const { onAddManually, onImport } = renderChoices();

      fireEvent.click(screen.getByRole('button', { name: 'Add items manually' }));

      expect(onAddManually).toHaveBeenCalledTimes(1);
      expect(onImport).not.toHaveBeenCalled();
    });
  });

  describe('when importing without changing the format', () => {
    it('asks for a CSV import', () => {
      const { onImport } = renderChoices();

      fireEvent.click(within(importGroup()).getByRole('button', { name: 'Import' }));

      expect(onImport).toHaveBeenCalledWith('csv');
    });
  });

  describe('when JSON is picked as the format', () => {
    it('asks for a JSON import', () => {
      const { onImport } = renderChoices();

      pickFormat('JSON');
      fireEvent.click(within(importGroup()).getByRole('button', { name: 'Import' }));

      expect(onImport).toHaveBeenCalledWith('json');
    });
  });

  describe('when an import hint is given', () => {
    it('describes the import with it', () => {
      renderChoices({ importHint: 'Or drop a file anywhere on this window.' });

      expect(importGroup().getAttribute('aria-describedby')).toBeTruthy();
      expect(within(importGroup()).getByText(/drop a file anywhere/i)).toBeDefined();
    });
  });
});
