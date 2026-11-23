// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { useExpiringLocalStorageState } from '../use-local-storage-state';

const schema = z.string();
const START = 1_000_000;
const now = () => Date.now();
const mount = (expiresAt: Date | number = START + 10_000, key = 'token') =>
  renderHook(() => useExpiringLocalStorageState({ key, expiresAt, schema, now }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

describe('useExpiringLocalStorageState', () => {
  describe('when a valid, unexpired value is stored', () => {
    it('restores the value', () => {
      localStorage.setItem('token', JSON.stringify({ value: 'abc', expiresAt: START + 5_000 }));
      const view = mount();
      expect(view.result.current.value).toBe('abc');
      expect(view.result.current.expired).toBe(false);
    });
  });
  describe('when the stored value has already expired', () => {
    it('reports it as expired and removes the entry', () => {
      localStorage.setItem('token', JSON.stringify({ value: 'abc', expiresAt: START }));
      const view = mount();
      expect(view.result.current.value).toBeUndefined();
      expect(view.result.current.expired).toBe(true);
      expect(localStorage.getItem('token')).toBeNull();
    });
  });
  describe('when a value is set', () => {
    it('persists it with the expiration date and survives a remount', () => {
      const view = mount(new Date(START + 10_000));
      act(() => view.result.current.setValue('xyz'));
      expect(view.result.current.value).toBe('xyz');
      expect(localStorage.getItem('token')).toBe(JSON.stringify({ value: 'xyz', expiresAt: START + 10_000 }));
      view.unmount();
      expect(mount().result.current.value).toBe('xyz');
    });
  });
  describe('when the expiration date passes while mounted', () => {
    it('keeps the value until the key is read again', () => {
      const view = mount(START + 10_000);
      act(() => view.result.current.setValue('xyz'));
      vi.setSystemTime(START + 10_000);
      expect(view.result.current.value).toBe('xyz');
      view.unmount();
      const next = mount();
      expect(next.result.current.value).toBeUndefined();
      expect(next.result.current.expired).toBe(true);
      expect(localStorage.getItem('token')).toBeNull();
    });
  });
  describe('when storage is missing or invalid', () => {
    it.each([undefined, 'bad json', '"no envelope"', '{"value":1,"expiresAt":9999999}', '{"value":"a"}'])(
      'returns undefined without expiring for %s',
      stored => {
        if (stored !== undefined) localStorage.setItem('token', stored);
        const view = mount();
        expect(view.result.current.value).toBeUndefined();
        expect(view.result.current.expired).toBe(false);
      },
    );
  });
  describe('when cleared', () => {
    it('removes the entry and resets the expired flag', () => {
      localStorage.setItem('token', JSON.stringify({ value: 'abc', expiresAt: START }));
      const view = mount();
      expect(view.result.current.expired).toBe(true);
      act(() => view.result.current.clear());
      expect(view.result.current.value).toBeUndefined();
      expect(view.result.current.expired).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });
  });
  describe('when browser storage throws', () => {
    it.each(['getItem', 'setItem', 'removeItem'] as const)('keeps in-memory updates usable after %s fails', method => {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      const view = mount();
      act(() => view.result.current.setValue('mem'));
      expect(view.result.current.value).toBe('mem');
      act(() => view.result.current.clear());
      expect(view.result.current.value).toBeUndefined();
    });
  });
});
