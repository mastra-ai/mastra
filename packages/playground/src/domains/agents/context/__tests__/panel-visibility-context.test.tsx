// @vitest-environment jsdom
import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PanelVisibilityProvider } from '../panel-visibility-context';
import { usePanelVisibility } from '../use-panel-visibility';

const STORAGE_KEY = 'agent-panel-visibility';

function Probe() {
  const { visibility, toggleOverview, toggleMemory } = usePanelVisibility();
  return (
    <div>
      <span data-testid="overview">{String(visibility.overview)}</span>
      <span data-testid="memory">{String(visibility.memory)}</span>
      <button data-testid="toggle-overview" onClick={toggleOverview}>
        o
      </button>
      <button data-testid="toggle-memory" onClick={toggleMemory}>
        m
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <PanelVisibilityProvider>
      <Probe />
    </PanelVisibilityProvider>,
  );
}

describe('PanelVisibilityProvider', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('defaults overview and memory to hidden when sessionStorage is empty', () => {
    renderProvider();
    expect(screen.getByTestId('overview').textContent).toBe('false');
    expect(screen.getByTestId('memory').textContent).toBe('false');
  });

  it('honors previously stored visibility values', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ overview: true, memory: true }));
    renderProvider();
    expect(screen.getByTestId('overview').textContent).toBe('true');
    expect(screen.getByTestId('memory').textContent).toBe('true');
  });

  it('falls back to false for missing keys in stored JSON', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ overview: true }));
    renderProvider();
    expect(screen.getByTestId('overview').textContent).toBe('true');
    expect(screen.getByTestId('memory').textContent).toBe('false');
  });

  it('falls back to all-false when stored JSON is malformed', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json');
    renderProvider();
    expect(screen.getByTestId('overview').textContent).toBe('false');
    expect(screen.getByTestId('memory').textContent).toBe('false');
  });

  it('persists toggled values to sessionStorage', () => {
    renderProvider();
    act(() => {
      screen.getByTestId('toggle-overview').click();
    });
    expect(screen.getByTestId('overview').textContent).toBe('true');
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      overview: true,
      memory: false,
    });
  });
});
