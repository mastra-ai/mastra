// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { DynamicForm } from '../dynamic-form';

afterEach(cleanup);

const requiredFields = [
  { kind: 'string', schema: z.string(), role: 'textbox', message: 'Required' },
  { kind: 'number', schema: z.number({ message: 'Enter a count' }), role: 'spinbutton', message: 'Enter a count' },
  {
    kind: 'enum',
    schema: z.enum(['fast', 'slow'], { message: 'Pick a mode' }),
    role: 'combobox',
    message: 'Pick a mode',
  },
  { kind: 'boolean', schema: z.boolean(), role: 'checkbox', message: 'Required' },
  { kind: 'date', schema: z.string().datetime(), role: 'button', message: 'Required' },
];

describe.each(requiredFields)('a required $kind field submitted empty', ({ schema, role, message }) => {
  it('marks its control invalid and describes it with the error', async () => {
    render(<DynamicForm schema={z.object({ value: schema })} onSubmit={() => {}} submitButtonLabel="Run" />);

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(message));
    const control = screen.getByRole(role, { name: /^Value/ });
    expect(control.getAttribute('aria-invalid')).toBe('true');
    const describedBy = (control.getAttribute('aria-describedby') ?? '').split(' ');
    expect(describedBy.map(id => document.getElementById(id)?.textContent)).toContain(message);
  });
});
