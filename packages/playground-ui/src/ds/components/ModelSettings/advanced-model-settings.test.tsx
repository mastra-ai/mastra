// @vitest-environment jsdom
import { EditorView } from '@codemirror/view';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { format } from 'prettier/standalone';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdvancedModelSettingsProps } from './advanced-model-settings';
import { AdvancedModelSettings } from './advanced-model-settings';

vi.mock('prettier/standalone', () => ({ format: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function editProviderOptions(text: string) {
  const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Provider Options' }));
  if (!view) throw new Error('Provider options editor is missing');
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }));
}

describe('AdvancedModelSettings', () => {
  describe('when initial formatting finishes after the user types', () => {
    it('keeps the newer provider options draft', async () => {
      const formatting = Promise.withResolvers<string>();
      vi.mocked(format).mockReturnValueOnce(formatting.promise);
      const onChange = vi.fn<AdvancedModelSettingsProps['onChange']>();
      render(<AdvancedModelSettings value={{}} onChange={onChange} />);
      await waitFor(() => expect(format).toHaveBeenCalledOnce());
      editProviderOptions('{"openai":{"reasoningEffort":"high"}}');
      await act(async () => formatting.resolve('{}'));
      fireEvent.click(screen.getByRole('button', { name: 'Save Provider Options' }));
      expect(onChange).toHaveBeenLastCalledWith({ providerOptions: { openai: { reasoningEffort: 'high' } } });
    });
  });

  describe('when manual formatting finishes after another edit', () => {
    it('keeps the newer draft instead of restoring the formatted snapshot', async () => {
      vi.mocked(format).mockResolvedValueOnce('{}');
      const onChange = vi.fn<AdvancedModelSettingsProps['onChange']>();
      render(<AdvancedModelSettings value={{}} onChange={onChange} />);
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Provider Options' }).textContent).toBe('{}'));
      editProviderOptions('{"openai":{"reasoningEffort":"low"}}');
      const formatting = Promise.withResolvers<string>();
      vi.mocked(format).mockReturnValueOnce(formatting.promise);
      fireEvent.click(screen.getByRole('button', { name: 'Format Provider Options' }));
      await waitFor(() => expect(format).toHaveBeenCalledTimes(2));
      editProviderOptions('{"openai":{"reasoningEffort":"high"}}');
      await act(async () => formatting.resolve('{"openai": {"reasoningEffort": "low"}}'));
      fireEvent.click(screen.getByRole('button', { name: 'Save Provider Options' }));
      expect(onChange).toHaveBeenLastCalledWith({ providerOptions: { openai: { reasoningEffort: 'high' } } });
    });
  });
});
