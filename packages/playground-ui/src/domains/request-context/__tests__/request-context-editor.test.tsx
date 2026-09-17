// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RequestContextProvider } from '../context/request-context-provider';
import { RequestContextSchemaFormRendererProvider } from '../context/schema-form-renderer';
import type { RequestContextSchemaFormRenderer } from '../context/schema-form-renderer';
import { RunOptionsContent } from '@/domains/run-options/components/run-options-content';
import type { RunOptionsContentProps } from '@/domains/run-options/components/run-options-content';

// `RequestContextEditor` and its form/JSON editors are headless: they register their drafts
// with the surrounding run options, which own the single "Save" button.
const renderEditor = (props: RunOptionsContentProps = {}, renderer?: RequestContextSchemaFormRenderer) => {
  const editor = (
    <RequestContextProvider entityKey="workflow:my-wf">
      <RunOptionsContent {...props} />
    </RequestContextProvider>
  );

  return render(
    renderer ? (
      <RequestContextSchemaFormRendererProvider render={renderer}>{editor}</RequestContextSchemaFormRendererProvider>
    ) : (
      editor
    ),
  );
};

describe('RequestContextEditor', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('when no schema is provided', () => {
    it('renders only the JSON editor without a mode switcher', async () => {
      renderEditor();

      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Form' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'JSON' })).toBeNull();
    }, 15_000);
  });

  describe('when a form slot is provided', () => {
    it('shows the form by default and switches to the JSON editor', async () => {
      renderEditor({ requestContextFormSlot: <div data-testid="schema-form">schema form</div> });

      expect(screen.getByTestId('schema-form')).not.toBeNull();
      expect(screen.queryByText('Request Context (JSON)')).toBeNull();
      expect(screen.getByRole('button', { name: 'Form' }).getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(screen.getByRole('button', { name: 'JSON' }));

      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
      expect(screen.queryByTestId('schema-form')).toBeNull();
      expect(screen.getByRole('button', { name: 'JSON' }).getAttribute('aria-pressed')).toBe('true');
    }, 15_000);
  });

  describe('when a schema is provided', () => {
    it('renders the schema form through the configured renderer and saves into the request context', async () => {
      const renderer: RequestContextSchemaFormRenderer = ({ requestContextSchema, onValuesChange }) => (
        <div>
          <span data-testid="schema">{requestContextSchema}</span>
          <button type="button" onClick={() => onValuesChange({ userId: 'u-1' })}>
            Edit
          </button>
        </div>
      );

      renderEditor({ requestContextSchema: '{"type":"object"}' }, renderer);

      expect(screen.getByTestId('schema').textContent).toBe('{"type":"object"}');
      expect(screen.getByRole('button', { name: 'Form' }).getAttribute('aria-pressed')).toBe('true');

      const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      await waitFor(() => expect(saveButton.disabled).toBe(false));

      fireEvent.click(saveButton);

      await waitFor(() =>
        expect(JSON.parse(window.localStorage.getItem('mastra:request-context:workflow:my-wf') ?? '{}')).toEqual({
          userId: 'u-1',
        }),
      );
      expect(saveButton.disabled).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
    }, 15_000);
  });
});
