import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ZodType } from 'zod';
import { z } from 'zod';

import type { ExecuteTool } from '../../utils/tool-run';
import { ToolPlayground } from '../tool-playground';

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="Code editor" value={value} onChange={event => onChange?.(event.target.value)} />
  ),
}));

interface HarnessProps {
  zodInputSchema: ZodType;
  execute: ExecuteTool;
}

/** Runs the tool through a real mutation, the way the drawers do. */
function PlaygroundHarness({ zodInputSchema, execute }: HarnessProps) {
  const { mutateAsync, status, data, error } = useMutation({
    mutationFn: ({ input, requestContext }: { input: unknown; requestContext?: Record<string, unknown> }) =>
      execute(input, requestContext),
  });

  return (
    <ToolPlayground
      execution={{
        execute: (input, requestContext) => mutateAsync({ input, requestContext }),
        status,
        output: data,
        error,
      }}
      requestContextEntityType="tool"
      requestContextEntityId="test-tool"
      zodInputSchema={zodInputSchema}
    />
  );
}

function renderPlayground({
  zodInputSchema = z.object({}),
  execute = vi.fn<ExecuteTool>().mockResolvedValue(undefined),
}: {
  zodInputSchema?: ZodType;
  execute?: ExecuteTool;
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlaygroundHarness zodInputSchema={zodInputSchema} execute={execute} />
    </QueryClientProvider>,
  );
}

describe('ToolPlayground', () => {
  describe('when the tool takes no input', () => {
    it('says it can run as is', () => {
      renderPlayground();

      expect(screen.getByText('This tool takes no input. Run it as is.')).not.toBeNull();
    });

    it('still offers the request context popover', () => {
      renderPlayground();

      expect(screen.getByRole('button', { name: 'Request context' })).not.toBeNull();
    });
  });

  describe('when the tool has not run yet', () => {
    it('shows an empty response', () => {
      renderPlayground();

      expect(screen.getByText('No response yet')).not.toBeNull();
    });
  });

  describe('when the tool resolves', () => {
    it('shows the output as JSON with a success status', async () => {
      renderPlayground({ execute: vi.fn().mockResolvedValue({ dish: 'pasta' }) });

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect(await screen.findByText('Success')).not.toBeNull();
      expect(screen.getByText(/"dish": "pasta"/)).not.toBeNull();
    });
  });

  describe('when the tool rejects', () => {
    it('shows the error message with an error status', async () => {
      renderPlayground({ execute: vi.fn().mockRejectedValue(new Error('Out of ingredients')) });

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect(await screen.findByText('Error')).not.toBeNull();
      expect(screen.getByText(/Out of ingredients/)).not.toBeNull();
    });
  });

  describe('when the request is edited as JSON', () => {
    const zodInputSchema = z.object({ city: z.string() });
    const jsonEditor = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' });
    const editJson = (value: string) => fireEvent.change(jsonEditor(), { target: { value } });

    it('runs the tool with the JSON input', async () => {
      const execute = vi.fn<ExecuteTool>().mockResolvedValue(undefined);
      renderPlayground({ zodInputSchema, execute });

      fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
      editJson('{"city":"Lisbon"}');
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      await waitFor(() => expect(execute.mock.calls[0]?.[0]).toEqual({ city: 'Lisbon' }));
    });

    it('carries the JSON back into the form', async () => {
      renderPlayground({ zodInputSchema });

      fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
      editJson('{"city":"Lisbon"}');
      fireEvent.click(screen.getByRole('tab', { name: 'Form' }));

      expect(await screen.findByDisplayValue('Lisbon')).not.toBeNull();
    });

    it('shows a schema error instead of running', async () => {
      const execute = vi.fn<ExecuteTool>().mockResolvedValue(undefined);
      renderPlayground({ zodInputSchema, execute });

      fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
      editJson('{"city":1}');
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect((await screen.findByRole('alert')).textContent).toContain('city:');
      expect(execute).not.toHaveBeenCalled();
    });

    it('keeps the JSON view while the JSON is invalid', async () => {
      renderPlayground({ zodInputSchema });

      fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
      editJson('{"city":');
      fireEvent.click(screen.getByRole('tab', { name: 'Form' }));

      expect((await screen.findByRole('alert')).textContent).toContain('Invalid JSON');
      expect(jsonEditor().value).toBe('{"city":');
    });
  });
});
