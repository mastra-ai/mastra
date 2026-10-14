import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SESSION_LIST_VIEW, useSessionListView } from './useSessionListView';

const STORAGE_KEY = 'mastracode.sessionListView';

const storedView = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

describe('useSessionListView', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens on the default sort when the stored sort is unknown', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sort: 'bogus' }));

    expect(renderHook(() => useSessionListView()).result.current.view).toEqual(DEFAULT_SESSION_LIST_VIEW);
  });

  it('opens on the default view when the stored value is not JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');

    expect(renderHook(() => useSessionListView()).result.current.view).toEqual(DEFAULT_SESSION_LIST_VIEW);
  });

  it('opens on the default grouping when the stored grouping is unknown', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ groupBy: 'project' }));

    expect(renderHook(() => useSessionListView()).result.current.view.groupBy).toBe('board');
  });

  it('keeps hidden groups that are string lists and drops the malformed ones', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ hiddenGroups: { board: ['board:review'], status: [1, 'status:done'], owner: [], tag: ['x'] } }),
    );

    expect(renderHook(() => useSessionListView()).result.current.view.hiddenGroups).toEqual({
      board: ['board:review'],
    });
  });

  it('forgets hidden groups once every group is shown again', () => {
    const { result } = renderHook(() => useSessionListView());

    act(() => result.current.updateView({ groupBy: 'status', hiddenGroups: { status: ['status:done'] } }));
    expect(storedView()).toEqual({ groupBy: 'status', hiddenGroups: { status: ['status:done'] } });

    act(() => result.current.updateView({ hiddenGroups: { status: [] } }));
    expect(storedView()).toEqual({ groupBy: 'status' });
  });

  it('reads a stored group order and drops malformed entries', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ groupOrder: { board: ['user', 'board:work'], status: [1, 'status:done'], tag: ['x'] } }),
    );

    expect(renderHook(() => useSessionListView()).result.current.view.groupOrder).toEqual({
      board: ['user', 'board:work'],
    });
  });

  it('forgets a group order once it is cleared', () => {
    const { result } = renderHook(() => useSessionListView());

    act(() => result.current.updateView({ groupOrder: { board: ['user', 'board:work'] } }));
    expect(storedView()).toEqual({ groupOrder: { board: ['user', 'board:work'] } });

    act(() => result.current.updateView({ groupOrder: { board: [] } }));
    expect(storedView()).toEqual({});
  });

  it('stores only what differs from the default, and forgets a choice set back to it', () => {
    const { result } = renderHook(() => useSessionListView());

    act(() => result.current.updateView({ sort: 'updated' }));
    expect(storedView()).toEqual({ sort: 'updated' });
    expect(result.current.view.sort).toBe('updated');

    act(() => result.current.updateView({ sort: 'activity' }));
    expect(storedView()).toEqual({});
    expect(result.current.view.sort).toBe('activity');
  });

  it('resets every choice back to the default', () => {
    const { result } = renderHook(() => useSessionListView());
    act(() => result.current.updateView({ sort: 'created' }));

    act(() => result.current.resetView());

    expect(storedView()).toEqual({});
    expect(result.current.view).toEqual(DEFAULT_SESSION_LIST_VIEW);
  });

  it('keeps the chosen view for the session when localStorage writes fail', () => {
    const { result } = renderHook(() => useSessionListView());
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    act(() => result.current.updateView({ sort: 'updated' }));

    expect(result.current.view.sort).toBe('updated');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    setItem.mockRestore();
    act(() => result.current.resetView());
  });
});
