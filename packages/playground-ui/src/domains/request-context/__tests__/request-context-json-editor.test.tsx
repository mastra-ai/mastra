// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { RequestContextProvider, useRequestContext } from '../context/request-context-provider';
import { RunOptionsContent } from '@/domains/run-options/components/run-options-content';

const ENTITY_KEY = 'agent:weather-agent';

type PresetWindow = typeof window & { MASTRA_REQUEST_CONTEXT_PRESETS?: string };

function ContextProbe() {
  const { requestContext } = useRequestContext();
  return <pre data-testid="context">{JSON.stringify(requestContext)}</pre>;
}

// The JSON editor is headless: it registers its draft with the surrounding run options,
// which own the single "Save" button.
const renderEditor = () =>
  render(
    <RequestContextProvider entityKey={ENTITY_KEY}>
      <RunOptionsContent />
      <ContextProbe />
    </RequestContextProvider>,
  );

const selectPreset = async (name: string) => {
  fireEvent.click(screen.getByRole('combobox'));
  const option = await screen.findByRole('option', { name });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
};

describe('RequestContextJsonEditor', () => {
  beforeAll(() => {
    if (typeof window.PointerEvent === 'undefined') {
      window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
    }
  });

  beforeEach(() => {
    window.localStorage.clear();
    delete (window as PresetWindow).MASTRA_REQUEST_CONTEXT_PRESETS;
  });

  afterEach(() => {
    cleanup();
  });

  describe('when no presets are configured', () => {
    it('renders the editor without a preset selector and a disabled save button', async () => {
      renderEditor();

      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
      expect(screen.queryByRole('combobox')).toBeNull();
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    }, 15_000);
  });

  describe('when presets are injected on window', () => {
    beforeEach(() => {
      (window as PresetWindow).MASTRA_REQUEST_CONTEXT_PRESETS = JSON.stringify({
        French: { locale: 'fr' },
      });
    });

    it('fills the editor from the preset and saves it into the entity request context', async () => {
      renderEditor();
      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();

      await selectPreset('French');

      const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
      await waitFor(() => expect(saveButton.disabled).toBe(false));
      expect(document.querySelector('.cm-content')?.textContent).toContain('"locale": "fr"');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => expect(screen.getByTestId('context').textContent).toBe('{"locale":"fr"}'));
      expect(saveButton.disabled).toBe(true);
    }, 15_000);

    it('reverts the draft back to the saved value', async () => {
      renderEditor();
      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();

      await selectPreset('French');
      const revertButton = await screen.findByRole('button', { name: /revert request context changes/i });

      fireEvent.click(revertButton);

      await waitFor(() =>
        expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true),
      );
      expect(screen.getByTestId('context').textContent).toBe('{}');
    }, 15_000);
  });

  describe('when the entity already has a persisted request context', () => {
    it('shows the persisted value in the editor', async () => {
      window.localStorage.setItem(`mastra:request-context:${ENTITY_KEY}`, JSON.stringify({ userId: 'u-1' }));

      renderEditor();
      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();

      await waitFor(() => expect(document.querySelector('.cm-content')?.textContent).toContain('"userId": "u-1"'));
    }, 15_000);
  });
});
