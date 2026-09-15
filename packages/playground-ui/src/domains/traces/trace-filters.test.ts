// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { loadTraceFiltersFromStorage, saveTraceFiltersToStorage } from './trace-filters';

const KEY = 'test:traces:saved-filters';

describe('saveTraceFiltersToStorage', () => {
  beforeEach(() => localStorage.clear());

  it('persists filters together with a relative date preset', () => {
    saveTraceFiltersToStorage(new URLSearchParams('status=error&datePreset=last-7d'), KEY);

    expect(loadTraceFiltersFromStorage(KEY)?.toString()).toBe('status=error&datePreset=last-7d');
  });

  it('never persists a custom date range, since absolute dates go stale', () => {
    saveTraceFiltersToStorage(
      new URLSearchParams('status=error&datePreset=custom&dateFrom=2026-01-01&dateTo=2026-01-02'),
      KEY,
    );

    expect(loadTraceFiltersFromStorage(KEY)?.toString()).toBe('status=error');
  });

  it('clears the saved set when no filter is left', () => {
    saveTraceFiltersToStorage(new URLSearchParams('status=error'), KEY);
    saveTraceFiltersToStorage(new URLSearchParams('traceId=abc'), KEY);

    expect(loadTraceFiltersFromStorage(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
