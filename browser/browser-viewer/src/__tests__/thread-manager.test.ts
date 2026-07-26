import { describe, it, expect } from 'vitest';
import { resolveViewport, DEFAULT_VIEWPORT } from '../thread-manager';

describe('resolveViewport', () => {
  it('falls back to the default when the viewport is absent (undefined)', () => {
    expect(resolveViewport(undefined)).toEqual(DEFAULT_VIEWPORT);
  });

  it('returns a fresh default object (not a shared reference)', () => {
    const first = resolveViewport(undefined);
    const second = resolveViewport(undefined);
    expect(first).toEqual(DEFAULT_VIEWPORT);
    expect(first).not.toBe(second);
  });

  it('preserves an explicit null (match window / no emulation)', () => {
    // The bug this guards: `?? DEFAULT` would collapse null back into a fixed
    // viewport and silently break match-window mode. null must survive so
    // Playwright's newContext disables fixed-viewport emulation.
    expect(resolveViewport(null)).toBeNull();
  });

  it('passes a fixed viewport object through unchanged', () => {
    const viewport = { width: 1440, height: 900 };
    expect(resolveViewport(viewport)).toBe(viewport);
  });
});
