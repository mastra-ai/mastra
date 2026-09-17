import type { AutoFormFieldProps } from '@autoform/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FormHTMLAttributes, PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CustomAutoForm } from '../custom-auto-form';
import { DynamicForm } from '../dynamic-form';
import { CustomZodProvider } from '../zod-provider';

const uiComponents = {
  Form: ({ children, ...props }: PropsWithChildren<FormHTMLAttributes<HTMLFormElement>>) => (
    <form {...props}>{children}</form>
  ),
  FieldWrapper: ({ label, children }: PropsWithChildren<{ label: string }>) => (
    <label>
      {label}
      {children}
    </label>
  ),
  SubmitButton: ({ children }: PropsWithChildren) => <button type="submit">{children}</button>,
  ErrorMessage: ({ error }: { error: string }) => <p>{error}</p>,
  ObjectWrapper: ({ children }: PropsWithChildren) => <fieldset>{children}</fieldset>,
  ArrayWrapper: ({ children }: PropsWithChildren) => <fieldset>{children}</fieldset>,
  ArrayElementWrapper: ({ children }: PropsWithChildren) => <div>{children}</div>,
};

function SelectProbe({ value, inputProps }: AutoFormFieldProps) {
  return (
    <div>
      <output data-testid="selected-mode">{String(value ?? '')}</output>
      <button
        type="button"
        onClick={() => {
          inputProps.onChange({
            target: { name: inputProps.name, value: 'b' },
          });
        }}
      >
        Select b
      </button>
    </div>
  );
}

describe('CustomAutoForm', () => {
  it('updates controlled enum fields when their form value changes', async () => {
    const onSubmit = vi.fn();
    const schema = new CustomZodProvider(
      z.object({
        mode: z.enum(['a', 'b']).default('a'),
      }),
    );

    render(
      <CustomAutoForm
        schema={schema}
        uiComponents={uiComponents}
        formComponents={{ select: SelectProbe }}
        onSubmit={onSubmit}
        withSubmit
      />,
    );

    expect(screen.getByTestId('selected-mode').textContent).toBe('a');

    fireEvent.click(screen.getByRole('button', { name: 'Select b' }));

    await expect.poll(() => screen.getByTestId('selected-mode').textContent).toBe('b');

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ mode: 'b' }, expect.anything());
    });
  });

  it('submits Date values without dropping them during empty-value cleanup', async () => {
    const onSubmit = vi.fn();
    const startDate = new Date('2024-01-01T00:00:00Z');
    const schema = new CustomZodProvider(
      z.object({
        startDate: z.date(),
        note: z.string().optional(),
      }),
    );

    render(
      <CustomAutoForm
        schema={schema}
        uiComponents={uiComponents}
        formComponents={{ date: () => null }}
        defaultValues={{ startDate, note: '' }}
        onSubmit={onSubmit}
        withSubmit
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ startDate }, expect.anything());
    });
    expect(onSubmit.mock.calls[0]![0].startDate).toBeInstanceOf(Date);
  });

  describe('when an optional object has an untouched required number field', () => {
    it('submits without the optional group through the generated form', async () => {
      const onSubmit = vi.fn();

      render(
        <DynamicForm
          schema={z.object({ options: z.object({ limit: z.number() }).optional() })}
          onSubmit={onSubmit}
          submitButtonLabel="Run"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({});
      });
    });
  });

  describe('when an optional object has a populated sibling and a blank required number', () => {
    it('rejects the group instead of discarding the supplied values', async () => {
      const onSubmit = vi.fn();

      render(
        <DynamicForm
          schema={z.object({ options: z.object({ limit: z.number(), label: z.string().optional() }).optional() })}
          onSubmit={onSubmit}
          submitButtonLabel="Run"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Options' }));
      fireEvent.change(await screen.findByRole('textbox', { name: /^Label/ }), { target: { value: 'Populated' } });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      await waitFor(() => {
        const invalid = screen.getByRole('spinbutton', { name: /^Limit/ }).getAttribute('aria-invalid');
        expect(invalid).not.toBeNull();
        expect(invalid).not.toBe('false');
      });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
