// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('a cross-field error shown on one field', () => {
  it('lets the form submit once another field fixes it', async () => {
    const onSubmit = vi.fn();
    const schema = z
      .object({ start: z.string(), end: z.string() })
      .refine(value => value.end > value.start, { message: 'End must be after start', path: ['end'] });
    render(<DynamicForm schema={schema} onSubmit={onSubmit} submitButtonLabel="Run" />);

    fireEvent.change(screen.getByRole('textbox', { name: /^Start/ }), { target: { value: 'b' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^End/ }), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getAllByText('End must be after start').length).toBeGreaterThan(0));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: /^Start/ }), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ start: '0', end: 'a' });
  });
});

describe('an error on a nested object', () => {
  it('shows the message without describing each control inside the object', async () => {
    const schema = z.object({
      address: z
        .object({ street: z.string(), city: z.string() })
        .refine(value => value.street !== value.city, { message: 'Street and city must differ' }),
    });
    render(<DynamicForm schema={schema} onSubmit={() => {}} submitButtonLabel="Run" />);
    fireEvent.click(screen.getByRole('button', { name: 'Address' }));

    fireEvent.change(screen.getByRole('textbox', { name: /^Street/ }), { target: { value: 'same' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^City/ }), { target: { value: 'same' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Street and city must differ'));
    const street = screen.getByRole('textbox', { name: /^Street/ });
    expect(street.getAttribute('aria-invalid')).toBeNull();
    const describedBy = (street.getAttribute('aria-describedby') ?? '').split(' ');
    expect(describedBy.map(id => document.getElementById(id)?.textContent)).not.toContain(
      'Street and city must differ',
    );
  });
});

describe('a record field', () => {
  it('names the group by the field and keeps each key and value apart', () => {
    render(
      <DynamicForm schema={z.object({ headers: z.record(z.string()) })} onSubmit={() => {}} submitButtonLabel="Run" />,
    );

    const group = screen.getByRole('group', { name: /^Headers/ });
    const key = screen.getByRole('textbox', { name: 'Key' });
    const value = screen.getByRole('textbox', { name: 'Value' });
    expect(group.contains(key)).toBe(true);
    expect(key.id).not.toBe(value.id);
  });
});
