import { describe, expect, it } from 'vitest';
import { observabilityViewCrumbLabel } from '../observability-crumbs';
import {
  readSpanSelection,
  readThreadSelection,
  spanTraceSearch,
  withSpanSelection,
  withThreadSelection,
} from '../observability-selection-params';

describe('span selection params', () => {
  describe('when a span is selected', () => {
    it('sets it without dropping unrelated params', () => {
      const next = withSpanSelection(new URLSearchParams('tab=io'), { traceId: 't1', spanId: 's1' });

      expect(next.toString()).toBe('tab=io&traceId=t1&spanId=s1');
      expect(readSpanSelection(next)).toEqual({ traceId: 't1', spanId: 's1' });
    });
  });

  describe('when the selection is cleared', () => {
    it('removes it and keeps unrelated params', () => {
      const next = withSpanSelection(new URLSearchParams('tab=io&traceId=t1&spanId=s1'), undefined);

      expect(next.toString()).toBe('tab=io');
      expect(readSpanSelection(next)).toBeUndefined();
    });
  });

  describe('when only half a selection is in the URL', () => {
    it('reads no selection', () => {
      expect(readSpanSelection(new URLSearchParams('traceId=t1'))).toBeUndefined();
    });
  });

  it('builds the search that opens the span in its trace', () => {
    expect(spanTraceSearch({ traceId: 't1', spanId: 's1' }).toString()).toBe('traceId=t1&spanId=s1');
  });
});

describe('thread selection params', () => {
  describe('when a thread is selected', () => {
    it('sets it without dropping unrelated params', () => {
      const next = withThreadSelection(new URLSearchParams('tab=io'), 'th1');

      expect(next.toString()).toBe('tab=io&threadId=th1');
      expect(readThreadSelection(next)).toBe('th1');
    });
  });

  describe('when the selection is cleared', () => {
    it('removes it and keeps unrelated params', () => {
      const next = withThreadSelection(new URLSearchParams('tab=io&threadId=th1'), undefined);

      expect(next.toString()).toBe('tab=io');
      expect(readThreadSelection(next)).toBeUndefined();
    });
  });
});

describe('observabilityViewCrumbLabel', () => {
  describe('when the switch is hidden', () => {
    it('names the current view', () => {
      expect(observabilityViewCrumbLabel({ current: 'spans', isLoading: false, showSwitch: false })).toBe('Spans');
    });

    it('does not repeat the traces root crumb', () => {
      expect(observabilityViewCrumbLabel({ current: 'traces', isLoading: false, showSwitch: false })).toBeUndefined();
    });
  });

  describe('when the switch already names the view', () => {
    it('adds no label', () => {
      expect(observabilityViewCrumbLabel({ current: 'threads', isLoading: false, showSwitch: true })).toBeUndefined();
    });
  });

  describe('while the views are loading', () => {
    it('adds no label', () => {
      expect(observabilityViewCrumbLabel({ current: 'spans', isLoading: true, showSwitch: false })).toBeUndefined();
    });
  });
});
