// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { DynamicForm } from '../dynamic-form';

afterEach(cleanup);

const renderForm = () => {
  const onSubmit = vi.fn<(values: { name: string }) => void>();
  render(<DynamicForm schema={z.object({ name: z.string() })} onSubmit={onSubmit} submitButtonLabel="Run" />);
  const field = screen.getByRole('textbox', { name: /^Name/ });
  fireEvent.change(field, { target: { value: 'YJ' } });
  return { onSubmit, field };
};

describe('DynamicForm text fields', () => {
  describe('when Enter is pressed', () => {
    it('submits the form, like any other input', async () => {
      const { onSubmit, field } = renderForm();

      fireEvent.keyDown(field, { key: 'Enter' });

      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'YJ' }));
    });
  });

  describe('when Shift+Enter is pressed', () => {
    it('leaves the form unsubmitted so a new line can be added', async () => {
      const { onSubmit, field } = renderForm();

      fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('when Enter confirms an IME composition', () => {
    it('leaves the form unsubmitted', async () => {
      const { onSubmit, field } = renderForm();

      fireEvent.keyDown(field, { key: 'Enter', isComposing: true });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
