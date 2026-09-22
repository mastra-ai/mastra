// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { useLocalStorageState } from '../use-local-storage-state';

const schema = z.number();
const mount = (initialKey = 'count') => renderHook(() => useLocalStorageState({ initialKey, defaultValue: 0, schema }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useLocalStorageState', () => {
  describe('when a valid value is stored', () => {
    it('restores the value and persists functional updates across remounts', () => {
      localStorage.setItem('count', '2');
      const view = mount();
      expect(view.result.current[0]).toBe(2);
      act(() => {
        view.result.current[1](previous => previous + 1);
        view.result.current[1](previous => previous + 1);
      });
      expect(localStorage.getItem('count')).toBe('4');
      view.unmount();
      expect(mount().result.current[0]).toBe(4);
    });
  });
  describe('when storage is missing or invalid', () => {
    it.each([undefined, 'bad json', '"wrong type"', 'null'])('uses defaults for %s', stored => {
      if (stored !== undefined) localStorage.setItem('count', stored);
      expect(mount().result.current[0]).toBe(0);
    });
  });
  describe('when initial options change without remounting', () => {
    it('keeps state and writes bound to the original key', () => {
      localStorage.setItem('other', '9');
      const view = renderHook(
        ({ initialKey, defaultValue }) => useLocalStorageState({ initialKey, defaultValue, schema }),
        { initialProps: { initialKey: 'count', defaultValue: 0 } },
      );
      act(() => view.result.current[1](2));
      view.rerender({ initialKey: 'other', defaultValue: 5 });
      expect(view.result.current[0]).toBe(2);
      act(() => view.result.current[1](3));
      expect(localStorage.getItem('count')).toBe('3');
      expect(localStorage.getItem('other')).toBe('9');
    });
  });
  describe('when the consumer remounts with another key', () => {
    it('isolates the saved values', () => {
      const first = mount();
      act(() => first.result.current[1](7));
      first.unmount();
      const second = mount('other');
      expect(second.result.current[0]).toBe(0);
      act(() => second.result.current[1](3));
      second.unmount();
      expect(mount().result.current[0]).toBe(7);
      expect(localStorage.getItem('other')).toBe('3');
    });
  });
  describe('when serialization and validation transform the value', () => {
    it('round-trips through the supplied serializer and schema', () => {
      const options = {
        initialKey: 'custom',
        defaultValue: 0,
        schema: z.object({ value: z.number() }).transform(stored => stored.value),
        serialize: (value: number) => JSON.stringify({ value }),
      };
      const first = renderHook(() => useLocalStorageState(options));
      act(() => first.result.current[1](9));
      expect(localStorage.getItem('custom')).toBe('{"value":9}');
      first.unmount();
      expect(renderHook(() => useLocalStorageState(options)).result.current[0]).toBe(9);
    });
  });
  describe('when browser storage throws', () => {
    it.each(['getItem', 'setItem'] as const)('keeps in-memory updates usable after %s fails', method => {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      const view = mount();
      act(() => view.result.current[1](5));
      expect(view.result.current[0]).toBe(5);
    });
  });
});
