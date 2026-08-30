// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SetURLSearchParamsLike, UseTraceUrlStateOptions, UseTraceUrlStateResult } from '../use-trace-url-state';
import { useTraceUrlState } from '../use-trace-url-state';

// Capture the hook API + the live URL from a harness that owns the search-param state, mimicking
// react-router's `useSearchParams` (functional updater receives the latest committed params).
let api: UseTraceUrlStateResult;
let currentSearch: string;
const setSpy = vi.fn();

function Harness({ initial, options }: { initial: string; options?: UseTraceUrlStateOptions }) {
  const [params, setParams] = useState(() => new URLSearchParams(initial));
  currentSearch = params.toString();
  const setSearchParams = useCallback<SetURLSearchParamsLike>((next, navigateOptions) => {
    setSpy(next, navigateOptions);
    setParams(prev => (typeof next === 'function' ? next(new URLSearchParams(prev)) : new URLSearchParams(next)));
  }, []);
  api = useTraceUrlState(params, setSearchParams, options);
  return null;
}

/** Navigation options of the most recent URL update. */
const lastNavigation = () => setSpy.mock.calls.at(-1)?.[1] as { replace?: boolean } | undefined;

afterEach(() => {
  cleanup();
  setSpy.mockClear();
});

describe('useTraceUrlState.handleSpanChangeWithTab', () => {
  it('selects the span and switches the tab in a SINGLE atomic URL update', () => {
    render(<Harness initial="traceId=t1" />);

    act(() => api.handleSpanChangeWithTab('s1', 'feedback'));

    const p = new URLSearchParams(currentSearch);
    expect(p.get('traceId')).toBe('t1');
    expect(p.get('spanId')).toBe('s1');
    expect(p.get('tab')).toBe('feedback');
    // The whole point of the fix: one navigation, not two racing ones (span + tab separately).
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it('clears a stale scoreId when jumping to feedback', () => {
    render(<Harness initial="traceId=t1&spanId=old&scoreId=sc1&tab=details" />);

    act(() => api.handleSpanChangeWithTab('s2', 'feedback'));

    const p = new URLSearchParams(currentSearch);
    expect(p.get('spanId')).toBe('s2');
    expect(p.get('tab')).toBe('feedback');
    expect(p.get('scoreId')).toBeNull();
  });

  it('skips the navigation entirely when span, tab and score already match', () => {
    render(<Harness initial="traceId=t1&spanId=s1&tab=feedback" />);

    act(() => api.handleSpanChangeWithTab('s1', 'feedback'));

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('still navigates when only a stale scoreId needs clearing', () => {
    render(<Harness initial="traceId=t1&spanId=s1&tab=feedback&scoreId=sc1" />);

    act(() => api.handleSpanChangeWithTab('s1', 'feedback'));

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

const paramsNow = () => new URLSearchParams(currentSearch);

describe('useTraceUrlState date state', () => {
  // Restored here rather than at the end of each test, so a failing assertion
  // cannot leave fake timers running for every test after it.
  afterEach(() => vi.useRealTimers());

  it('defaults to the last 24 hours without a preset in the URL', () => {
    render(<Harness initial="" />);

    expect(api.datePreset).toBe('last-24h');
    expect(api.datePresetRef.current).toBe('last-24h');
  });

  it('ignores a preset the app does not know', () => {
    render(<Harness initial="datePreset=since-forever" />);

    expect(api.datePreset).toBe('last-24h');
  });

  it.each([
    ['last-24h', 24],
    ['last-3d', 72],
    ['last-7d', 168],
    ['last-14d', 336],
    ['last-30d', 720],
  ])('derives a start date %s hours back for a rolling preset', (preset, hours) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));

    render(<Harness initial={`datePreset=${preset}`} />);

    expect(api.selectedDateFrom?.toISOString()).toBe(new Date(Date.now() - hours * 3600_000).toISOString());
    // A rolling window has no explicit end — it runs up to now.
    expect(api.selectedDateTo).toBeUndefined();
  });

  it('has no start date at all for the "all" preset', () => {
    render(<Harness initial="datePreset=all" />);

    expect(api.selectedDateFrom).toBeUndefined();
    expect(api.selectedDateTo).toBeUndefined();
  });

  it('reads both ends of a custom range from the URL', () => {
    render(<Harness initial="datePreset=custom&dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-02T00:00:00.000Z" />);

    expect(api.selectedDateFrom?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(api.selectedDateTo?.toISOString()).toBe('2026-06-02T00:00:00.000Z');
  });

  it('drops an unparseable custom date rather than charting an invalid one', () => {
    render(<Harness initial="datePreset=custom&dateFrom=yesterday&dateTo=whenever" />);

    expect(api.selectedDateFrom).toBeUndefined();
    expect(api.selectedDateTo).toBeUndefined();
  });

  it('leaves a custom range half-open when only one end is set', () => {
    render(<Harness initial="datePreset=custom&dateFrom=2026-06-01T00:00:00.000Z" />);

    expect(api.selectedDateFrom?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(api.selectedDateTo).toBeUndefined();
  });

  it('leaves a custom range open at the start when only the end is set', () => {
    render(<Harness initial="datePreset=custom&dateTo=2026-06-02T00:00:00.000Z" />);

    // No start date at all — not the epoch, which would look like "since 1970".
    expect(api.selectedDateFrom).toBeUndefined();
    expect(api.selectedDateTo?.toISOString()).toBe('2026-06-02T00:00:00.000Z');
  });

  it('ignores custom dates left over from a rolling preset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));

    render(<Harness initial="datePreset=last-3d&dateFrom=2026-01-01T00:00:00.000Z&dateTo=2026-01-02T00:00:00.000Z" />);

    expect(api.selectedDateFrom?.toISOString()).toBe(new Date(Date.now() - 72 * 3600_000).toISOString());
    expect(api.selectedDateTo).toBeUndefined();
  });
});

describe('useTraceUrlState.handleDatePresetChange', () => {
  it('clears every date param when going back to the default', () => {
    render(<Harness initial="datePreset=custom&dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-02T00:00:00.000Z" />);

    act(() => api.handleDatePresetChange('last-24h'));

    const p = paramsNow();
    expect(p.get('datePreset')).toBeNull();
    expect(p.get('dateFrom')).toBeNull();
    expect(p.get('dateTo')).toBeNull();
  });

  it('keeps the existing dates when switching to custom so they can be adjusted', () => {
    render(<Harness initial="dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-02T00:00:00.000Z" />);

    act(() => api.handleDatePresetChange('custom'));

    const p = paramsNow();
    expect(p.get('datePreset')).toBe('custom');
    expect(p.get('dateFrom')).toBe('2026-06-01T00:00:00.000Z');
    expect(p.get('dateTo')).toBe('2026-06-02T00:00:00.000Z');
  });

  it('stores only the preset for a rolling window, dropping stale dates', () => {
    render(<Harness initial="datePreset=custom&dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-02T00:00:00.000Z" />);

    act(() => api.handleDatePresetChange('last-7d'));

    const p = paramsNow();
    expect(p.get('datePreset')).toBe('last-7d');
    expect(p.get('dateFrom')).toBeNull();
    expect(p.get('dateTo')).toBeNull();
  });

  it('stores the "all" preset like any other rolling one', () => {
    render(<Harness initial="dateFrom=2026-06-01T00:00:00.000Z" />);

    act(() => api.handleDatePresetChange('all'));

    const p = paramsNow();
    expect(p.get('datePreset')).toBe('all');
    expect(p.get('dateFrom')).toBeNull();
  });

  it('drops the selection, which no longer belongs to the new window', () => {
    render(<Harness initial="traceId=t1&spanId=s1&anchorSpanId=a1&tab=feedback&scoreId=sc1" />);

    act(() => api.handleDatePresetChange('last-7d'));

    const p = paramsNow();
    expect(p.get('traceId')).toBeNull();
    expect(p.get('spanId')).toBeNull();
    expect(p.get('anchorSpanId')).toBeNull();
    expect(p.get('tab')).toBeNull();
    expect(p.get('scoreId')).toBeNull();
  });

  it('records the new preset synchronously, before the URL catches up', () => {
    render(<Harness initial="" />);

    act(() => {
      api.handleDatePresetChange('custom');
      // Same tick: the picker's own onDateChange must already see 'custom'.
      expect(api.datePresetRef.current).toBe('custom');
    });
  });
});

describe('useTraceUrlState.handleDateChange', () => {
  it('writes the chosen end of a custom range as an ISO string', () => {
    render(<Harness initial="datePreset=custom" />);

    act(() => api.handleDateChange(new Date('2026-06-05T08:30:00.000Z'), 'from'));
    expect(paramsNow().get('dateFrom')).toBe('2026-06-05T08:30:00.000Z');

    act(() => api.handleDateChange(new Date('2026-06-06T08:30:00.000Z'), 'to'));
    expect(paramsNow().get('dateTo')).toBe('2026-06-06T08:30:00.000Z');
  });

  it('clears just that end when the date is taken away', () => {
    render(<Harness initial="datePreset=custom&dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-02T00:00:00.000Z" />);

    act(() => api.handleDateChange(undefined, 'from'));

    const p = paramsNow();
    expect(p.get('dateFrom')).toBeNull();
    expect(p.get('dateTo')).toBe('2026-06-02T00:00:00.000Z');
  });

  it('ignores the picker while a rolling preset is in effect', () => {
    render(<Harness initial="datePreset=last-7d" />);

    act(() => api.handleDateChange(new Date('2026-06-05T08:30:00.000Z'), 'from'));

    expect(setSpy).not.toHaveBeenCalled();
    expect(paramsNow().get('dateFrom')).toBeNull();
  });

  it('drops the selection along with the new date', () => {
    render(<Harness initial="datePreset=custom&traceId=t1&spanId=s1&tab=feedback&scoreId=sc1&anchorSpanId=a1" />);

    act(() => api.handleDateChange(new Date('2026-06-05T08:30:00.000Z'), 'from'));

    const p = paramsNow();
    expect(p.get('traceId')).toBeNull();
    expect(p.get('spanId')).toBeNull();
    expect(p.get('anchorSpanId')).toBeNull();
    expect(p.get('tab')).toBeNull();
    expect(p.get('scoreId')).toBeNull();
  });
});

describe('useTraceUrlState selection state', () => {
  it('reads the selection out of the URL', () => {
    render(<Harness initial="traceId=t1&spanId=s1&anchorSpanId=a1&tab=feedback&scoreId=sc1" />);

    expect(api.traceIdParam).toBe('t1');
    expect(api.spanIdParam).toBe('s1');
    expect(api.anchorSpanIdParam).toBe('a1');
    expect(api.spanTabParam).toBe('feedback');
    expect(api.scoreIdParam).toBe('sc1');
  });

  it('treats an empty param as no selection at all', () => {
    render(<Harness initial="traceId=&spanId=&anchorSpanId=&scoreId=" />);

    expect(api.traceIdParam).toBeUndefined();
    expect(api.spanIdParam).toBeUndefined();
    expect(api.anchorSpanIdParam).toBeUndefined();
    expect(api.scoreIdParam).toBeUndefined();
  });

  it.each(['feedback', 'details'])('recognizes the %s tab', tab => {
    render(<Harness initial={`tab=${tab}`} />);

    expect(api.spanTabParam).toBe(tab);
  });

  it('ignores a tab name it does not know', () => {
    render(<Harness initial="tab=timeline" />);

    expect(api.spanTabParam).toBeUndefined();
  });
});

describe('useTraceUrlState.handleTraceClick', () => {
  it('selects a trace row and drops any per-span context', () => {
    render(<Harness initial="tab=feedback&scoreId=sc1" />);

    act(() => api.handleTraceClick('t1'));

    const p = paramsNow();
    expect(p.get('traceId')).toBe('t1');
    expect(p.get('spanId')).toBeNull();
    expect(p.get('anchorSpanId')).toBeNull();
    expect(p.get('tab')).toBeNull();
    expect(p.get('scoreId')).toBeNull();
  });

  it('selects a branch row by trace and anchor span', () => {
    render(<Harness initial="" />);

    act(() => api.handleTraceClick('t1', 's1', 'a1'));

    const p = paramsNow();
    expect(p.get('traceId')).toBe('t1');
    expect(p.get('spanId')).toBe('s1');
    expect(p.get('anchorSpanId')).toBe('a1');
  });

  it('clears the whole selection when handed no trace', () => {
    render(<Harness initial="traceId=t1&spanId=s1&anchorSpanId=a1" />);

    act(() => api.handleTraceClose());

    const p = paramsNow();
    expect(p.get('traceId')).toBeNull();
    expect(p.get('spanId')).toBeNull();
    expect(p.get('anchorSpanId')).toBeNull();
  });

  it('leaves the filters alone', () => {
    render(<Harness initial="status=error&listMode=branches&filterTags=a" />);

    act(() => api.handleTraceClick('t1'));

    const p = paramsNow();
    expect(p.get('status')).toBe('error');
    expect(p.get('listMode')).toBe('branches');
    expect(p.get('filterTags')).toBe('a');
  });
});

describe('useTraceUrlState.handleSpanChange', () => {
  it('selects a span and drops the previous span’s tab and score', () => {
    render(<Harness initial="traceId=t1&spanId=s1&tab=feedback&scoreId=sc1" />);

    act(() => api.handleSpanChange('s2'));

    const p = paramsNow();
    expect(p.get('spanId')).toBe('s2');
    expect(p.get('tab')).toBeNull();
    expect(p.get('scoreId')).toBeNull();
  });

  it('clears the span selection on close', () => {
    render(<Harness initial="traceId=t1&spanId=s1" />);

    act(() => api.handleSpanClose());

    expect(paramsNow().get('spanId')).toBeNull();
    expect(paramsNow().get('traceId')).toBe('t1');
  });

  it('does not navigate when the span is already the one selected', () => {
    render(<Harness initial="traceId=t1&spanId=s1" />);

    act(() => api.handleSpanChange('s1'));

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('does not navigate when closing a span that is already closed', () => {
    render(<Harness initial="traceId=t1" />);

    act(() => api.handleSpanClose());

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('keeps the anchor span while moving between spans inside the panel', () => {
    render(<Harness initial="traceId=t1&spanId=s1&anchorSpanId=a1" />);

    act(() => api.handleSpanChange('s2'));

    expect(paramsNow().get('anchorSpanId')).toBe('a1');
  });
});

describe('useTraceUrlState.handleSpanTabChange', () => {
  it('stores a non-default tab and clears the score', () => {
    render(<Harness initial="traceId=t1&spanId=s1&scoreId=sc1" />);

    act(() => api.handleSpanTabChange('feedback'));

    const p = paramsNow();
    expect(p.get('tab')).toBe('feedback');
    expect(p.get('scoreId')).toBeNull();
  });

  it('drops the param when going back to the default tab', () => {
    render(<Harness initial="traceId=t1&spanId=s1&tab=feedback" />);

    act(() => api.handleSpanTabChange('details'));

    expect(paramsNow().get('tab')).toBeNull();
  });

  it('does not navigate when the tab is already showing', () => {
    render(<Harness initial="traceId=t1&spanId=s1&tab=feedback" />);

    act(() => api.handleSpanTabChange('feedback'));

    expect(setSpy).not.toHaveBeenCalled();
  });
});

describe('useTraceUrlState.handleScoreChange', () => {
  it('selects and clears a score without touching anything else', () => {
    render(<Harness initial="traceId=t1&spanId=s1&tab=feedback" />);

    act(() => api.handleScoreChange('sc1'));
    expect(paramsNow().get('scoreId')).toBe('sc1');
    expect(paramsNow().get('tab')).toBe('feedback');

    act(() => api.handleScoreChange(null));
    expect(paramsNow().get('scoreId')).toBeNull();
    expect(paramsNow().get('spanId')).toBe('s1');
  });

  it('does not navigate when the score is already selected', () => {
    render(<Harness initial="scoreId=sc1" />);

    act(() => api.handleScoreChange('sc1'));

    expect(setSpy).not.toHaveBeenCalled();
  });
});

describe('useTraceUrlState list mode', () => {
  it('defaults to traces, and ignores a mode it does not know', () => {
    render(<Harness initial="" />);
    expect(api.listMode).toBe('traces');

    cleanup();

    render(<Harness initial="listMode=galaxy" />);
    expect(api.listMode).toBe('traces');
  });

  it('reads branches mode from the URL', () => {
    render(<Harness initial="listMode=branches" />);

    expect(api.listMode).toBe('branches');
  });

  it('stores branches mode and clears the selection', () => {
    render(<Harness initial="traceId=t1&spanId=s1&anchorSpanId=a1&tab=feedback&scoreId=sc1" />);

    act(() => api.handleListModeChange('branches'));

    const p = paramsNow();
    expect(p.get('listMode')).toBe('branches');
    expect(p.get('traceId')).toBeNull();
    expect(p.get('anchorSpanId')).toBeNull();
  });

  it('drops the param entirely when going back to the default mode', () => {
    render(<Harness initial="listMode=branches" />);

    act(() => api.handleListModeChange('traces'));

    expect(paramsNow().get('listMode')).toBeNull();
  });
});

describe('useTraceUrlState filter state', () => {
  it('resolves the root entity type to its option', () => {
    render(<Harness initial="rootEntityType=workflow_run" />);

    expect(api.selectedEntityOption?.label).toBe('Workflow');
    expect(api.selectedEntityOption?.entityType).toBe('workflow_run');
  });

  it('has no entity option for a type it does not offer', () => {
    render(<Harness initial="rootEntityType=spaceship" />);

    expect(api.selectedEntityOption).toBeUndefined();
  });

  it('reads a known status and ignores an unknown one', () => {
    render(<Harness initial="status=error" />);
    expect(api.selectedStatus).toBe('error');

    cleanup();

    render(<Harness initial="status=confused" />);
    expect(api.selectedStatus).toBeUndefined();
  });

  it('turns the filter params into tokens', () => {
    render(<Harness initial="filterTraceId=abc&status=error" />);

    expect(api.filterTokens.map(token => token.fieldId)).toContain('traceId');
  });
});

describe('useTraceUrlState.handleRemoveAll', () => {
  it('clears every filter and the selection, and calls back', () => {
    const onRemoveAll = vi.fn();
    render(
      <Harness
        initial="listMode=branches&rootEntityType=agent&status=error&filterTags=a&filterTraceId=t&traceId=t1&spanId=s1&anchorSpanId=a1&tab=feedback&scoreId=sc1"
        options={{ onRemoveAll }}
      />,
    );

    act(() => api.handleRemoveAll());

    expect(paramsNow().toString()).toBe('');
    expect(onRemoveAll).toHaveBeenCalledTimes(1);
  });

  it('keeps the date window, which is not one of the filters it removes', () => {
    render(<Harness initial="datePreset=last-7d&status=error" />);

    act(() => api.handleRemoveAll());

    const p = paramsNow();
    expect(p.get('datePreset')).toBe('last-7d');
    expect(p.get('status')).toBeNull();
  });

  it('works without a callback', () => {
    render(<Harness initial="status=error" />);

    expect(() => act(() => api.handleRemoveAll())).not.toThrow();
    expect(paramsNow().get('status')).toBeNull();
  });
});

describe('useTraceUrlState.applyFilterTokens', () => {
  it('replaces the filter set and clears the selection', () => {
    render(<Harness initial="filterTags=old&status=error&traceId=t1&spanId=s1&tab=feedback&scoreId=sc1" />);

    act(() => api.applyFilterTokens([{ fieldId: 'traceId', value: 'abc' }]));

    const p = paramsNow();
    expect(p.get('filterTraceId')).toBe('abc');
    expect(p.get('filterTags')).toBeNull();
    expect(p.get('status')).toBeNull();
    expect(p.get('traceId')).toBeNull();
    expect(p.get('spanId')).toBeNull();
    expect(p.get('tab')).toBeNull();
    expect(p.get('scoreId')).toBeNull();
  });

  it('is the same handler the filter UI is given', () => {
    render(<Harness initial="" />);

    expect(api.handleFilterTokensChange).toBe(api.applyFilterTokens);
  });
});

describe('useTraceUrlState pass-through', () => {
  it('hands back the very params and setter it was given', () => {
    render(<Harness initial="traceId=t1" />);

    expect(api.searchParams.get('traceId')).toBe('t1');
    api.setSearchParams(new URLSearchParams('traceId=t2'));
    expect(setSpy).toHaveBeenCalledTimes(1);
  });
});

describe('useTraceUrlState history', () => {
  it.each([
    ['selecting a trace', () => api.handleTraceClick('t1')],
    ['closing a trace', () => api.handleTraceClose()],
    ['selecting a span', () => api.handleSpanChange('s2')],
    ['switching a span tab', () => api.handleSpanTabChange('feedback')],
    ['selecting a span and tab at once', () => api.handleSpanChangeWithTab('s3', 'feedback')],
    ['selecting a score', () => api.handleScoreChange('sc9')],
    ['switching list mode', () => api.handleListModeChange('branches')],
    ['changing the date preset', () => api.handleDatePresetChange('last-7d')],
    ['applying filter tokens', () => api.applyFilterTokens([{ fieldId: 'traceId', value: 'abc' }])],
    ['removing every filter', () => api.handleRemoveAll()],
  ])('replaces the current history entry when %s', (_, action) => {
    render(<Harness initial="traceId=t1&spanId=s1&tab=details" />);

    act(action);

    // Browsing a list must not fill the back button with every intermediate state.
    expect(lastNavigation()).toEqual({ replace: true });
  });

  it('replaces the current history entry when a custom date changes', () => {
    render(<Harness initial="datePreset=custom" />);

    act(() => api.handleDateChange(new Date('2026-06-05T08:30:00.000Z'), 'from'));

    expect(lastNavigation()).toEqual({ replace: true });
  });
});

describe('useTraceUrlState derived state follows the URL', () => {
  it('re-reads the date preset after the URL changes', () => {
    render(<Harness initial="" />);
    expect(api.datePreset).toBe('last-24h');

    act(() => api.handleDatePresetChange('last-7d'));

    expect(api.datePreset).toBe('last-7d');
    expect(api.datePresetRef.current).toBe('last-7d');
  });

  it('re-reads the list mode after the URL changes', () => {
    render(<Harness initial="" />);
    expect(api.listMode).toBe('traces');

    act(() => api.handleListModeChange('branches'));

    expect(api.listMode).toBe('branches');
  });

  it('re-reads the filter tokens after the URL changes', () => {
    render(<Harness initial="" />);
    expect(api.filterTokens).toHaveLength(0);

    act(() => api.applyFilterTokens([{ fieldId: 'traceId', value: 'abc' }]));

    expect(api.filterTokens.map(token => token.fieldId)).toContain('traceId');
  });

  it('re-reads the entity option and status after the URL changes', () => {
    render(<Harness initial="rootEntityType=agent&status=error" />);
    expect(api.selectedEntityOption?.entityType).toBe('agent');
    expect(api.selectedStatus).toBe('error');

    act(() => api.handleRemoveAll());

    expect(api.selectedEntityOption).toBeUndefined();
    expect(api.selectedStatus).toBeUndefined();
  });

  it('re-reads a custom range after the URL changes', () => {
    render(<Harness initial="datePreset=custom" />);
    expect(api.selectedDateFrom).toBeUndefined();

    act(() => api.handleDateChange(new Date('2026-06-05T08:30:00.000Z'), 'from'));
    expect(api.selectedDateFrom?.toISOString()).toBe('2026-06-05T08:30:00.000Z');

    act(() => api.handleDateChange(new Date('2026-06-06T08:30:00.000Z'), 'to'));
    expect(api.selectedDateTo?.toISOString()).toBe('2026-06-06T08:30:00.000Z');
  });

  it('re-reads the selection after the URL changes', () => {
    render(<Harness initial="" />);

    act(() => api.handleTraceClick('t1', 's1', 'a1'));

    expect(api.traceIdParam).toBe('t1');
    expect(api.spanIdParam).toBe('s1');
    expect(api.anchorSpanIdParam).toBe('a1');

    act(() => api.handleSpanTabChange('feedback'));
    expect(api.spanTabParam).toBe('feedback');

    act(() => api.handleScoreChange('sc1'));
    expect(api.scoreIdParam).toBe('sc1');
  });

  it('keeps its no-op guards honest against the URL it just wrote', () => {
    render(<Harness initial="" />);

    act(() => api.handleSpanChange('s1'));
    setSpy.mockClear();

    // The span it just selected is the one already showing.
    act(() => api.handleSpanChange('s1'));

    expect(setSpy).not.toHaveBeenCalled();
  });
});

describe('useTraceUrlState.handleSpanChangeWithTab, continued', () => {
  it('drops a tab param that is already there when going back to details', () => {
    render(<Harness initial="traceId=t1&spanId=s1&tab=feedback" />);

    act(() => api.handleSpanChangeWithTab('s2', 'details'));

    const p = paramsNow();
    expect(p.get('spanId')).toBe('s2');
    expect(p.get('tab')).toBeNull();
  });

  it('still navigates when only the tab differs', () => {
    render(<Harness initial="traceId=t1&spanId=s1" />);

    act(() => api.handleSpanChangeWithTab('s1', 'feedback'));

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(paramsNow().get('tab')).toBe('feedback');
  });
});

describe('useTraceUrlState stale closures', () => {
  it('checks a repeated tab switch against the tab it just wrote', () => {
    render(<Harness initial="traceId=t1&spanId=s1" />);

    act(() => api.handleSpanTabChange('feedback'));
    setSpy.mockClear();

    act(() => api.handleSpanTabChange('feedback'));

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('checks a repeated score selection against the score it just wrote', () => {
    render(<Harness initial="traceId=t1&spanId=s1" />);

    act(() => api.handleScoreChange('sc1'));
    setSpy.mockClear();

    act(() => api.handleScoreChange('sc1'));

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('checks a repeated span-and-tab jump against what it just wrote', () => {
    render(<Harness initial="traceId=t1" />);

    act(() => api.handleSpanChangeWithTab('s1', 'feedback'));
    setSpy.mockClear();

    act(() => api.handleSpanChangeWithTab('s1', 'feedback'));

    expect(setSpy).not.toHaveBeenCalled();
  });
});

describe('useTraceUrlState with a router that swaps its setter', () => {
  // react-router hands back a fresh `setSearchParams` on some navigations; the
  // handlers must reach for whichever one is current, not the first they saw.
  function SwappingHarness({ initial }: { initial: string }) {
    const [params, setParams] = useState(() => new URLSearchParams(initial));
    const [generation, setGeneration] = useState(0);
    currentSearch = params.toString();
    // Deliberately not memoized: a new function identity on every render.
    const setSearchParams: SetURLSearchParamsLike = (next, navigateOptions) => {
      setSpy(next, navigateOptions, generation);
      setParams(prev => (typeof next === 'function' ? next(new URLSearchParams(prev)) : new URLSearchParams(next)));
    };
    api = useTraceUrlState(params, setSearchParams);
    bumpGeneration = () => setGeneration(value => value + 1);
    return null;
  }

  let bumpGeneration: () => void;

  it.each([
    ['selecting a trace', () => api.handleTraceClick('t2')],
    ['closing a trace', () => api.handleTraceClose()],
    ['closing a span', () => api.handleSpanClose()],
    ['switching list mode', () => api.handleListModeChange('branches')],
    ['changing the date preset', () => api.handleDatePresetChange('last-7d')],
    ['applying filter tokens', () => api.applyFilterTokens([{ fieldId: 'traceId', value: 'abc' }])],
    ['removing every filter', () => api.handleRemoveAll()],
  ])('uses the current setter when %s', (_, action) => {
    render(<SwappingHarness initial="traceId=t1&spanId=s1" />);

    act(() => bumpGeneration());
    act(action);

    // The generation the setter closed over proves which one was called.
    expect(setSpy.mock.calls.at(-1)?.[2]).toBe(1);
  });

  it('uses the current setter when a custom date changes', () => {
    render(<SwappingHarness initial="datePreset=custom" />);

    act(() => bumpGeneration());
    act(() => api.handleDateChange(new Date('2026-06-05T08:30:00.000Z'), 'from'));

    expect(setSpy.mock.calls.at(-1)?.[2]).toBe(1);
  });
});
