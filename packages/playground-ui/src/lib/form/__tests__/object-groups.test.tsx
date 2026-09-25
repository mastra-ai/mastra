// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DynamicForm } from '../dynamic-form';

const schema = z.object({ author: z.object({ name: z.string().min(1), email: z.string().optional() }) });

afterEach(cleanup);

describe('Object group editing', () => {
  describe('when a collapsed group has a missing required field', () => {
    it('reveals the group and flags it after validation fails', async () => {
      const onSubmit = vi.fn();
      render(<DynamicForm schema={schema} onSubmit={onSubmit} submitButtonLabel="Run" />);
      expect(screen.getByRole('button', { name: 'Author' }).getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect(await screen.findByRole('textbox', { name: /^Name/ })).not.toBeNull();
      expect(screen.getByRole('button', { name: /^Author.*Needs input/ })).not.toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
