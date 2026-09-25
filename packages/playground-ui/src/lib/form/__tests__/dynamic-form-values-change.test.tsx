// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { DynamicForm } from '../dynamic-form';

afterEach(() => cleanup());

describe('DynamicForm value reporting', () => {
  describe('when the schema is a bare primitive', () => {
    it('reports the unwrapped value on init and on every edit', async () => {
      const onValuesChange = vi.fn();
      render(<DynamicForm schema={z.string()} defaultValues="hello" onValuesChange={onValuesChange} />);

      await waitFor(() => expect(onValuesChange).toHaveBeenCalledWith('hello'));

      fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'hello world' } });

      await waitFor(() => expect(onValuesChange).toHaveBeenLastCalledWith('hello world'));
    });
  });

  describe('when the schema is an object', () => {
    it('reports the whole object rather than a wrapped field', async () => {
      const onValuesChange = vi.fn();
      render(
        <DynamicForm
          schema={z.object({ city: z.string() })}
          defaultValues={{ city: 'Paris' }}
          onValuesChange={onValuesChange}
        />,
      );

      await waitFor(() => expect(onValuesChange).toHaveBeenCalledWith({ city: 'Paris' }));

      fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Lyon' } });

      await waitFor(() => expect(onValuesChange).toHaveBeenLastCalledWith({ city: 'Lyon' }));
    });
  });

  describe('when the listener only appears after the form is mounted', () => {
    it('starts reporting instead of staying silent for the rest of the form life', async () => {
      const onValuesChange = vi.fn();
      const { rerender } = render(<DynamicForm schema={z.object({ city: z.string() })} />);

      await screen.findByRole('textbox');
      rerender(<DynamicForm schema={z.object({ city: z.string() })} onValuesChange={onValuesChange} />);

      fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Lyon' } });

      await waitFor(() => expect(onValuesChange).toHaveBeenLastCalledWith({ city: 'Lyon' }));
    });
  });
});
