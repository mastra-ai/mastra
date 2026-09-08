import { afterEach, describe, expect, it, vi } from 'vitest';

import { isRunningStandalone } from './standalone';

function stubWindow(overrides: { displayModeStandalone?: boolean; navigatorStandalone?: boolean }) {
  const matchMedia = vi.fn((query: string) => ({
    matches: query === '(display-mode: standalone)' && Boolean(overrides.displayModeStandalone),
  }));
  vi.stubGlobal('window', {
    matchMedia,
    navigator: overrides.navigatorStandalone === undefined ? {} : { standalone: overrides.navigatorStandalone },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isRunningStandalone', () => {
  it('returns true when display-mode: standalone matches', () => {
    stubWindow({ displayModeStandalone: true });
    expect(isRunningStandalone()).toBe(true);
  });

  it('returns true when iOS navigator.standalone is true', () => {
    stubWindow({ navigatorStandalone: true });
    expect(isRunningStandalone()).toBe(true);
  });

  it('returns false in a regular browser tab', () => {
    stubWindow({ navigatorStandalone: false });
    expect(isRunningStandalone()).toBe(false);
  });

  it('returns false when window is undefined', () => {
    vi.stubGlobal('window', undefined);
    expect(isRunningStandalone()).toBe(false);
  });
});
