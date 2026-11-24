// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../Button';
import { Field, FieldError, FieldLabel } from '../Field';
import { Input } from '../Input';
import { Form } from './form';

afterEach(() => cleanup());

function renderRequiredForm() {
  const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
  render(
    <Form onSubmit={onSubmit}>
      <Field>
        <FieldLabel>Dataset name</FieldLabel>
        <Input name="dataset" required />
        <FieldError />
      </Field>
      <Button type="submit">Create</Button>
    </Form>,
  );
  return { onSubmit, input: screen.getByRole('textbox', { name: 'Dataset name' }) };
}

describe('Form', () => {
  it('blocks submit on an empty required field, focuses it and shows the validation message', () => {
    const { onSubmit, input } = renderRequiredForm();

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).not.toBe('');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('submits once the required field is filled', () => {
    const { onSubmit, input } = renderRequiredForm();

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.change(input, { target: { value: 'Golden answers' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows no message and describes nothing before the user submits', () => {
    const { input } = renderRequiredForm();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
});
