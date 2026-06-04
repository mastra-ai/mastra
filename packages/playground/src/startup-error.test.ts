// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renderStartupError } from './startup-error';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('renderStartupError', () => {
  it('renders detailed startup errors into an empty root', () => {
    document.body.innerHTML = '<div id="root"></div>';

    renderStartupError(new Error('broken import'), { showDetails: true });

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Mastra Studio failed to start');
    expect(document.querySelector('pre')?.textContent).toContain('broken import');
  });

  it('hides raw details when diagnostics are disabled', () => {
    document.body.innerHTML = '<div id="root"></div>';

    renderStartupError(new Error('secret path'), { showDetails: false });

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Run Studio in development mode to view detailed diagnostics',
    );
    expect(document.querySelector('[role="alert"]')?.textContent).not.toContain('secret path');
    expect(document.querySelector('pre')).toBeNull();
  });

  it('does not replace an already rendered app', () => {
    document.body.innerHTML = '<div id="root"><div>Studio loaded</div></div>';

    renderStartupError(new Error('late error'), { showDetails: true });

    expect(document.getElementById('root')?.textContent).toBe('Studio loaded');
  });
});
