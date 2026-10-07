// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { DynamicForm } from '../dynamic-form';

afterEach(cleanup);

function enterAmountAndSubmit(amount: number) {
  const input = screen.getByRole('spinbutton', { name: /^Amount/ });
  fireEvent.change(input, { target: { value: String(amount) } });
  fireEvent.blur(input);
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
}

describe('DynamicForm numeric fields', () => {
  describe.each([
    { constraint: 'any number', schema: z.number(), amount: 1.5 },
    { constraint: 'bounded decimals', schema: z.number().min(0).max(2), amount: 0.7 },
    { constraint: 'a decimal default', schema: z.number().default(1.5), amount: 2.25 },
  ])('when the schema accepts $constraint', ({ schema, amount }) => {
    it('submits the entered decimal as a number', async () => {
      const onSubmit = vi.fn<(values: { amount: number }) => void>();
      render(<DynamicForm schema={z.object({ amount: schema })} onSubmit={onSubmit} submitButtonLabel="Run" />);

      enterAmountAndSubmit(amount);

      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ amount }));
    });
  });

  describe.each([
    {
      constraint: 'an integer',
      schema: z.number().int('Enter a whole number'),
      amount: 1.5,
      message: 'Enter a whole number',
    },
    {
      constraint: 'a maximum',
      schema: z.number().max(2, 'Enter at most 2'),
      amount: 2.5,
      message: 'Enter at most 2',
    },
    {
      constraint: 'a multiple',
      schema: z.number().multipleOf(0.25, 'Enter a multiple of 0.25'),
      amount: 0.8,
      message: 'Enter a multiple of 0.25',
    },
  ])('when the schema requires $constraint', ({ schema, amount, message }) => {
    it('shows the schema error and prevents submission', async () => {
      const onSubmit = vi.fn<(values: { amount: number }) => void>();
      render(<DynamicForm schema={z.object({ amount: schema })} onSubmit={onSubmit} submitButtonLabel="Run" />);

      enterAmountAndSubmit(amount);

      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(message));
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
