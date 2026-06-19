// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { DynamicForm } from '../dynamic-form';

afterEach(() => cleanup());

describe('DynamicForm readOnly', () => {
  it('marks string inputs read-only when readOnly is set (flat schema)', async () => {
    render(
      <DynamicForm
        schema={z.object({ value: z.string() })}
        defaultValues={{ value: 'hello' }}
        readOnly
        onSubmit={() => {}}
        submitButtonLabel="Run"
      />,
    );

    const input = (await screen.findByDisplayValue('hello')) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it('keeps string inputs editable when readOnly is not set', async () => {
    render(
      <DynamicForm
        schema={z.object({ value: z.string() })}
        defaultValues={{ value: 'hello' }}
        onSubmit={() => {}}
        submitButtonLabel="Run"
      />,
    );

    const input = (await screen.findByDisplayValue('hello')) as HTMLInputElement;
    expect(input.readOnly).toBe(false);
  });
});
