// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TraceDatePreset } from '../../index';
import type { SetURLSearchParamsLike, UseTraceUrlStateResult } from '../use-trace-url-state';
import { useTraceUrlState } from '../use-trace-url-state';

// Capture the hook API + the live URL from a harness that owns the search-param state, mimicking
// react-router's `useSearchParams` (functional updater receives the latest committed params).
let api: UseTraceUrlStateResult;
let currentSearch: string;
const setSpy = vi.fn();

function Harness({ initial, defaultDatePreset }: { initial: string; defaultDatePreset?: TraceDatePreset }) {
  const [params, setParams] = useState(() => new URLSearchParams(initial));
  currentSearch = params.toString();
  const setSearchParams = useCallback<SetURLSearchParamsLike>(next => {
    setSpy(next);
    setParams(prev => (typeof next === 'function' ? next(new URLSearchParams(prev)) : new URLSearchParams(next)));
  }, []);
  api = useTraceUrlState(params, setSearchParams, defaultDatePreset ? { defaultDatePreset } : undefined);
  return null;
}

afterEach(() => {
  cleanup();
  setSpy.mockClear();
  vi.restoreAllMocks();
});

describe('useTraceUrlState date state', () => {
  describe('when a consumer configures a different default date preset', () => {
    it('uses that preset without adding it to the URL', () => {
      render(<Harness initial="" defaultDatePreset="last-7d" />);

      expect(api.datePreset).toBe('last-7d');
      expect(currentSearch).toBe('');
    });

    it('stores a non-default preset and clears it when the default is restored', () => {
      render(<Harness initial="" defaultDatePreset="last-7d" />);

      act(() => api.handleDatePresetChange('last-14d'));
      expect(new URLSearchParams(currentSearch).get('datePreset')).toBe('last-14d');

      act(() => api.handleDatePresetChange('last-7d'));
      expect(new URLSearchParams(currentSearch).get('datePreset')).toBeNull();
    });

    it('keeps both custom dates when the picker updates them synchronously', () => {
      render(<Harness initial="" defaultDatePreset="last-7d" />);
      const dateFrom = new Date('2026-07-20T04:00:00.000Z');
      const dateTo = new Date('2026-07-26T03:59:00.000Z');

      act(() => {
        api.handleDatePresetChange('custom');
        api.handleDateChange(dateFrom, 'from');
        api.handleDateChange(dateTo, 'to');
      });

      const params = new URLSearchParams(currentSearch);
      expect(params.get('datePreset')).toBe('custom');
      expect(params.get('dateFrom')).toBe(dateFrom.toISOString());
      expect(params.get('dateTo')).toBe(dateTo.toISOString());
    });
  });
});

describe('useTraceUrlState.handleSpanChangeWithTab', () => {
  it('selects the span and switches the tab in a SINGLE atomic URL update', () => {
    render(<Harness initial="traceId=t1" />);

    act(() => api.handleSpanChangeWithTab('s1', 'scoring'));

    const p = new URLSearchParams(currentSearch);
    expect(p.get('traceId')).toBe('t1');
    expect(p.get('spanId')).toBe('s1');
    expect(p.get('tab')).toBe('scoring');
    // The whole point of the fix: one navigation, not two racing ones (span + tab separately).
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it('clears a stale scoreId when jumping to scoring', () => {
    render(<Harness initial="traceId=t1&spanId=old&scoreId=sc1&tab=details" />);

    act(() => api.handleSpanChangeWithTab('s2', 'scoring'));

    const p = new URLSearchParams(currentSearch);
    expect(p.get('spanId')).toBe('s2');
    expect(p.get('tab')).toBe('scoring');
    expect(p.get('scoreId')).toBeNull();
  });

  it('skips the navigation entirely when span, tab and score already match', () => {
    render(<Harness initial="traceId=t1&spanId=s1&tab=scoring" />);

    act(() => api.handleSpanChangeWithTab('s1', 'scoring'));

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('still navigates when only a stale scoreId needs clearing', () => {
    render(<Harness initial="traceId=t1&spanId=s1&tab=scoring&scoreId=sc1" />);

    act(() => api.handleSpanChangeWithTab('s1', 'scoring'));

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(currentSearch).get('scoreId')).toBeNull();
  });

  it("omits the tab param for the default 'details' tab", () => {
    render(<Harness initial="traceId=t1" />);

    act(() => api.handleSpanChangeWithTab('s1', 'details'));

    const p = new URLSearchParams(currentSearch);
    expect(p.get('spanId')).toBe('s1');
    expect(p.get('tab')).toBeNull();
  });
});
