// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DynamicForm } from '../dynamic-form';
import { jsonSchemaToZodRuntime } from '../json-schema-to-zod-runtime';

afterEach(() => cleanup());

describe('DynamicForm with a schema that accepts any value', () => {
  describe('when submitted without input', () => {
    it('submits instead of reporting the input as required', async () => {
      const onSubmit = vi.fn();
      render(<DynamicForm schema={jsonSchemaToZodRuntime({})} onSubmit={onSubmit} submitButtonLabel="Resume" />);

      fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit).toHaveBeenCalledWith(undefined);
      expect(screen.queryByText('Required')).toBeNull();
    });
  });
});
