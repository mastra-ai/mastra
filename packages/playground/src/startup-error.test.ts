import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderStartupError } from './startup-error';

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function importWithEnv(env: { DEV: boolean; showDetails?: string }) {
  vi.stubEnv('DEV', env.DEV);
  vi.stubEnv('VITE_MASTRA_STUDIO_SHOW_STARTUP_ERROR_DETAILS', env.showDetails ?? '');
  vi.resetModules();

  return (await import('./startup-error')).renderStartupError;
}

function alertText() {
  return document.querySelector('[role="alert"]')?.textContent ?? '';
}

describe('renderStartupError', () => {
  describe('when details are shown and the root is empty', () => {
    it('announces the failure through an alert landmark', () => {
      document.body.innerHTML = '<div id="root"></div>';

      renderStartupError(new Error('broken import'), { showDetails: true });

      expect(document.querySelector('main[role="alert"]')?.querySelector('h1')?.textContent).toBe(
        'Mastra Studio failed to start',
      );
    });

    it('points the reader at the Vite terminal and browser console', () => {
      document.body.innerHTML = '<div id="root"></div>';

      renderStartupError(new Error('broken import'), { showDetails: true });

      expect(document.querySelector('[role="alert"] p')?.textContent).toBe(
        'The startup module failed before React could render. Check the Vite terminal and browser console for the original request details.',
      );
    });

    it('renders the raw error inside a diagnostics block', () => {
      document.body.innerHTML = '<div id="root"></div>';

      renderStartupError(new Error('broken import'), { showDetails: true });

      expect(document.querySelector('pre')?.textContent).toContain('broken import');
    });
  });

  describe('when the thrown error carries no stack', () => {
    it('falls back to the error message', () => {
      document.body.innerHTML = '<div id="root"></div>';
      const error = new Error('stackless failure');
      error.stack = '';

      renderStartupError(error, { showDetails: true });

      expect(document.querySelector('pre')?.textContent).toBe('stackless failure');
    });
  });

  describe('when the thrown value is not an Error', () => {
    it('stringifies the raw value', () => {
      document.body.innerHTML = '<div id="root"></div>';

      renderStartupError({ toString: () => 'plain object failure' }, { showDetails: true });

      expect(document.querySelector('pre')?.textContent).toBe('plain object failure');
    });
  });

  describe('when details are hidden', () => {
    it('tells the reader to switch to development mode', () => {
      document.body.innerHTML = '<div id="root"></div>';

      renderStartupError(new Error('secret path'), { showDetails: false });

      expect(document.querySelector('[role="alert"] p')?.textContent).toBe(
        'The startup module failed before React could render. Run Studio in development mode to view detailed diagnostics.',
      );
    });

    it('leaks nothing from the original error', () => {
      document.body.innerHTML = '<div id="root"></div>';

      renderStartupError(new Error('secret path'), { showDetails: false });

      expect(alertText()).not.toContain('secret path');
      expect(document.querySelector('pre')).toBeNull();
    });
  });

  describe('when the app already rendered into the root', () => {
    it('does not replace the rendered app', () => {
      document.body.innerHTML = '<div id="root"><div>Studio loaded</div></div>';

      renderStartupError(new Error('late error'), { showDetails: true });

      expect(document.getElementById('root')?.textContent).toBe('Studio loaded');
    });
  });

  describe('when there is no root element at all', () => {
    it('renders nothing rather than throwing', () => {
      document.body.innerHTML = '<div id="app"></div>';

      expect(() => renderStartupError(new Error('no root'), { showDetails: true })).not.toThrow();
      expect(document.querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('when showDetails is left to the environment default in development', () => {
    it('shows the raw diagnostics', async () => {
      document.body.innerHTML = '<div id="root"></div>';
      const render = await importWithEnv({ DEV: true, showDetails: '' });

      render(new Error('dev failure'));

      expect(document.querySelector('pre')?.textContent).toContain('dev failure');
    });
  });

  describe('when showDetails is left to the environment default in a production build opted in', () => {
    it('shows the raw diagnostics', async () => {
      document.body.innerHTML = '<div id="root"></div>';
      const render = await importWithEnv({ DEV: false, showDetails: 'true' });

      render(new Error('opted in failure'));

      expect(document.querySelector('pre')?.textContent).toContain('opted in failure');
    });
  });

  describe('when showDetails is left to the environment default in a production build', () => {
    it('hides the raw diagnostics', async () => {
      document.body.innerHTML = '<div id="root"></div>';
      const render = await importWithEnv({ DEV: false, showDetails: 'false' });

      render(new Error('prod failure'));

      expect(document.querySelector('pre')).toBeNull();
      expect(alertText()).not.toContain('prod failure');
    });
  });
});
