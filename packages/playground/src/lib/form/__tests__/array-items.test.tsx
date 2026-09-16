import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DynamicForm } from '../dynamic-form';

const schema = z.object({ documents: z.array(z.object({ title: z.string().min(1), text: z.string().min(1) })) });
const documents = [
  { title: 'First document', text: 'Keep this content' },
  { title: 'Second document', text: 'Another paragraph' },
];

afterEach(cleanup);

describe('Array item editing', () => {
  describe('when saved objects are collapsed', () => {
    it('identifies each item by its content and preserves edits after collapsing', async () => {
      const onSubmit = vi.fn();
      render(<DynamicForm schema={schema} defaultValues={{ documents }} onSubmit={onSubmit} submitButtonLabel="Run" />);

      fireEvent.click(screen.getByRole('button', { name: 'Item 2: Second document' }));
      fireEvent.change(await screen.findByRole('textbox', { name: /^Title/ }), { target: { value: 'Updated title' } });
      fireEvent.click(screen.getByRole('button', { name: 'Item 2: Updated title' }));
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          documents: [documents[0], { title: 'Updated title', text: 'Another paragraph' }],
        }),
      );
    });

    it('removes only the chosen item', async () => {
      const onSubmit = vi.fn();
      render(<DynamicForm schema={schema} defaultValues={{ documents }} onSubmit={onSubmit} submitButtonLabel="Run" />);
      fireEvent.click(screen.getByRole('button', { name: 'Remove item 1' }));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add Documents item' }));
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ documents: [documents[1]] }));
    });
  });

  describe('when an array is empty', () => {
    it('keeps the item for submission after finishing its inline edit', async () => {
      const onSubmit = vi.fn();
      render(
        <DynamicForm schema={schema} defaultValues={{ documents: [] }} onSubmit={onSubmit} submitButtonLabel="Run" />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add Documents item' }));
      fireEvent.change(await screen.findByRole('textbox', { name: /^Title/ }), { target: { value: 'Draft document' } });
      fireEvent.change(screen.getByRole('textbox', { name: /^Text/ }), { target: { value: 'Ready for this run' } });
      fireEvent.click(screen.getByRole('button', { name: 'Done editing item 1' }));
      expect(screen.getByRole('button', { name: 'Item 1: Draft document' }).getAttribute('aria-expanded')).toBe(
        'false',
      );
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Item 1: Draft document' }));
      expect(onSubmit).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({ documents: [{ title: 'Draft document', text: 'Ready for this run' }] }),
      );
    });

    it('opens a new item directly for editing', async () => {
      render(<DynamicForm schema={schema} defaultValues={{ documents: [] }} />);
      expect(screen.getByText('No items added')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Add Documents item' }));
      expect(await screen.findByRole('textbox', { name: /^Title/ })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Item 1' }).getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('when an array is read-only', () => {
    it('allows inspecting items without offering add or remove actions', async () => {
      render(<DynamicForm schema={schema} defaultValues={{ documents }} readOnly />);
      expect(screen.queryByRole('button', { name: 'Add Documents item' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove item 1' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Item 1: First document' }));
      expect(await screen.findByRole<HTMLTextAreaElement>('textbox', { name: /^Title/ })).toHaveProperty(
        'readOnly',
        true,
      );
    });
  });

  describe('when an item carries an identifier before its title', () => {
    it('names the row by its title and announces the missing field', async () => {
      const identified = z.object({
        documents: z.array(z.object({ id: z.string(), title: z.string().min(1), text: z.string().min(1) })),
      });
      render(
        <DynamicForm
          schema={identified}
          defaultValues={{ documents: [{ id: '0f8c2b64-2f1a-4d3e-9a77-12f4b0c9e5a1', title: 'Quarterly report' }] }}
          onSubmit={vi.fn()}
          submitButtonLabel="Run"
        />,
      );

      expect(screen.getByRole('button', { name: 'Item 1: Quarterly report' })).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect(await screen.findByRole('button', { name: 'Item 1: Quarterly report, Needs input' })).not.toBeNull();
    });
  });

  describe('when a collapsed item has a missing required field', () => {
    it('reveals the fields after validation fails', async () => {
      const onSubmit = vi.fn();
      render(
        <DynamicForm
          schema={schema}
          defaultValues={{ documents: [{ title: 'Incomplete document' }] }}
          onSubmit={onSubmit}
          submitButtonLabel="Run"
        />,
      );
      expect(screen.getByRole('button', { name: 'Item 1: Incomplete document' }).getAttribute('aria-expanded')).toBe(
        'false',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      expect(await screen.findByRole('textbox', { name: /^Text/ })).not.toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
