import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { DynamicForm } from '../dynamic-form';

afterEach(() => cleanup());

describe('DynamicForm', () => {
  describe('when the schema is a root-level primitive', () => {
    it('labels the generated field as Input', async () => {
      render(<DynamicForm schema={z.string()} onSubmit={() => {}} />);

      expect(await screen.findByLabelText<HTMLTextAreaElement>(/^Input/)).not.toBeNull();
    });
  });

  describe('when readOnly is set', () => {
    it('marks string fields read-only', async () => {
      render(
        <DynamicForm
          schema={z.object({ value: z.string() })}
          defaultValues={{ value: 'hello' }}
          readOnly
          onSubmit={() => {}}
          submitButtonLabel="Run"
        />,
      );

      const input = await screen.findByDisplayValue<HTMLTextAreaElement>('hello');
      expect(input.readOnly).toBe(true);
    });
  });

  describe('when readOnly is not set', () => {
    it('keeps string fields editable', async () => {
      render(
        <DynamicForm
          schema={z.object({ value: z.string() })}
          defaultValues={{ value: 'hello' }}
          onSubmit={() => {}}
          submitButtonLabel="Run"
        />,
      );

      const input = await screen.findByDisplayValue<HTMLTextAreaElement>('hello');
      expect(input.readOnly).toBe(false);
    });
  });
});
