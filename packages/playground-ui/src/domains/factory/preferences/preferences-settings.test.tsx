// @vitest-environment jsdom
import { act, fireEvent, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesSettings } from './preferences-settings';

const SAVED_SOUND_KEY = 'mastracode.doneSound';

let root: Root | undefined;
let container: HTMLElement;
let recoverableErrors: unknown[];

/** Renders on a "server" with no localStorage, then hydrates in the browser. */
async function renderOnServerThenHydrate() {
  vi.stubGlobal('localStorage', undefined);
  container.innerHTML = renderToString(<PreferencesSettings />);
  vi.unstubAllGlobals();
  const serverSound = soundPicker().textContent;
  await act(async () => {
    root = hydrateRoot(container, <PreferencesSettings />, {
      onRecoverableError: error => recoverableErrors.push(error),
    });
  });
  return serverSound;
}

const soundPicker = () => within(container).getByRole('combobox', { name: 'Completion sound' });
const soundSwitch = () => within(container).getByRole('switch', { name: 'Play a sound' });

describe('PreferencesSettings', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    recoverableErrors = [];
    localStorage.setItem(SAVED_SOUND_KEY, 'arcade');
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    container.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('given a saved sound, renders the default on the server and the saved sound once hydrated', async () => {
    const serverSound = await renderOnServerThenHydrate();

    expect(serverSound).toBe('Chime');
    expect(recoverableErrors).toEqual([]);
    expect(soundPicker().textContent).toBe('Arcade');
  });

  it('given the saved sound arrives after hydration, muting and unmuting brings that sound back', async () => {
    await renderOnServerThenHydrate();

    fireEvent.click(soundSwitch());
    expect(localStorage.getItem(SAVED_SOUND_KEY)).toBe('none');
    expect(soundSwitch().getAttribute('aria-checked')).toBe('false');

    fireEvent.click(soundSwitch());
    expect(localStorage.getItem(SAVED_SOUND_KEY)).toBe('arcade');
    expect(soundPicker().textContent).toBe('Arcade');
  });
});
